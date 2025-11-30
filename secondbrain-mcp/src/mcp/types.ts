import { z } from 'zod';
import {
    storeMemorySchema,
    searchMemorySchema,
    listMemoriesSchema,
    deleteMemorySchema
} from '../utils/validation';

// TypeScript types inferred from Zod schemas

export type StoreMemoryInput = z.infer<typeof storeMemorySchema>;
export type SearchMemoryInput = z.infer<typeof searchMemorySchema>;
export type ListMemoriesInput = z.infer<typeof listMemoriesSchema>;
export type DeleteMemoryInput = z.infer<typeof deleteMemorySchema>;

// Environment bindings for the Cloudflare Worker
export type Env = {
    DB: D1Database;
    VECTORIZE: VectorizeIndex;
    AI: any; // Using `any` for now as Ai type might not be fully available
    CACHE: KVNamespace;
};

// Represents a memory as returned by the search API
export type MemorySearchResult = {
    id: number;
    text: string;
    score: number;
    type: string;
    source?: string;
    tags?: string[];
    created_at: number;
};

// Represents a memory as stored in the database
export type MemoryRecord = {
    id: number;
    text: string;
    type: string;
    source?: string;
    tags?: string; // Stored as a JSON string
    metadata?: string; // Stored as a JSON string
    created_at: number;
    updated_at: number;
};
