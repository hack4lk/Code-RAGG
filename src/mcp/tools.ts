// src/mcp/tools.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { hybridDocumentSearch } from "../retrieval/documentSearch.js";
import { searchCode } from "../retrieval/codeSearch.js";
import { logger } from "../infrastructure/logger.js";
import { SearchResult } from "../retrieval/types.js";

/**
 * Tool: search_documents
 * Search the document index using hybrid search (vector + keyword)
 */
const SEARCH_DOCUMENTS_TOOL: Tool = {
  name: "search_documents",
  description:
    "Search the documentation index using hybrid search (vector similarity + keyword matching). Returns ranked document chunks with relevance scores.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query or question about the documentation",
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (default: 10)",
        default: 10,
      },
      search_type: {
        type: "string",
        enum: ["vector", "keyword", "hybrid"],
        description:
          "Type of search: 'vector' for semantic similarity, 'keyword' for text matching, 'hybrid' for both (default: hybrid)",
        default: "hybrid",
      },
    },
    required: ["query"],
  },
};

/**
 * Tool: search_code
 * Search the code index using semantic + symbol search
 */
const SEARCH_CODE_TOOL: Tool = {
  name: "search_code",
  description:
    "Search the code index by semantic meaning or symbol name. Returns code chunks with symbols, relationships, and architectural metadata.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Search query or symbol name (e.g., 'authentication', 'parseCodeFile')",
      },
      limit: {
        type: "number",
        description: "Maximum number of code chunks to return (default: 10)",
        default: 10,
      },
      include_callers: {
        type: "boolean",
        description:
          "Include functions/methods that call the found symbols (default: false)",
        default: false,
      },
      include_callees: {
        type: "boolean",
        description:
          "Include functions/methods that are called by the found symbols (default: false)",
        default: false,
      },
    },
    required: ["query"],
  },
};

/**
 * Handler for search_documents tool
 */
async function handleSearchDocuments(
  args: Record<string, unknown>,
): Promise<unknown> {
  const query = args.query as string;
  const limit = (args.limit as number) || 10;
  const searchType = (args.search_type as string) || "hybrid";

  if (!query) {
    throw new Error("'query' parameter is required");
  }

  logger.debug("MCP search_documents", { query, limit, searchType });

  // Use existing hybridDocumentSearch function
  // Note: search_type parameter is not used by the current function,
  // but we accept it for future extensibility
  const results = await hybridDocumentSearch(query, limit);

  return {
    status: "success",
    query,
    result_count: results.length,
    results: results.map((doc) => ({
      id: doc.id,
      location: doc.location,
      documentChunkIndex: doc.documentChunkIndex,
      content: doc.content,
      score: doc.score,
      retrieval: doc.retrieval,
    })),
  };
}

/**
 * Handler for search_code tool
 */
async function handleSearchCode(
  args: Record<string, unknown>,
): Promise<unknown> {
  const query = args.query as string;
  const limit = (args.limit as number) || 10;
  const includeCallers = (args.include_callers as boolean) || false;
  const includeCallees = (args.include_callees as boolean) || false;

  if (!query) {
    throw new Error("'query' parameter is required");
  }

  logger.debug("MCP search_code", {
    query,
    limit,
    includeCallers,
    includeCallees,
  });

  // Use existing searchCode function
  const results = await searchCode(query, limit);

  return {
    status: "success",
    query,
    include_callers: includeCallers,
    include_callees: includeCallees,
    result_count: results.length,
    results: results.map((code: SearchResult) => ({
      id: code.id,
      filePath: code.filePath,
      symbolName: code.symbolName,
      symbolType: code.symbolType,
      startLine: code.startLine,
      endLine: code.endLine,
      content: code.content,
      score: code.score,
      retrieval: code.retrieval,
      metadata: code.metadata,
    })),
  };
}

/**
 * Register all search tools with the MCP server
 */
export async function registerSearchTools(
  server: Server,
  tools: Map<string, Tool>,
  toolHandlers: Map<
    string,
    (args: Record<string, unknown>) => Promise<unknown>
  >,
): Promise<void> {
  logger.info("Registering MCP search tools");

  // Register search_documents tool
  tools.set("search_documents", SEARCH_DOCUMENTS_TOOL);
  toolHandlers.set("search_documents", handleSearchDocuments);

  // Register search_code tool
  tools.set("search_code", SEARCH_CODE_TOOL);
  toolHandlers.set("search_code", handleSearchCode);

  logger.info("MCP tools registered", { count: tools.size });
}
