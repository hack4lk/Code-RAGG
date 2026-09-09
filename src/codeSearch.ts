import "dotenv/config";

import pool from "./db.js";
import { createEmbedding } from "./embeddings.js";

export interface CodeSearchResult {
  id: number;
  filePath: string;
  symbolName: string;
  symbolType: string;
  startLine: number;
  endLine: number;
  content: string;
  metadata: {
    calls: Array<{
      name: string;
      filePath: string;
      symbolName: string;
      line: number;
    }>;
    externalCalls: string[];
    dependencies: string[];
  };
  similarity: number;
}

export async function searchCode(
  query: string,
  limit = 10,
): Promise<CodeSearchResult[]> {
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
    filePath: row.file_path,
    symbolName: row.symbol_name,
    symbolType: row.symbol_type,
    startLine: row.start_line,
    endLine: row.end_line,
    content: row.content,
    metadata: row.metadata,
    similarity: Number(row.similarity),
  }));
}
