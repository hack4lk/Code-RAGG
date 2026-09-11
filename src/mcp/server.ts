// src/mcp/server.ts
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { logger } from "../infrastructure/logger.js";
import { registerSearchTools } from "./tools.js";

// Log that server is starting
console.error("🚀 MCP Server process started");
console.error("📍 Working directory:", process.cwd());
console.error("📍 Node version:", process.version);
console.error("📍 Arguments:", process.argv);
console.error("📍 Environment NODE_ENV:", process.env.NODE_ENV);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Track registered tools
const tools = new Map<string, Tool>();

// Map of tool handlers (populated by registerSearchTools)
export const toolHandlers = new Map<
  string,
  (args: Record<string, unknown>) => Promise<unknown>
>();

/**
 * Initialize and start the MCP server
 */
async function main() {
  try {
    // Create the MCP server
    // @ts-ignore - Server constructor is marked deprecated but is the correct pattern
    const server = new Server(
      {
        name: "code-ragg-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Register search tools - pass the server object
    await registerSearchTools(server, tools, toolHandlers);

    // Handle tool listing
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug("MCP: Listing tools", { count: tools.size });
      return {
        tools: Array.from(tools.values()),
      };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const toolArgs = request.params.arguments || {};

      logger.debug("MCP: Tool called", { tool: toolName, args: toolArgs });

      const handler = toolHandlers.get(toolName);
      if (!handler) {
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${toolName}`,
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await handler(toolArgs);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error("MCP: Tool execution error", {
          tool: toolName,
          error: String(error),
        });
        return {
          content: [
            {
              type: "text",
              text: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Connect server to stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info("MCP server started and listening on stdio");

  } catch (error) {
    logger.error("MCP server startup failed", { error: String(error) });
    process.exit(1);
  }
}

main();
