import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  JSONRPCResponse,
  JSONRPCRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { Env } from './types';
import { ALL_TOOLS } from './tools';
import { handleStoreMemory, handleDeleteMemory } from '../handlers/memory';
import { handleSearchMemory, handleListMemories } from '../handlers/search';
import { formatErrorResponse, logInfo, logError, AppError } from '../utils/errors';

export function createMcpServer(env: Env): Server {
  const server = new Server(
    {
      name: 'second-brain-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: ALL_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.input_schema,
      })),
    };
  });

  // Handle tool call request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'store_memory':
          return await handleStoreMemory(env, args);

        case 'search_memory':
          return await handleSearchMemory(env, args);

        case 'list_memories':
          return await handleListMemories(env, args);

        case 'delete_memory':
          return await handleDeleteMemory(env, args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logError('MCP Tool Call', error, {
        toolName: name,
        args: args ? 'provided' : 'none'
      });

      // If it's an AppError, let it propagate to be handled by the individual handlers
      if (error instanceof AppError) {
        throw error;
      }

      // For unknown errors, return a formatted error response
      return formatErrorResponse(error);
    }
  });

  return server;
}

// Helper function to handle requests in the Hono context
export async function handleMcpRequest(
  env: Env,
  request: Request
): Promise<Response> {
  const server = createMcpServer(env);

  // For web-based MCP, we need to adapt the request format
  // This is a simplified approach - in a real implementation you might need more sophisticated handling
  try {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'GET' && url.pathname === '/mcp') {
      // Handle tools/list directly
      return new Response(JSON.stringify({
        tools: ALL_TOOLS.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.input_schema,
        })),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST' && url.pathname === '/mcp/call') {
      // Handle tools/call
      const body = await request.json();
      const { tool, arguments: args } = body;

      const callRequest: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: tool,
          arguments: args,
        },
      };

      const response = await server.request(callRequest);
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle raw MCP protocol (for future compatibility)
    if (method === 'POST' && url.pathname === '/mcp') {
      const body = await request.text();
      const rpcRequest: JSONRPCRequest = JSON.parse(body);

      if (rpcRequest.method === 'tools/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: rpcRequest.id,
          result: {
            tools: ALL_TOOLS.map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.input_schema,
            })),
          },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (rpcRequest.method === 'tools/call') {
        const { name, arguments: args } = rpcRequest.params;
        let result;

        try {
          switch (name) {
            case 'store_memory':
              result = await handleStoreMemory(env, args);
              break;
            case 'search_memory':
              result = await handleSearchMemory(env, args);
              break;
            case 'list_memories':
              result = await handleListMemories(env, args);
              break;
            case 'delete_memory':
              result = await handleDeleteMemory(env, args);
              break;
            default:
              throw new Error(`Unknown tool: ${name}`);
          }

          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: rpcRequest.id,
            result,
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id: rpcRequest.id,
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Internal error',
            },
          }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500,
          });
        }
      }

      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id: rpcRequest.id,
        error: {
          code: -32601,
          message: 'Method not found',
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error('MCP Request error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}