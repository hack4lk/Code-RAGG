/**
 * Response formatting utilities for API endpoints
 * Normalizes search results into consistent JSON formats for API responses
 */

import { SearchResult } from "../retrieval/types.js";

/**
 * Format search results for API responses
 * Normalizes both document and code results into a consistent structure
 * 
 * The response format adapts based on the source type:
 * - Documents: includes file, chunk index
 * - Code: includes file, symbol info, line numbers, retrieval method
 */
export function formatSearchResultsForAPI(results: SearchResult[]) {
  return results.map((result) => {
    const base = {
      file: result.location,
      score: result.score,
      rerankerScore: result.rerankerScore,
    };

    // Add source-specific fields
    if (result.source === 'document') {
      return {
        ...base,
        chunk: result.documentChunkIndex,
      };
    } else {
      // code
      return {
        ...base,
        symbol: result.symbolName,
        type: result.symbolType,
        startLine: result.startLine,
        endLine: result.endLine,
        retrieval: result.retrieval,
      };
    }
  });
}

/**
 * Format a single search result for logging/debugging
 */
export function formatSearchResultForLogging(
  result: SearchResult,
): Record<string, any> {
  if (result.source === 'document') {
    return {
      file: result.location,
      chunk: result.documentChunkIndex,
      vectorScore: result.score,
      rerankerScore: result.rerankerScore,
    };
  } else {
    return {
      file: result.location,
      symbol: result.symbolName,
      type: result.symbolType,
      startLine: result.startLine,
      endLine: result.endLine,
      vectorScore: result.score,
      rerankerScore: result.rerankerScore,
    };
  }
}
