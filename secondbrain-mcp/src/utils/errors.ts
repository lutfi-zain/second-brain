/**
 * Custom error classes for better error handling
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}

export class VectorizeError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}

export class EmbeddingError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

/**
 * Error response formatter for MCP responses
 */
export function formatErrorResponse(error: unknown): {
  content: Array<{ type: string; text: string }>;
  isError: boolean;
} {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

  return {
    content: [
      {
        type: 'text',
        text: `Error: ${errorMessage}`,
      },
    ],
    isError: true,
  };
}

/**
 * Centralized logger
 */
export function logInfo(context: string, message: string, additionalInfo?: Record<string, any>): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${context}: ${message}`);

  if (additionalInfo) {
    console.log('Additional context:', JSON.stringify(additionalInfo, null, 2));
  }
}

/**
 * Centralized error logger
 */
export function logError(context: string, error: unknown, additionalInfo?: Record<string, any>): void {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[${timestamp}] ${context}: ${errorMessage}`);

  if (errorStack) {
    console.error(`Stack trace: ${errorStack}`);
  }

  if (additionalInfo) {
    console.error('Additional context:', JSON.stringify(additionalInfo, null, 2));
  }
}

/**
 * Safe JSON parser with error handling
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    logError('JSON Parse', error, { input: jsonString });
    return defaultValue;
  }
}

/**
 * Async operation wrapper with error handling
 */
export async function safeAsyncOperation<T>(
  operation: () => Promise<T>,
  context: string,
  additionalInfo?: Record<string, any>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logError(context, error, additionalInfo);

    if (error instanceof AppError) {
      throw error;
    }

    // Wrap unknown errors in a generic AppError
    throw new AppError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      500,
      false
    );
  }
}