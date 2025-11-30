import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStoreMemory, handleDeleteMemory } from './memory';
import { ValidationError, DatabaseError, NotFoundError } from '../utils/errors';
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
  upsertVector: vi.fn(),
  deleteVectorsByIds: vi.fn(),
}));

import { generateEmbedding } from './embeddings';
import { upsertVector, deleteVectorsByIds } from '../utils/vectorize';

describe('Memory Handler', () => {
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
  });

  describe('handleStoreMemory', () => {
    const validInput = {
      text: 'This is a test memory',
      type: 'note',
      source: 'manual',
      tags: ['test', 'example'],
      metadata: { priority: 'high' },
    };

    it('should successfully store a memory with valid input', async () => {
      // Mock successful embedding generation
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      // Mock database operations
      const mockInsertResult = { meta: { changes: 1, last_row_id: 123 } };
      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue(mockInsertResult),
        }),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      // Mock vector operations
      vi.mocked(upsertVector).mockResolvedValue(undefined);

      const result = await handleStoreMemory(mockEnv, validInput);

      expect(generateEmbedding).toHaveBeenCalledWith(mockEnv.AI, validInput.text);
      expect(mockDbPrepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO memories')
      );
      expect(upsertVector).toHaveBeenCalledWith(
        mockEnv.VECTORIZE,
        'memory_123_' + expect.any(Number),
        mockEmbedding,
        expect.objectContaining({
          memory_id: 123,
          text: validInput.text,
          type: validInput.type,
          source: validInput.source,
          tags: validInput.tags,
        })
      );

      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: 'Memory stored successfully with ID: 123',
          },
        ],
        result: {
          success: true,
          memory_id: 123,
          vector_id: expect.stringMatching(/^memory_123_\d+$/),
        },
      });
    });

    it('should throw ValidationError for invalid input', async () => {
      const invalidInput = {
        text: '', // Empty text should be invalid
        type: 'invalid-type',
      };

      await expect(handleStoreMemory(mockEnv, invalidInput)).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalInput = {
        text: 'Minimal memory',
        type: 'idea',
      };

      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockInsertResult = { meta: { changes: 1, last_row_id: 456 } };
      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue(mockInsertResult),
        }),
      });
      mockEnv.DB.prepare = mockDbPrepare;
      vi.mocked(upsertVector).mockResolvedValue(undefined);

      const result = await handleStoreMemory(mockEnv, minimalInput);

      expect(result.result.memory_id).toBe(456);
      expect(upsertVector).toHaveBeenCalledWith(
        mockEnv.VECTORIZE,
        'memory_456_' + expect.any(Number),
        mockEmbedding,
        expect.objectContaining({
          memory_id: 456,
          text: minimalInput.text,
          type: minimalInput.type,
          source: null, // Should be null when not provided
          tags: undefined, // Should be undefined when not provided
        })
      );
    });

    it('should throw DatabaseError when database insertion fails', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        }),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      await expect(handleStoreMemory(mockEnv, validInput)).rejects.toThrow(
        DatabaseError
      );
    });

    it('should throw DatabaseError when no rows are inserted', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      vi.mocked(generateEmbedding).mockResolvedValue(mockEmbedding);

      const mockInsertResult = { meta: { changes: 0 } };
      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue(mockInsertResult),
        }),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      await expect(handleStoreMemory(mockEnv, validInput)).rejects.toThrow(
        DatabaseError
      );
    });
  });

  describe('handleDeleteMemory', () => {
    const validDeleteInput = {
      memory_id: 123,
    };

    it('should successfully delete an existing memory', async () => {
      // Mock vector lookup
      const mockVectorResult = { vector_id: 'memory_123_1234567890' };
      const mockDbPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockVectorResult),
          }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
          }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
          }),
        });

      mockEnv.DB.prepare = mockDbPrepare;

      // Mock vector deletion
      vi.mocked(deleteVectorsByIds).mockResolvedValue(undefined);

      const result = await handleDeleteMemory(mockEnv, validDeleteInput);

      expect(mockDbPrepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT vector_id FROM memory_vectors')
      );
      expect(deleteVectorsByIds).toHaveBeenCalledWith(
        mockEnv.VECTORIZE,
        ['memory_123_1234567890']
      );
      expect(result).toMatchObject({
        content: [
          {
            type: 'text',
            text: 'Memory with ID 123 deleted successfully',
          },
        ],
        result: {
          success: true,
        },
      });
    });

    it('should throw ValidationError for invalid memory ID', async () => {
      const invalidInput = {
        memory_id: 'not-a-number',
      };

      await expect(handleDeleteMemory(mockEnv, invalidInput)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw NotFoundError when memory does not exist', async () => {
      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null), // No vector found
        }),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      await expect(handleDeleteMemory(mockEnv, validDeleteInput)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should handle database errors gracefully', async () => {
      const mockDbPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error('Database connection failed')),
        }),
      });
      mockEnv.DB.prepare = mockDbPrepare;

      await expect(handleDeleteMemory(mockEnv, validDeleteInput)).rejects.toThrow(
        DatabaseError
      );
    });

    it('should throw DatabaseError when no rows are deleted from memories table', async () => {
      // Mock vector lookup success
      const mockVectorResult = { vector_id: 'memory_123_1234567890' };
      const mockDbPrepare = vi.fn()
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(mockVectorResult),
          }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
          }),
        })
        .mockReturnValueOnce({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }), // No memories deleted
          }),
        });

      mockEnv.DB.prepare = mockDbPrepare;
      vi.mocked(deleteVectorsByIds).mockResolvedValue(undefined);

      await expect(handleDeleteMemory(mockEnv, validDeleteInput)).rejects.toThrow(
        DatabaseError
      );
    });
  });
});