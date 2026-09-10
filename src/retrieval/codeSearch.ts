import "dotenv/config";

import pool from "../core/db.js";
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

  const result = await pool.query(
    `
    SELECT
      id,
      file_path,
      symbol_name,
      symbol_type,
      start_line,
      end_line,
      content,
      metadata,
      1 - (embedding <=> $1::vector) AS similarity
    FROM code_chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector
    LIMIT $2
    `,
    [JSON.stringify(embedding), limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    source: 'code' as const,
    location: row.file_path,
    filePath: row.file_path,
    symbolName: row.symbol_name,
    symbolType: row.symbol_type,
    startLine: row.start_line,
    endLine: row.end_line,
    content: row.content,
    score: Number(row.similarity),
    metadata: row.metadata,
    retrieval: ['semantic'] as const,
  }));
}
