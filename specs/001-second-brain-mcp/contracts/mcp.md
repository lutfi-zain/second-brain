# MCP Tool Contracts: Second Brain

This document defines the contracts for the tools exposed by the Second Brain MCP server.

---

### Tool 1: `store_memory`

Stores a new memory, generates its embedding, and indexes it for search.

#### Input

```json
{
  "text": "string",
  "type": "'note' | 'research' | 'survey' | 'idea' | 'decision' | 'backlog' | 'learning'",
  "source": "string" (optional),
  "tags": "string[]" (optional),
  "metadata": "Record<string, any>" (optional)
}
```

#### Output

```json
{
  "success": "boolean",
  "memory_id": "number",
  "vector_id": "string"
}
```

---

### Tool 2: `search_memory`

Performs a semantic search for memories based on a query string.

#### Input

```json
{
  "query": "string",
  "limit": "number" (optional, default: 5),
  "filters": {
    "type": "string" (optional),
    "source": "string" (optional),
    "tags": "string[]" (optional)
  }
}
```

#### Output

```json
{
  "results": [
    {
      "id": "number",
      "text": "string",
      "score": "number",
      "type": "string",
      "source": "string" (optional),
      "tags": "string[]" (optional),
      "created_at": "number"
    }
  ]
}
```

---

### Tool 3: `list_memories`

Lists stored memories with basic filtering and pagination.

#### Input

```json
{
  "type": "string" (optional),
  "source": "string" (optional),
  "limit": "number" (optional, default: 10),
  "offset": "number" (optional, default: 0)
}
```

#### Output

An array of memory objects, similar to the `results` in `search_memory` but without the `score`.

---

### Tool 4: `delete_memory`

Permanently deletes a memory from the database and vector index.

#### Input

```json
{
  "memory_id": "number"
}
```

#### Output

```json
{
  "success": "boolean"
}
```
