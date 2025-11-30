import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSearchMemory, handleListMemories } from './search';
import { Env } from '../mcp/types';

// Mock environment bindings
const createMockEnv = (): Env => ({
  DB: {
    prepare: vi.fn(),
  },
  VECTORIZE: {
    upsert: vi.fn(),
    getById: vi.fn(),
    deleteById: vi.fn(),
    query: vi.fn(),
  },
  AI: {
    run: vi.fn(),
  },
});

// Mock embedding generation
vi.mock('./embeddings', () => ({
  generateEmbedding: vi.fn(),
}));

// Mock vector operations
vi.mock('../utils/vectorize', () => ({
  searchVectors: vi.fn(),
}));

import { generateEmbedding } from './embeddings';
import { searchVectors } from '../utils/vectorize';

describe('Search Handler', () => {
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
  });

  describe('handleSearchMemory', () => {
    const validSearchInput = {
      query: 'test search query',
      limit: 5,
    };

    const validSearchInputWithFilters = {
      query: 'test search query',
      limit: 10,
      filters: {
        type: 'note',
        source: 'manual',
        tags: ['important'],
      },
    };

    it('should successfully search memories with valid query', async () => {
      // Mock embedding generation
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      // Mock vector search results
      const mockVectorResults = {
        matches: [
          {
            id: 'vector1',
            score: 0.95,
            metadata: {
              memory_id: 123,
              text: 'A test memory about something important',
              type: 'note',
              source: 'manual',
              tags: ['important'],
            },
          },
          {
            id: 'vector2',
            score: 0.87,
            metadata: {
              memory_id: 124,
              text: 'Another test memory',
              type: 'idea',
              source: 'gemini',
              tags: ['test'],
            },
          },
        ],
      };
      vi.mocked(searchVectors).mockResolvedValue(mockVectorResults);

      // Mock database query
      const mockDbResults = {
        results: [
          {
            id: 123,
            text: 'A test memory about something important',
            type: 'note',
            source: 'manual',
            tags: '["important"]',
            created_at: 1704067200,
          },
          {
            id: 124,
            text: 'Another test memory',
            type: 'idea',
            source: 'gemini',
            tags: '["test"]',
            created_at: 1704067300,
          },
        ],
      };
      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockResolvedValue(mockDbResults),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      const result = await handleSearchMemory(mockEnv, validSearchInput);

      expect(generateEmbedding).toHaveBeenCalledWith(mockEnv.AI, validSearchInput.query);
      expect(searchVectors).toHaveBeenCalledWith(
        mockEnv.VECTORIZE,
        mockEmbedding,
        validSearchInput.limit,
        undefined
      );
      expect(mockDbPrepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, text, type, source, tags, created_at FROM memories WHERE id IN (?,?)')
      );

      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: 'Found 2 memories matching your query.',
          },
        ],
        result: {
          results: [
            {
              id: 123,
              text: 'A test memory about something important',
              score: 0.95,
              type: 'note',
              source: 'manual',
              tags: ['important'],
              created_at: 1704067200,
            },
            {
              id: 124,
              text: 'Another test memory',
              score: 0.87,
              type: 'idea',
              source: 'gemini',
              tags: ['test'],
              created_at: 1704067300,
            },
          ],
        },
      });
    });

    it('should search memories with filters', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockVectorResults = {
        matches: [
          {
            id: 'vector1',
            score: 0.95,
            metadata: {
              memory_id: 123,
              text: 'A test memory about something important',
              type: 'note',
              source: 'manual',
              tags: ['important'],
            },
          },
        ],
      };
      vi.mocked(searchVectors).mockResolvedValue(mockVectorResults);

      const mockDbResults = {
        results: [
          {
            id: 123,
            text: 'A test memory about something important',
            type: 'note',
            source: 'manual',
            tags: '["important"]',
            created_at: 1704067200,
          },
        ],
      };
      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockResolvedValue(mockDbResults),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      await handleSearchMemory(mockEnv, validSearchInputWithFilters);

      expect(searchVectors).toHaveBeenCalledWith(
        mockEnv.VECTORIZE,
        mockEmbedding,
        validSearchInputWithFilters.limit,
        {
          type: 'note',
          source: 'manual',
          tags: ['important'],
        }
      );
    });

    it('should return empty results when no matches found', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockVectorResults = {
        matches: [], // No matches
      };
      vi.mocked(searchVectors).mockResolvedValue(mockVectorResults);

      const result = await handleSearchMemory(mockEnv, validSearchInput);

      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: 'No memories found matching your search query.',
          },
        ],
        result: {
          results: [],
        },
      });
    });

    it('should handle matches without memory IDs gracefully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockVectorResults = {
        matches: [
          {
            id: 'vector1',
            score: 0.95,
            metadata: {
              text: 'A test memory about something important',
              type: 'note',
              source: 'manual',
              // Missing memory_id
            },
          },
        ],
      };
      vi.mocked(searchVectors).mockResolvedValue(mockVectorResults);

      const result = await handleSearchMemory(mockEnv, validSearchInput);

      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: 'No memories found matching your search query.',
          },
        ],
        result: {
          results: [],
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockVectorResults = {
        matches: [
          {
            id: 'vector1',
            score: 0.95,
            metadata: {
              memory_id: 123,
              text: 'A test memory about something important',
              type: 'note',
              source: 'manual',
              tags: ['important'],
            },
          },
        ],
      };
      vi.mocked(searchVectors).mockResolvedValue(mockVectorResults);

      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      await expect(handleSearchMemory(mockEnv, validSearchInput)).rejects.toThrow(
        'Failed to search memories: Database connection failed'
      );
    });

    it('should throw error for invalid input', async () => {
      const invalidInput = {
        query: '', // Empty query should be invalid
        limit: -5, // Invalid limit
      };

      await expect(handleSearchMemory(mockEnv, invalidInput)).rejects.toThrow();
    });
  });

  describe('handleListMemories', () => {
    const validListInput = {
      limit: 10,
      offset: 0,
    };

    const validListInputWithFilters = {
      limit: 5,
      offset: 0,
      type: 'note',
      source: 'manual',
    };

    it('should successfully list memories', async () => {
      const mockDbResults = {
        results: [
          {
            id: 123,
            text: 'A test memory about something important',
            type: 'note',
            source: 'manual',
            tags: '["important"]',
            created_at: 1704067200,
          },
          {
            id: 124,
            text: 'Another test memory',
            type: 'idea',
            source: 'gemini',
            tags: null,
            created_at: 1704067300,
          },
        ],
      };
      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockResolvedValue(mockDbResults),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      const result = await handleListMemories(mockEnv, validListInput);

      expect(mockDbPrepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, text, type, source, tags, created_at FROM memories WHERE 1=1 ORDER BY created_at DESC LIMIT ? OFFSET ?')
      );

      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: 'Found 2 memories.',
          },
        ],
        result: [
          {
            id: 123,
            text: 'A test memory about something important',
            type: 'note',
            source: 'manual',
            tags: ['important'],
            created_at: 1704067200,
          },
          {
            id: 124,
            text: 'Another test memory',
            type: 'idea',
            source: 'gemini',
            tags: [],
            created_at: 1704067300,
          },
        ],
      });
    });

    it('should list memories with filters', async () => {
      const mockDbResults = {
        results: [
          {
            id: 123,
            text: 'A test memory about something important',
            type: 'note',
            source: 'manual',
            tags: '["important"]',
            created_at: 1704067200,
          },
        ],
      };
      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockResolvedValue(mockDbResults),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      await handleListMemories(mockEnv, validListInputWithFilters);

      expect(mockDbPrepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, text, type, source, tags, created_at FROM memories WHERE 1=1 AND type = ? AND source = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      );
    });

    it('should handle empty results gracefully', async () => {
      const mockDbResults = {
        results: [],
      };
      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockResolvedValue(mockDbResults),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      const result = await handleListMemories(mockEnv, validListInput);

      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: 'Found 0 memories.',
          },
        ],
        result: [],
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      await expect(handleListMemories(mockEnv, validListInput)).rejects.toThrow(
        'Failed to list memories: Database connection failed'
      );
    });

    it('should throw error for invalid input', async () => {
      const invalidInput = {
        limit: -1, // Invalid limit
        offset: -1, // Invalid offset
      };

      await expect(handleListMemories(mockEnv, invalidInput)).rejects.toThrow();
    });

    it('should handle pagination correctly', async () => {
      const paginationInput = {
        limit: 5,
        offset: 10, // Skip first 10 results
      };

      const mockDbResults = {
        results: [
          {
            id: 133,
            text: 'A paginated memory',
            type: 'note',
            source: 'manual',
            tags: null,
            created_at: 1704067400,
          },
        ],
      };
      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockResolvedValue(mockDbResults),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      await handleListMemories(mockEnv, paginationInput);

      expect(mockDbPrepare).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC LIMIT ? OFFSET ?')
      );
      expect(mockDbPrepare().bind).toHaveBeenCalledWith(5, 10);
    });
  });
});