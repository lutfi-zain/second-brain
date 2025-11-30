import { z } from 'zod';

// Schema for the `store_memory` tool input
export const storeMemorySchema = z.object({
  text: z.string().min(1, { message: "Text cannot be empty." }),
  type: z.enum(['note', 'research', 'survey', 'idea', 'decision', 'backlog', 'learning']),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

// Schema for the `search_memory` tool input
export const searchMemorySchema = z.object({
  query: z.string().min(1, { message: "Query cannot be empty." }),
  limit: z.number().int().positive().optional().default(5),
  filters: z.object({
    type: z.string().optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

// Schema for the `list_memories` tool input
export const listMemoriesSchema = z.object({
  type: z.string().optional(),
  source: z.string().optional(),
  limit: z.number().int().positive().optional().default(10),
  offset: z.number().int().nonnegative().optional().default(0),
});

// Schema for the `delete_memory` tool input
export const deleteMemorySchema = z.object({
  memory_id: z.number().int().positive(),
});

/**
 * A helper function to validate data against a Zod schema.
 * @param schema The Zod schema to validate against.
 * @param data The data to validate.
 * @returns The parsed and validated data.
 * @throws An error if validation fails.
 */
export function validate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
    try {
        return schema.parse(data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            // Re-throw with a more user-friendly message
            throw new Error(`Input validation failed: ${error.errors.map(e => e.message).join(', ')}`);
        }
        throw error;
    }
}
