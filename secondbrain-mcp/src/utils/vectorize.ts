import { VectorizeIndex } from '@cloudflare/workers-types';

/**
 * Upserts a vector into the Vectorize index.
 * @param vectorize The Vectorize index binding.
 * @param id The unique ID for the vector.
 * @param values The embedding values.
 * @param metadata The metadata to associate with the vector.
 */
export async function upsertVector(
  vectorize: VectorizeIndex,
  id: string,
  values: number[],
  metadata: Record<string, any>
): Promise<void> {
  try {
    await vectorize.upsert([{ id, values, metadata }]);
  } catch (error) {
    console.error(`Error upserting vector with id ${id}:`, error);
    throw new Error('Failed to upsert vector.');
  }
}

/**
 * Searches for vectors in the Vectorize index.
 * @param vectorize The Vectorize index binding.
 * @param queryVector The vector to search for.
 * @param topK The number of results to return.
 * @param filter Optional filter to apply to the search.
 * @returns A promise that resolves to the search results.
 */
export async function searchVectors(
  vectorize: VectorizeIndex,
  queryVector: number[],
  topK: number,
  filter?: Record<string, any>
) {
  try {
    return await vectorize.query(queryVector, {
      topK,
      returnMetadata: true,
      filter
    });
  } catch (error) {
    console.error('Error searching vectors:', error);
    throw new Error('Failed to search vectors.');
  }
}

/**
 * Deletes vectors from the Vectorize index by their IDs.
 * @param vectorize The Vectorize index binding.
 * @param ids An array of vector IDs to delete.
 */
export async function deleteVectorsByIds(vectorize: VectorizeIndex, ids: string[]): Promise<void> {
  try {
    await vectorize.deleteByIds(ids);
  } catch (error) {
    console.error(`Error deleting vectors with ids ${ids.join(', ')}:`, error);
    throw new Error('Failed to delete vectors.');
  }
}
