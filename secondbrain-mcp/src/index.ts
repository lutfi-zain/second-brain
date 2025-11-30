import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './mcp/types';
import { handleMcpRequest } from './mcp/server';
import { RateLimiter, RATE_LIMIT_CONFIGS } from './utils/rateLimiter';

const app = new Hono<{ Bindings: Env }>();

// Setup rate limiting for MCP endpoints
const rateLimitMiddleware = async (c: any, next: () => Promise<void>) => {
  const limiter = new RateLimiter(c.env.CACHE, RATE_LIMIT_CONFIGS.PRODUCTION, 'mcp_rate_limit');

  const identifier = c.req.raw.headers.get('cf-connecting-ip') ||
                     c.req.raw.headers.get('x-real-ip') ||
                     'unknown';

  const rateLimitResult = await limiter.checkLimit(identifier);

  // Add rate limit headers to response
  c.res.headers.set('X-RateLimit-Limit', RATE_LIMIT_CONFIGS.PRODUCTION.maxRequests.toString());
  c.res.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
  c.res.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

  if (!rateLimitResult.allowed) {
    c.res.headers.set('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString());

    return c.json({
      error: 'Rate limit exceeded',
      message: `Too many requests. Try again after ${new Date(rateLimitResult.resetTime).toISOString()}`,
      retryAfter: rateLimitResult.resetTime,
      retryAfterFormatted: rateLimitResult.resetTimeFormatted,
    }, 429);
  }

  await next();
};

// Setup CORS middleware
app.use('*', cors({
  origin: '*', // Allow all origins for now, can be restricted later
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Accept'],
}));

// Apply rate limiting to MCP endpoints
app.use('/mcp', rateLimitMiddleware);
app.use('/api/call', rateLimitMiddleware);

// Main MCP endpoint
app.all('/mcp', async (c) => {
  const response = await handleMcpRequest(c.env, c.req.raw);
  return response;
});

// MCP call endpoint for REST-like debugging
app.post('/api/call', async (c) => {
  const response = await handleMcpRequest(c.env, c.req.raw);
  return response;
});

// Optional: Add a simple health check endpoint
app.get('/', (c) => {
  return c.text('Second Brain MCP Server is running.');
});

export default app;
