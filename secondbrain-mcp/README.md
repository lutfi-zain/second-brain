# Second Brain MCP Server

A Model Context Protocol (MCP) server that provides a personal, searchable memory store. Store, search, and manage your memories with semantic search powered by Cloudflare Workers AI.

## Features

- 🧠 **Memory Storage**: Store memories with text content, categories, tags, and metadata
- 🔍 **Semantic Search**: Find memories using natural language queries with vector embeddings
- 📚 **Memory Management**: List and delete memories with filtering options
- ⚡ **Cloudflare Powered**: Built on Cloudflare Workers for global, serverless deployment
- 🔒 **Type-Safe**: Full TypeScript implementation with Zod validation

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)

### Setup

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd secondbrain-mcp
   npm install
   ```

2. **Run the setup script**:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

   This will:
   - Create a D1 database
   - Set up a Vectorize index
   - Create a KV namespace for caching
   - Initialize the database schema
   - Configure `wrangler.toml`

3. **Deploy**:
   ```bash
   wrangler deploy
   ```

## Usage

### MCP Tools

The server exposes four MCP tools:

#### 1. `store_memory`
Store a new memory with text content and metadata.

**Input:**
```json
{
  "text": "The mitochondria is the powerhouse of the cell.",
  "type": "learning",
  "source": "manual",
  "tags": ["biology", "science"],
  "metadata": { "priority": "high" }
}
```

**Output:**
```json
{
  "success": true,
  "memory_id": 1,
  "vector_id": "memory_1_17031234567890"
}
```

#### 2. `search_memory`
Search memories using semantic similarity.

**Input:**
```json
{
  "query": "what is the powerhouse of the cell?",
  "limit": 5,
  "filters": {
    "type": "learning",
    "tags": ["biology"]
  }
}
```

**Output:**
```json
{
  "results": [
    {
      "id": 1,
      "text": "The mitochondria is the powerhouse of the cell.",
      "score": 0.98,
      "type": "learning",
      "source": "manual",
      "tags": ["biology", "science"],
      "created_at": 1703123456
    }
  ]
}
```

#### 3. `list_memories`
List memories with pagination and filtering.

**Input:**
```json
{
  "type": "learning",
  "source": "manual",
  "limit": 10,
  "offset": 0
}
```

**Output:**
```json
[
  {
    "id": 1,
    "text": "The mitochondria is the powerhouse of the cell.",
    "type": "learning",
    "source": "manual",
    "tags": ["biology", "science"],
    "created_at": 1703123456
  }
]
```

#### 4. `delete_memory`
Delete a memory by ID.

**Input:**
```json
{
  "memory_id": 1
}
```

**Output:**
```json
{
  "success": true
}
```

### Memory Types

Supported memory types:
- `note` - General notes and thoughts
- `research` - Research findings and data
- `survey` - Survey results and feedback
- `idea` - Creative ideas and concepts
- `decision` - Decision records and rationale
- `backlog` - Tasks and items to address
- `learning` - Learning insights and knowledge

### REST API (for testing/debugging)

While designed for MCP, the server also provides REST endpoints for testing:

- `GET /` - Health check
- `POST /mcp/call` - Call MCP tools via REST
- `POST /mcp` - Raw MCP protocol endpoint

Example:
```bash
# Store a memory via REST API
curl -X POST https://your-worker.workers.dev/api/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "store_memory",
    "arguments": {
      "text": "Test memory",
      "type": "note"
    }
  }'
