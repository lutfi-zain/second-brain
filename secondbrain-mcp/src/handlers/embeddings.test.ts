import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEmbedding } from './embeddings';
import { EmbeddingError } from '../utils/errors';

// Mock the AI binding
const mockAi = {
  run: vi.fn(),
};

describe('Embeddings Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    it('should generate an embedding for valid text', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockAi.run.mockResolvedValue({
        data: [mockEmbedding],
      });

      const result = await generateEmbedding(mockAi as any, 'Test text');

      expect(mockAi.run).toHaveBeenCalledWith('@cf/baai/bge-base-en-v1.5', {
        text: ['Test text'],
      });
      expect(result).toEqual(mockEmbedding);
    });

    it('should throw an error when AI returns no data', async () => {
      mockAi.run.mockResolvedValue({
        data: [],
      });

      await expect(generateEmbedding(mockAi as any, 'Test text')).rejects.toThrow(
        EmbeddingError
      );
    });

    it('should throw an error when AI call fails', async () => {
      const error = new Error('AI service unavailable');
      mockAi.run.mockRejectedValue(error);

      await expect(generateEmbedding(mockAi as any, 'Test text')).rejects.toThrow(
        'AI service unavailable'
      );
    });

    it('should handle different text inputs correctly', async () => {
      const mockEmbedding = [0.2, 0.3, 0.4, 0.5, 0.6];
      mockAi.run.mockResolvedValue({
        data: [mockEmbedding],
      });

      const testCases = [
        'Short text',
        'This is a much longer text with multiple sentences and various content.',
        'Text with special chars: @#$%^&*()',
        'Text with unicode: 😊 🚀 Hello 世界',
      ];

      for (const text of testCases) {
        const result = await generateEmbedding(mockAi as any, text);
        expect(mockAi.run).toHaveBeenCalledWith('@cf/baai/bge-base-en-v1.5', {
          text: [text],
        });
        expect(result).toEqual(mockEmbedding);
        vi.clearAllMocks();
      }
    });
  });
});