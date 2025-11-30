# Quickstart: Testing the Second Brain MCP

This guide provides a quick way to test the functionality of the Second Brain MCP server once it is deployed.

**Prerequisite**: The service must be deployed to a Cloudflare Worker and accessible at a public URL (e.g., `https://brain.maftia.tech`).

---

### 1. Check Server Health and Tool Listing

You can "ping" the MCP endpoint to see the list of available tools. This confirms the server is running and responding to requests.

**Command**:
```bash
curl https://brain.maftia.tech/mcp
```

**Expected Output**:
You should receive a Server-Sent Event (SSE) stream. The first event will be `tools/list`, containing a JSON payload with the four defined tools: `store_memory`, `search_memory`, `list_memories`, and `delete_memory`.

---

### 2. Store a New Memory

Use a `curl` command with a `POST` request to call the `store_memory` tool.

**Command**:
```bash
# Send a POST request to the /mcp/call/store_memory endpoint
# (Note: The exact URL might differ if a REST API wrapper is used for debugging)

# This example assumes a simple REST-like debug endpoint at /api/store
curl -X POST https://brain.maftia.tech/api/store \
  -H "Content-Type: application/json" \
  -d 
  {
    "text": "The mitochondria is the powerhouse of the cell.",
    "type": "learning",
    "source": "manual",
    "tags": ["biology", "science"]
  }
```

**Expected Output**:
A JSON response indicating success, containing the new `memory_id`.
```json
{
  "success": true,
  "memory_id": 1,
  "vector_id": "some-unique-vector-id"
}
```

---

### 3. Search for the Memory

Use a `curl` command to call the `search_memory` tool.

**Command**:
```bash
# This example assumes a simple REST-like debug endpoint at /api/search
curl -X POST https://brain.maftia.tech/api/search \
  -H "Content-Type: application/json" \
  -d 
  {
    "query": "what is the powerhouse of the cell?"
  }
```

**Expected Output**:
A JSON response containing a list of results, with the memory you just created ranked highly.
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
      "created_at": 1732918800
    }
  ]
}
```

This completes a full end-to-end test of the core functionality.
