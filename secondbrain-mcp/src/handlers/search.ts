import { Env, SearchMemoryInput, ListMemoriesInput, MemorySearchResult } from '../mcp/types';
import { validate } from '../utils/validation';
import { searchMemorySchema, listMemoriesSchema } from '../utils/validation';
import { generateEmbedding } from './embeddings';
import { searchVectors } from '../utils/vectorize';

/**
 * Handles searching for memories.
 * @param env The environment bindings (DB, VECTORIZE, AI).
 * @param args The input arguments for the search_memory tool.
 * @returns A promise that resolves to the search results.
 */
export async function handleSearchMemory(env: Env, args: any): Promise<any> {
  // Validate input
  const validatedArgs = validate(searchMemorySchema, args);

  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(env.AI, validatedArgs.query);

    // Build filter for Vectorize search if filters are provided
    let vectorFilter: Record<string, any> | undefined;
    if (validatedArgs.filters) {
      const filter: Record<string, any> = {};
      if (validatedArgs.filters.type) {
        filter.type = validatedArgs.filters.type;
      }
      if (validatedArgs.filters.source) {
        filter.source = validatedArgs.filters.source;
      }
      if (validatedArgs.filters.tags && validatedArgs.filters.tags.length > 0) {
        filter.tags = validatedArgs.filters.tags;
      }
      if (Object.keys(filter).length > 0) {
        vectorFilter = filter;
      }
    }

    // Search in Vectorize
    const vectorResults = await searchVectors(
      env.VECTORIZE,
      queryEmbedding,
      validatedArgs.limit,
      vectorFilter
    );

    if (!vectorResults.matches || vectorResults.matches.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No memories found matching your search query.',
          },
        ],
        result: {
          results: [],
        },
      };
    }

    // Get memory details from D1 for each result
    const memoryIds = vectorResults.matches.map(match => match.metadata?.memory_id).filter(Boolean);

    if (memoryIds.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No memories found matching your search query.',
          },
        ],
        result: {
          results: [],
        },
      };
    }

    // Query D1 for memory details
    const placeholders = memoryIds.map(() => '?').join(',');
    const dbResults = await env.DB.prepare(`
      SELECT id, text, type, source, tags, created_at
      FROM memories
      WHERE id IN (${placeholders})
      ORDER BY created_at DESC
    `).bind(...memoryIds).all();

    // Combine results with scores
    const results: MemorySearchResult[] = vectorResults.matches.map((match) => {
      const memoryId = match.metadata?.memory_id;
      const memoryData = dbResults.results.find(row => row.id === memoryId);

      if (!memoryData) {
        return null;
      }

      return {
        id: memoryData.id,
        text: memoryData.text,
        score: match.score || 0,
        type: memoryData.type,
        source: memoryData.source,
        tags: memoryData.tags ? JSON.parse(memoryData.tags) : [],
        created_at: memoryData.created_at,
      };
    }).filter((result): result is MemorySearchResult => result !== null);

    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.length} memories matching your query.`,
        },
      ],
      result: {
        results,
      },
    };
  } catch (error) {
    console.error('Error searching memories:', error);
    throw new Error(`Failed to search memories: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Handles listing memories.
 * @param env The environment bindings (DB).
 * @param args The input arguments for the list_memories tool.
 * @returns A promise that resolves to the list of memories.
 */
export async function handleListMemories(env: Env, args: any): Promise<any> {
  // Validate input
  const validatedArgs = validate(listMemoriesSchema, args);

  try {
    // Build query with filters
    let query = `
      SELECT id, text, type, source, tags, created_at
      FROM memories
      WHERE 1=1
    `;
    const bindings: any[] = [];

    if (validatedArgs.type) {
      query += ` AND type = ?`;
      bindings.push(validatedArgs.type);
    }

    if (validatedArgs.source) {
      query += ` AND source = ?`;
      bindings.push(validatedArgs.source);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(validatedArgs.limit, validatedArgs.offset);

    // Execute query
    const dbResults = await env.DB.prepare(query).bind(...bindings).all();

    // Format results
    const results = dbResults.results.map((row) => ({
      id: row.id,
      text: row.text,
      type: row.type,
      source: row.source,
      tags: row.tags ? JSON.parse(row.tags) : [],
      created_at: row.created_at,
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.length} memories.`,
        },
      ],
      result: results,
    };
  } catch (error) {
    console.error('Error listing memories:', error);
    throw new Error(`Failed to list memories: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}