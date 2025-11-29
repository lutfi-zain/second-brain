# INSTRUKSI UNTUK AI CODING ASSISTANT

```markdown
# Task: Build Second Brain MCP + Setup Sequential Thinking MCP on Cloudflare

## Context
Saya butuh 2 MCP servers yang bisa dipakai di VS Code, Antigravity, Claude Code, dan Gemini CLI:

1. **Sequential Thinking MCP** - Sudah ada official implementation, tinggal deploy ke Cloudflare Workers
2. **Second Brain MCP** - Custom build dengan Cloudflare Workers + D1 + Vectorize + Workers AI

## Requirements

### Second Brain MCP Requirements
- **Storage:** Cloudflare D1 (SQLite) untuk text + metadata
- **Vector Search:** Cloudflare Vectorize untuk semantic search
- **AI:** Workers AI (@cf/baai/bge-base-en-v1.5) untuk generate embeddings
- **Cache:** Workers KV untuk query cache
- **Protocol:** MCP (Model Context Protocol) dengan SSE transport
- **Endpoint:** `https://brain.maftia.tech/mcp`

### Schema D1
```
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('note', 'research', 'survey', 'idea', 'decision', 'backlog', 'learning')),
  source TEXT,  -- 'gemini', 'manual', 'sabiya', 'kuliah', 'work'
  tags TEXT,    -- JSON array
  metadata TEXT, -- JSON object
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_source ON memories(source);
CREATE INDEX idx_memories_created_at ON memories(created_at);

CREATE TABLE IF NOT EXISTS memory_vectors (
  memory_id INTEGER PRIMARY KEY,
  vector_id TEXT NOT NULL UNIQUE,
  embedding_model TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);
```

### MCP Tools to Implement

#### Tool 1: store_memory
**Input:**
```
{
  text: string;
  type: 'note' | 'research' | 'survey' | 'idea' | 'decision' | 'backlog' | 'learning';
  source?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}
```

**Output:**
```
{
  success: boolean;
  memory_id: number;
  vector_id: string;
}
```

#### Tool 2: search_memory
**Input:**
```
{
  query: string;
  limit?: number; // default 5
  filters?: {
    type?: string;
    source?: string;
    tags?: string[];
  };
}
```

**Output:**
```
{
  results: Array<{
    id: number;
    text: string;
    score: number;
    type: string;
    source?: string;
    tags?: string[];
    created_at: number;
  }>;
}
```

#### Tool 3: list_memories
**Input:**
```
{
  type?: string;
  source?: string;
  limit?: number; // default 10
  offset?: number; // default 0
}
```

#### Tool 4: delete_memory
**Input:**
```
{
  memory_id: number;
}
```

---

## Tasks

### Part 1: Second Brain MCP (Custom Build)

#### Step 1: Generate Project Structure
Buat project dengan struktur ini:

```
secondbrain-mcp/
├── src/
│   ├── index.ts              # Main Worker entrypoint (MCP server)
│   ├── mcp/
│   │   ├── server.ts         # MCP protocol handler (tools/list, tools/call)
│   │   ├── tools.ts          # Tool definitions (store, search, list, delete)
│   │   └── types.ts          # TypeScript interfaces
│   ├── handlers/
│   │   ├── memory.ts         # store_memory, delete_memory logic
│   │   ├── search.ts         # search_memory, list_memories logic
│   │   └── embeddings.ts     # Workers AI wrapper
│   ├── db/
│   │   └── schema.sql        # D1 schema (paste dari requirements di atas)
│   └── utils/
│       ├── vectorize.ts      # Vectorize helper functions
│       └── validation.ts     # Input validation (Zod)
├── wrangler.toml
├── package.json
├── tsconfig.json
└── README.md
```

#### Step 2: Generate wrangler.toml
```
name = "secondbrain-mcp"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[[d1_databases]]
binding = "DB"
database_name = "d1_secondbrain"
database_id = "YOUR_D1_ID_HERE"  # Will be filled after wrangler d1 create

[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_KV_ID_HERE"  # Will be filled after wrangler kv:namespace create

[[vectorize]]
binding = "VECTORIZE"
index_name = "vec_secondbrain_memories"

[ai]
binding = "AI"

[[routes]]
pattern = "brain.maftia.com/*"
zone_name = "maftia.com"
```

