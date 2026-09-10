/**
 * Unified Search Result Types
 * 
 * This file defines the canonical result types for all search operations.
 * Both document and code searches return results conforming to these types,
 * enabling unified reranking, filtering, and scoring pipelines.
 * 
 * Key principles:
 * - Single interface (SearchResult) for all search results
 * - Type discriminator (source: 'document' | 'code') for variant handling
 * - Optional fields for source-specific metadata
 * - Normalized scoring (0.0-1.0 range)
 */

/**
 * Unified search result returned by any search operation
 * 
 * This type represents either a document chunk or a code symbol,
 * with normalized fields that work across both types.
 */
export interface SearchResult {
  /**
   * Unique identifier within the result set
   * Document: chunk ID from database
   * Code: symbol ID from database
   */
  id: number | string;

  /**
   * Which type of result this is (discriminator for type narrowing)
   */
  source: 'document' | 'code';

  /**
   * File path or source location
   * Document: document filename (e.g., 'api.md')
   * Code: full file path (e.g., 'src/core/db.ts')
   */
  location: string;

  /**
   * Main content/body of the result
   * Document: chunk content
   * Code: code snippet/content
   */
  content: string;

  /**
   * Relevance score from initial search (0.0-1.0)
   * Document: vector similarity score
   * Code: semantic similarity score
   */
  score: number;

  /**
   * Relevance score after LLM reranking (0.0-1.0, optional)
   * Higher scores = more relevant
   */
  rerankerScore?: number;

  /**
   * For distance-based searches, how far from query
   * Used in some vector DB implementations
   */
  distance?: number;

  /**
   * BGE embedding score (for certain rerankers)
   */
  bgeScore?: number;

  // ============================================================================
  // Document-specific fields (populated when source === 'document')
  // ============================================================================

  /**
   * Chunk index within the document
   * Used to reconstruct document context (chunks before/after)
   */
  documentChunkIndex?: number;

  // ============================================================================
  // Code-specific fields (populated when source === 'code')
  // ============================================================================

  /**
   * Symbol name (function, class, method, variable)
   */
  symbolName?: string;

  /**
   * Symbol type (function, class, interface, variable, etc.)
   */
  symbolType?: string;

  /**
   * Starting line number in source file
   */
  startLine?: number;

  /**
   * Ending line number in source file
   */
  endLine?: number;

  /**
   * File path (alias for location, for code results)
   * @deprecated Use location instead
   */
  filePath?: string;

  // ============================================================================
  // General metadata
  // ============================================================================

  /**
   * How this result was retrieved (for hybrid searches)
   * Document: always ['semantic'] or ['keyword'] or ['semantic', 'keyword']
   * Code: combination of ['semantic', 'target', 'caller', 'callee']
   */
  retrieval?: Array<'semantic' | 'keyword' | 'target' | 'caller' | 'callee'>;

  /**
   * Structured metadata (flexible, source-specific)
   * Document: { chunkMetadata: ... }
   * Code: { calls, externalCalls, dependencies, ... }
   */
  metadata?: Record<string, unknown>;
}

/**
 * Type guard to narrow SearchResult to document type
 */
export function isDocumentResult(result: SearchResult): result is SearchResult & { documentChunkIndex: number } {
  return result.source === 'document';
}

/**
 * Type guard to narrow SearchResult to code type
 */
export function isCodeResult(result: SearchResult): result is SearchResult & { symbolName: string; symbolType: string; startLine: number; endLine: number } {
  return result.source === 'code';
}

/**
 * Reranker interface - works with unified SearchResult
 */
export interface Reranker {
  /**
   * Score and rerank results based on query relevance
   * @param query User's search query
   * @param results Initial search results
   * @returns Results with rerankerScore populated
   */
  rerank(query: string, results: SearchResult[]): Promise<SearchResult[]>;
}

/**
 * Reranker result type (input to filter/generation stages)
 */
export interface RerankerOutput {
  results: SearchResult[];
  rerankedAt: Date;
}