```

## Development

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run tests**:
   ```bash
   npm test
   ```

3. **Local development**:
   ```bash
   wrangler dev
   ```

### Testing

The project includes comprehensive unit tests using Vitest:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Project Structure

```
secondbrain-mcp/
├── src/
│   ├── index.ts              # Main Worker entry point
│   ├── mcp/
│   │   ├── server.ts         # MCP protocol handler
│   │   ├── tools.ts          # Tool definitions
│   │   └── types.ts          # TypeScript interfaces
│   ├── handlers/
│   │   ├── memory.ts         # Store/delete memory logic
│   │   ├── search.ts         # Search/list memories logic
│   │   └── embeddings.ts     # AI embedding generation
│   ├── db/
│   │   └── schema.sql        # Database schema
│   └── utils/
│       ├── vectorize.ts      # Vectorize helper functions
│       ├── validation.ts     # Zod schemas and validation
│       └── errors.ts         # Error handling utilities
├── tests/                     # Unit tests
├── wrangler.toml              # Cloudflare Workers configuration
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## Configuration

### Environment Variables

The server uses Cloudflare Workers bindings configured in `wrangler.toml`:

- `DB` - D1 database for memory metadata
- `VECTORIZE` - Vectorize index for semantic search
- `AI` - Workers AI binding for embedding generation
- `CACHE` - KV namespace for caching (future use)

### Database Schema

The system uses two main tables:

1. **memories** - Stores memory content and metadata
2. **memory_vectors** - Links memories to vector embeddings

See `src/db/schema.sql` for the complete schema.

## Deployment

### Automated Deployment

Use the setup script for initial resource creation:

```bash
./setup.sh
wrangler deploy
```

### Manual Deployment

1. **Create resources manually**:
   ```bash
   wrangler d1 create second-brain-mcp-db
   wrangler vectorize create second-brain-mcp-vectors --dimensions=768 --metric=cosine
   wrangler kv:namespace create second-brain-mcp-cache
   ```

2. **Update wrangler.toml** with your resource IDs

3. **Initialize database**:
   ```bash
   wrangler d1 execute second-brain-mcp-db --file=src/db/schema.sql --legacy-compat
   ```

4. **Deploy**:
   ```bash
   wrangler deploy
   ```

### Environment-Specific Deployment

```bash
# Development
wrangler deploy --env dev

# Production
wrangler deploy --env production
```

## Security Considerations

- **Input Validation**: All inputs are validated using Zod schemas
- **SQL Injection**: Uses parameterized queries for D1 operations
- **Rate Limiting**: Implement rate limiting using Workers KV (in progress)
- **Error Handling**: Errors are sanitized and logged appropriately

## Performance

- **Embeddings**: Generated on-demand using Workers AI (@cf/baai/bge-base-en-v1.5)
- **Vector Search**: Optimized cosine similarity search with Vectorize
- **Caching**: KV-based caching for frequently accessed data (planned)
- **Global**: Deployed on Cloudflare's global network for low latency

## Troubleshooting

### Common Issues

1. **Database connection errors**:
   - Verify D1 database exists and is properly bound
   - Check database schema is initialized

2. **Vectorize errors**:
   - Ensure vector index exists with correct dimensions (768)
   - Verify embedding model compatibility

3. **AI binding errors**:
   - Check Workers AI is available in your region
   - Verify correct model usage (@cf/baai/bge-base-en-v1.5)

4. **Build failures**:
   - Check TypeScript compilation errors
   - Verify all dependencies are installed

### Debug Mode

Enable debug logging by setting environment variable:
```bash
wrangler deploy --env production --var DEBUG:true
```

### Logs

View real-time logs:
```bash
wrangler tail
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Guidelines

- Follow TypeScript strict mode
- Use Zod for all input validation
- Add comprehensive error handling
- Include unit tests for new features
- Maintain existing API compatibility

## License

[Add your license information here]

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed information
4. Include logs and error messages when applicable

## Changelog

### v1.0.0
- Initial release
- Four MCP tools: store_memory, search_memory, list_memories, delete_memory
- Semantic search with Cloudflare Vectorize
- D1 database for metadata storage
- Workers AI for embedding generation
- Comprehensive error handling and logging
- Full TypeScript implementation

---

**Built with ❤️ for the Model Context Protocol ecosystem**