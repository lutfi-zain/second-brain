import { Ai } from '@cloudflare/workers-types';
import { EmbeddingError, logInfo, logError, safeAsyncOperation } from '../utils/errors';

/**
 * Generates an embedding for a given text using the Workers AI model.
 * @param ai The AI binding.
 * @param text The text to embed.
 * @returns A promise that resolves to an array of numbers representing the embedding.
 */
export async function generateEmbedding(ai: Ai, text: string): Promise<number[]> {
  return safeAsyncOperation(async () => {
    logInfo('Embedding Generation', 'Starting embedding generation', {
      textLength: text.length,
      textPreview: text.substring(0, 100)
    });

    const response = await ai.run('@cf/baai/bge-base-en-v1.5', {
      text: [text]
    });

    if (response.data && response.data.length > 0) {
      const embedding = response.data[0];

      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new EmbeddingError('Invalid embedding data returned from AI model.');
      }

      logInfo('Embedding Generation', 'Embedding generated successfully', {
        embeddingLength: embedding.length
      });

      return embedding;
    } else {
      throw new EmbeddingError('No embedding data returned from AI model.');
    }
  }, 'Embedding Generation', {
    textLength: text.length,
    textPreview: text.substring(0, 100)
  });
}