#### Step 3: Generate package.json
Dependencies:
- `@cloudflare/workers-types`
- `@modelcontextprotocol/sdk`
- `hono` (untuk routing HTTP)
- `zod` (untuk validation)
- TypeScript + Wrangler

#### Step 4: Implement Core Logic

**src/index.ts** - Main entrypoint:
- Implement SSE endpoint `/mcp` untuk MCP protocol
- Route `/api/*` untuk REST API (optional, untuk debugging)
- Handle CORS

**src/mcp/server.ts** - MCP protocol:
- Implement `tools/list` → return 4 tools (store, search, list, delete)
- Implement `tools/call` → dispatch ke handler yang sesuai
- Error handling & validation

**src/handlers/memory.ts** - Store & delete:
- `store_memory`:
  1. Validate input (Zod)
  2. Generate embedding via Workers AI
  3. Insert to D1 (memories table)
  4. Upsert to Vectorize dengan metadata
  5. Insert mapping ke memory_vectors table
  6. Return memory_id & vector_id

- `delete_memory`:
  1. Get vector_id dari memory_vectors
  2. Delete from Vectorize
  3. Delete from D1 (cascade ke memory_vectors)

**src/handlers/search.ts** - Search & list:
- `search_memory`:
  1. Convert query to embedding via Workers AI
  2. Query Vectorize (topK + filters dari metadata)
  3. Get memory_ids dari hasil Vectorize
  4. Fetch full records dari D1 by IDs
  5. Apply additional filters (type, source, tags)
  6. Return sorted by score

- `list_memories`:
  1. Build SQL query dengan WHERE clause (type, source)
  2. Add pagination (LIMIT, OFFSET)
  3. Execute via D1 binding
  4. Return results

**src/handlers/embeddings.ts** - Workers AI wrapper:
```
async function generateEmbedding(ai: Ai, text: string): Promise<number[]> {
  const response = await ai.run('@cf/baai/bge-base-en-v1.5', {
    text: [text]
  });
  return response.data;
}
```

**src/utils/vectorize.ts** - Vectorize helpers:
```
async function upsertVector(
  vectorize: VectorizeIndex,
  id: string,
  values: number[],
  metadata: Record<string, any>
) {
  await vectorize.upsert([{ id, values, metadata }]);
}

async function searchVectors(
  vectorize: VectorizeIndex,
  queryVector: number[],
  topK: number,
  filter?: Record<string, any>
) {
  return await vectorize.query(queryVector, {
    topK,
    returnMetadata: true,
    filter
  });
}

async function deleteVector(vectorize: VectorizeIndex, id: string) {
  await vectorize.deleteByIds([id]);
}
```

#### Step 5: Generate Setup Script
Buat `setup.sh`:
```
#!/bin/bash
set -e

echo "🚀 Setting up Second Brain MCP..."

# Create D1 database
echo "Creating D1 database..."
wrangler d1 create d1_secondbrain

# Create KV namespace
echo "Creating KV namespace..."
wrangler kv:namespace create CACHE

# Create Vectorize index
echo "Creating Vectorize index..."
wrangler vectorize create vec_secondbrain_memories \
  --dimensions=768 \
  --metric=cosine

echo "✅ Resources created!"
echo "⚠️  Please update wrangler.toml with the IDs shown above"
echo ""
echo "Next steps:"
echo "1. Update wrangler.toml with resource IDs"
echo "2. Run: wrangler d1 execute d1_secondbrain --file=./src/db/schema.sql"
echo "3. Run: npm run deploy"
```

---

### Part 2: Sequential Thinking MCP (Deploy Existing)

Sequential Thinking sudah ada official implementation, tapi untuk bisa dipakai di semua client, kita perlu wrapper Cloudflare Workers.

#### Step 1: Generate Project Structure
```
sequential-thinking-mcp/
├── src/
│   ├── index.ts              # Proxy Worker to npm package
│   └── wrapper.ts            # MCP SSE wrapper
├── wrangler.toml
└── package.json
```

#### Step 2: Generate wrangler.toml
```
name = "sequential-thinking-mcp"
main = "src/index.ts"
compatibility_date = "2024-11-01"

[[routes]]
pattern = "thinking.maftia.com/*"
zone_name = "maftia.com"
```

