import { Env, StoreMemoryInput, DeleteMemoryInput } from '../mcp/types';
import { validate } from '../utils/validation';
import { storeMemorySchema, deleteMemorySchema } from '../utils/validation';
import { generateEmbedding } from './embeddings';
import { upsertVector, deleteVectorsByIds } from '../utils/vectorize';
import {
  ValidationError,
  DatabaseError,
  VectorizeError,
  formatErrorResponse,
  logInfo,
  logError,
  safeAsyncOperation,
  safeJsonParse
} from '../utils/errors';

/**
 * Handles storing a new memory.
 * @param env The environment bindings (DB, VECTORIZE, AI).
 * @param args The input arguments for the store_memory tool.
 * @returns A promise that resolves to the stored memory result.
 */
export async function handleStoreMemory(env: Env, args: any): Promise<any> {
  return safeAsyncOperation(async () => {
    // Validate input
    let validatedArgs;
    try {
      validatedArgs = validate(storeMemorySchema, args);
    } catch (error) {
      throw new ValidationError(`Invalid input: ${error instanceof Error ? error.message : 'Unknown validation error'}`);
    }

    logInfo('Store Memory', 'Starting memory storage', {
      type: validatedArgs.type,
      textLength: validatedArgs.text.length,
      source: validatedArgs.source,
      tagsCount: validatedArgs.tags?.length || 0
    });

    // Generate embedding for the text
    const embedding = await generateEmbedding(env.AI, validatedArgs.text);

    // Insert into D1 database
    const timestamp = Math.floor(Date.now() / 1000);
    const tagsJson = validatedArgs.tags ? JSON.stringify(validatedArgs.tags) : null;
    const metadataJson = validatedArgs.metadata ? JSON.stringify(validatedArgs.metadata) : null;

    let insertResult;
    try {
      insertResult = await env.DB.prepare(`
        INSERT INTO memories (text, type, source, tags, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        validatedArgs.text,
        validatedArgs.type,
        validatedArgs.source || null,
        tagsJson,
        metadataJson,
        timestamp,
        timestamp
      ).run();
    } catch (error) {
      throw new DatabaseError(`Failed to insert memory into database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!insertResult.meta.changes || insertResult.meta.changes === 0) {
      throw new DatabaseError('No changes made when inserting memory into database');
    }

    const memoryId = insertResult.meta.last_row_id!;

    // Create a unique vector ID
    const vectorId = `memory_${memoryId}_${Date.now()}`;

    // Insert vector metadata into D1
    try {
      await env.DB.prepare(`
        INSERT INTO memory_vectors (memory_id, vector_id, embedding_model, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(
        memoryId,
        vectorId,
        '@cf/baai/bge-base-en-v1.5', // The embedding model we're using
        timestamp
      ).run();
    } catch (error) {
      throw new DatabaseError(`Failed to insert vector metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Upsert the vector into Vectorize
    try {
      await upsertVector(
        env.VECTORIZE,
        vectorId,
        embedding,
        {
          memory_id: memoryId,
          text: validatedArgs.text,
          type: validatedArgs.type,
          source: validatedArgs.source,
          tags: validatedArgs.tags,
          created_at: timestamp
        }
      );
    } catch (error) {
      throw new VectorizeError(`Failed to upsert vector: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    logInfo('Store Memory', 'Memory stored successfully', {
      memoryId,
      vectorId,
      type: validatedArgs.type
    });

    return {
      content: [
        {
          type: 'text',
          text: `Memory stored successfully with ID: ${memoryId}`,
        },
      ],
      result: {
        success: true,
        memory_id: memoryId,
        vector_id: vectorId,
      },
    };
  }, 'Store Memory', {
    inputType: args?.type,
    inputTextLength: args?.text?.length
  });
}

/**
 * Handles deleting a memory.
 * @param env The environment bindings (DB, VECTORIZE).
 * @param args The input arguments for the delete_memory tool.
 * @returns A promise that resolves to the deletion result.
 */
export async function handleDeleteMemory(env: Env, args: any): Promise<any> {
  return safeAsyncOperation(async () => {
    // Validate input
    let validatedArgs;
    try {
      validatedArgs = validate(deleteMemorySchema, args);
    } catch (error) {
      throw new ValidationError(`Invalid input: ${error instanceof Error ? error.message : 'Unknown validation error'}`);
    }

    logInfo('Delete Memory', 'Starting memory deletion', {
      memoryId: validatedArgs.memory_id
    });

    // First, get the vector ID for the memory
    let vectorResult;
    try {
      vectorResult = await env.DB.prepare(`
        SELECT vector_id FROM memory_vectors WHERE memory_id = ?
      `).bind(validatedArgs.memory_id).first();
    } catch (error) {
      throw new DatabaseError(`Failed to query vector metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!vectorResult) {
      throw new NotFoundError(`Memory with ID ${validatedArgs.memory_id} not found`);
    }

    // Delete from Vectorize
    try {
      await deleteVectorsByIds(env.VECTORIZE, [vectorResult.vector_id]);
    } catch (error) {
      throw new VectorizeError(`Failed to delete vector: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Delete from memory_vectors table
    try {
      await env.DB.prepare(`
        DELETE FROM memory_vectors WHERE memory_id = ?
      `).bind(validatedArgs.memory_id).run();
    } catch (error) {
      throw new DatabaseError(`Failed to delete vector metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Delete from memories table
    let deleteResult;
    try {
      deleteResult = await env.DB.prepare(`
        DELETE FROM memories WHERE id = ?
      `).bind(validatedArgs.memory_id).run();
    } catch (error) {
      throw new DatabaseError(`Failed to delete memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!deleteResult.meta.changes || deleteResult.meta.changes === 0) {
      throw new DatabaseError(`No changes made when deleting memory with ID ${validatedArgs.memory_id}`);
    }

    logInfo('Delete Memory', 'Memory deleted successfully', {
      memoryId: validatedArgs.memory_id,
      vectorId: vectorResult.vector_id
    });

    return {
      content: [
        {
          type: 'text',
          text: `Memory with ID ${validatedArgs.memory_id} deleted successfully`,
        },
      ],
      result: {
        success: true,
      },
    };
  }, 'Delete Memory', {
    memoryId: args?.memory_id
  });
}