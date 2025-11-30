import { describe, it, expect, vi } from 'vitest';
import { validate, storeMemorySchema, searchMemorySchema, listMemoriesSchema, deleteMemorySchema } from './validation';

describe('Validation Schemas', () => {
  describe('storeMemorySchema', () => {
    it('should validate valid store memory input', () => {
      const validInput = {
        text: 'This is a test memory',
        type: 'note',
        source: 'manual',
        tags: ['test', 'validation'],
        metadata: { priority: 'high' },
      };

      const result = validate(storeMemorySchema, validInput);
      expect(result).toEqual(validInput);
    });

    it('should validate store memory input with only required fields', () => {
      const validInput = {
        text: 'This is a test memory',
        type: 'learning',
      };

      const result = validate(storeMemorySchema, validInput);
      expect(result).toEqual(validInput);
    });

    it('should reject empty text', () => {
      const invalidInput = {
        text: '',
        type: 'note',
      };

      expect(() => validate(storeMemorySchema, invalidInput)).toThrow(
        'Input validation failed: Text cannot be empty.'
      );
    });

    it('should reject invalid memory type', () => {
      const invalidInput = {
        text: 'This is a test memory',
        type: 'invalid_type',
      };

      expect(() => validate(storeMemorySchema, invalidInput)).toThrow();
    });

    it('should accept all valid memory types', () => {
      const validTypes = ['note', 'research', 'survey', 'idea', 'decision', 'backlog', 'learning'];
      const baseInput = {
        text: 'This is a test memory',
      };

      for (const type of validTypes) {
        const validInput = { ...baseInput, type };
        const result = validate(storeMemorySchema, validInput);
        expect(result.type).toBe(type);
      }
    });
  });

  describe('searchMemorySchema', () => {
    it('should validate valid search memory input', () => {
      const validInput = {
        query: 'test search query',
        limit: 10,
        filters: {
          type: 'note',
          source: 'manual',
          tags: ['test'],
        },
      };

      const result = validate(searchMemorySchema, validInput);
      expect(result).toEqual(validInput);
    });

    it('should validate search memory input with only required fields', () => {
      const validInput = {
        query: 'test search query',
      };

      const result = validate(searchMemorySchema, validInput);
      expect(result.query).toBe('test search query');
      expect(result.limit).toBe(5); // default value
    });

    it('should reject empty query', () => {
      const invalidInput = {
        query: '',
      };

      expect(() => validate(searchMemorySchema, invalidInput)).toThrow(
        'Input validation failed: Query cannot be empty.'
      );
    });

    it('should apply default values', () => {
      const validInput = {
        query: 'test search query',
      };

      const result = validate(searchMemorySchema, validInput);
      expect(result.limit).toBe(5);
      expect(result.filters).toBeUndefined();
    });
  });

  describe('listMemoriesSchema', () => {
    it('should validate valid list memories input', () => {
      const validInput = {
        type: 'note',
        source: 'manual',
        limit: 20,
        offset: 5,
      };

      const result = validate(listMemoriesSchema, validInput);
      expect(result).toEqual(validInput);
    });

    it('should validate list memories input with no parameters', () => {
      const validInput = {};

      const result = validate(listMemoriesSchema, validInput);
      expect(result.limit).toBe(10); // default value
      expect(result.offset).toBe(0); // default value
      expect(result.type).toBeUndefined();
      expect(result.source).toBeUndefined();
    });

    it('should apply default values correctly', () => {
      const validInput = {};

      const result = validate(listMemoriesSchema, validInput);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });
  });

  describe('deleteMemorySchema', () => {
    it('should validate valid delete memory input', () => {
      const validInput = {
        memory_id: 123,
      };

      const result = validate(deleteMemorySchema, validInput);
      expect(result).toEqual(validInput);
    });

    it('should reject negative memory ID', () => {
      const invalidInput = {
        memory_id: -1,
      };

      expect(() => validate(deleteMemorySchema, invalidInput)).toThrow();
    });

    it('should reject zero memory ID', () => {
      const invalidInput = {
        memory_id: 0,
      };

      expect(() => validate(deleteMemorySchema, invalidInput)).toThrow();
    });

    it('should reject non-integer memory ID', () => {
      const invalidInput = {
        memory_id: 123.45,
      };

      expect(() => validate(deleteMemorySchema, invalidInput)).toThrow();
    });
  });

  describe('validate function', () => {
    it('should handle Zod validation errors', () => {
      const schema = storeMemorySchema;
      const invalidInput = {
        text: '',
        type: 'invalid_type',
      };

      expect(() => validate(schema, invalidInput)).toThrow('Input validation failed:');
    });

    it('should handle non-Zod errors', () => {
      const schema = storeMemorySchema;
      const validInput = {
        text: 'test',
        type: 'note',
      };

      // Mock a scenario where parse throws a non-Zod error
      const mockParse = vi.fn().mockImplementation(() => {
        throw new Error('Some other error');
      });

      // Create a mock schema with a broken parse method
      const mockSchema = {
        parse: mockParse,
      } as any;

      expect(() => validate(mockSchema, validInput)).toThrow('Some other error');
    });
  });
});