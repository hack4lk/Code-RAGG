import "dotenv/config";

import { codeRepository } from "../core/repository.js";
import { createEmbedding } from "../core/embeddings.js";
import { SearchResult } from "./types.js";

/**
 * CodeSearchResult is an alias for SearchResult with source='code' discriminator
 * For backward compatibility, this is exported as well
 */
export type CodeSearchResult = SearchResult & { source: 'code' };

export async function searchCode(
  query: string,
  limit = 10,
): Promise<SearchResult[]> {
  const embedding = await createEmbedding(query);

  const results = await codeRepository.searchByEmbedding(embedding, limit);

  return results.map((row) => ({
    id: row.id,
    source: 'code' as const,
    location: row.filePath,
    filePath: row.filePath,
    symbolName: row.symbolName,
    symbolType: row.symbolType,
    startLine: row.startLine,
    endLine: row.endLine,
    content: row.content,
    score: row.similarity,
    metadata: row.metadata,
    retrieval: ['semantic'] as const,
  }));
}
