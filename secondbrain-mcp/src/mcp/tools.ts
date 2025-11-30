import { ToolDefinition } from '@modelcontextprotocol/sdk';

export const storeMemoryTool: ToolDefinition = {
  name: 'store_memory',
  description: 'Stores a new memory (text, type, source, tags, metadata) and generates an embedding for semantic search.',
  input_schema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The content of the memory to store.' },
      type: {
        type: 'string',
        enum: ['note', 'research', 'survey', 'idea', 'decision', 'backlog', 'learning'],
        description: 'The category of the memory.'
      },
      source: { type: 'string', description: 'The origin of the memory (e.g., "gemini", "manual").' },
      tags: { type: 'array', items: { type: 'string' }, description: 'A list of tags for the memory.' },
      metadata: { type: 'object', description: 'Additional arbitrary metadata as a JSON object.' }
    },
    required: ['text', 'type']
  },
  output_schema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      memory_id: { type: 'number', description: 'The unique ID of the stored memory.' },
      vector_id: { type: 'string', description: 'The unique ID of the vector in the Vectorize index.' }
    },
    required: ['success', 'memory_id', 'vector_id']
  }
};

export const searchMemoryTool: ToolDefinition = {
  name: 'search_memory',
  description: 'Performs a semantic search over stored memories using a query string, returning relevant results.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The natural language query to search for.' },
      limit: { type: 'number', description: 'Maximum number of results to return (default: 5).' },
      filters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Filter by memory type.' },
          source: { type: 'string', description: 'Filter by memory source.' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags.' }
        }
      }
    },
    required: ['query']
  },
  output_schema: {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            text: { type: 'string' },
            score: { type: 'number' },
            type: { type: 'string' },
            source: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            created_at: { type: 'number' }
          },
          required: ['id', 'text', 'score', 'type', 'created_at']
        }
      }
    },
    required: ['results']
  }
};

export const listMemoriesTool: ToolDefinition = {
  name: 'list_memories',
  description: 'Lists stored memories with basic filtering and pagination.',
  input_schema: {
    type: 'object',
    properties: {
      type: { type: 'string', description: 'Filter by memory type.' },
      source: { type: 'string', description: 'Filter by memory source.' },
      limit: { type: 'number', description: 'Maximum number of results to return (default: 10).' },
      offset: { type: 'number', description: 'Offset for pagination (default: 0).' }
    }
  },
  output_schema: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        text: { type: 'string' },
        type: { type: 'string' },
        source: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        created_at: { type: 'number' }
      },
      required: ['id', 'text', 'type', 'created_at']
    }
  }
};

export const deleteMemoryTool: ToolDefinition = {
  name: 'delete_memory',
  description: 'Permanently deletes a memory from the database and vector index by its unique ID.',
  input_schema: {
    type: 'object',
    properties: {
      memory_id: { type: 'number', description: 'The unique ID of the memory to delete.' }
    },
    required: ['memory_id']
  },
  output_schema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' }
    },
    required: ['success']
  }
};

export const ALL_TOOLS: ToolDefinition[] = [
  storeMemoryTool,
  searchMemoryTool,
  listMemoriesTool,
  deleteMemoryTool,
];