#### Step 3: Implement Wrapper
**src/index.ts** - Proxy ke official package:
```
import { WorkersEntrypoint } from 'cloudflare:workers';
// Import logic dari @modelcontextprotocol/server-sequential-thinking
// Wrap dengan SSE endpoint yang compatible dengan remote MCP clients

export default class SequentialThinkingMCP extends WorkersEntrypoint {
  async fetch(request: Request) {
    // Implement SSE endpoint /mcp
    // Forward MCP calls ke sequential thinking logic
    // Return SSE stream
  }
}
```

**Note:** Karena sequential thinking itu stateless (no database), ini lebih mudah dari second brain.

---

## Output yang Diharapkan

### 1. Dua repositories siap deploy:
- `secondbrain-mcp/` - Custom MCP dengan full code
- `sequential-thinking-mcp/` - Wrapper untuk official package

### 2. Setup instructions di README.md masing-masing

### 3. MCP config untuk semua clients:

#### VS Code (Cline/Roo Code extension)
```
// settings.json
{
  "mcp.servers": {
    "secondbrain": {
      "url": "https://brain.maftia.com/mcp",
      "transport": "sse"
    },
    "sequential-thinking": {
      "url": "https://thinking.maftia.com/mcp",
      "transport": "sse"
    }
  }
}
```

#### Claude Code (claude.json)
```
{
  "mcpServers": {
    "secondbrain": {
      "url": "https://brain.maftia.com/mcp",
      "transport": "sse"
    },
    "sequential-thinking": {
      "url": "https://thinking.maftia.com/mcp",
      "transport": "sse"
    }
  }
}
```

#### Antigravity (.antigravity/mcp.json)
```
{
  "mcpServers": {
    "secondbrain": {
      "url": "https://brain.maftia.com/mcp",
      "transport": "sse"
    },
    "sequential-thinking": {
      "url": "https://thinking.maftia.com/mcp",
      "transport": "sse"
    }
  }
}
```

#### Gemini CLI (gemini-config.json)
```
{
  "mcp": {
    "servers": {
      "secondbrain": "https://brain.maftia.com/mcp",
      "sequential-thinking": "https://thinking.maftia.com/mcp"
    }
  }
}
```

---

## Code Style & Best Practices

1. **TypeScript strict mode** - Enable semua strict checks
2. **Error handling** - Wrap semua async operations dengan try-catch
3. **Validation** - Pakai Zod untuk validate semua user input
4. **Logging** - Log setiap operation (store, search, delete) untuk debugging
5. **Testing** - Generate unit tests untuk handlers (Vitest)
6. **Comments** - Tambahkan JSDoc untuk semua exported functions
7. **Environment** - Support multiple environments (dev/staging/prod) via wrangler.toml

---

## Testing Instructions

Generate script untuk testing lokal:

```
# Test D1 connection
wrangler d1 execute d1_secondbrain --command="SELECT COUNT(*) FROM memories"

# Test Workers AI
curl https://brain.maftia.com/api/test-embedding \
  -H "Content-Type: application/json" \
  -d '{"text": "hello world"}'

# Test Vectorize
curl https://brain.maftia.com/api/test-vectorize

# Test MCP protocol
curl https://brain.maftia.com/mcp \
  -H "Accept: text/event-stream"
```

---

## Deployment Checklist

Generate `DEPLOY.md` dengan checklist:

- [ ] Setup Cloudflare account
- [ ] Create resources (D1, KV, Vectorize)
- [ ] Update wrangler.toml with resource IDs
- [ ] Run database migrations
- [ ] Deploy Workers: `wrangler deploy`
- [ ] Setup DNS (brain.maftia.com, thinking.maftia.com)
- [ ] Test MCP endpoints via curl
- [ ] Add MCP config ke VS Code / Claude / Antigravity / Gemini
- [ ] Test end-to-end: store memory → search memory

---

## Priority Order

1. **High Priority:** Second Brain MCP - handlers (store, search) - Ini core functionality
2. **Medium Priority:** MCP protocol implementation - Untuk bisa dipakai di semua clients
3. **Medium Priority:** Sequential Thinking wrapper - Untuk thinking workflow
4. **Low Priority:** REST API endpoints - Optional, untuk debugging
5. **Low Priority:** Unit tests - Bisa ditambah nanti

---

## Additional Notes

- Pakai Hono framework untuk routing (lightweight, fast)
- Implement rate limiting via Workers KV (prevent abuse)
- Add CORS headers untuk semua endpoints
- Cache search results di