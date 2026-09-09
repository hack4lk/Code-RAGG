import { createEmbedding } from "./embeddings";
import pool from "./db";

export interface SearchResult {
  id: number;
  source: string;
  chunkIndex: number;
  content: string;
  distance: number;
  score: number;
  rerankerScore?: number;
  bgeScore?: number;
}

export async function expandContext(
  documents: SearchResult[],
  radius: number = 1,
): Promise<SearchResult[]> {
  const expanded = new Map<number, SearchResult>();

  for (const document of documents) {
    const result = await pool.query(
      `SELECT
        dc.id,
        d.filename AS source,
        dc.chunk_index,
        dc.content
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.filename = $1
        AND dc.chunk_index BETWEEN $2 AND $3
      ORDER BY dc.chunk_index`,
      [
        document.source,
        Math.max(0, document.chunkIndex - radius),
        document.chunkIndex + radius,
      ],
    );

    for (const row of result.rows) {
      const original = documents.find((doc) => doc.id === row.id);

      expanded.set(row.id, {
        id: row.id,
        source: row.source,
        chunkIndex: row.chunk_index,
        content: row.content,

        // Preserve retrieval scores if this
        // was one of the originally retrieved chunks.
        distance: original?.distance ?? 0,
        score: original?.score ?? 0,
        rerankerScore: original?.rerankerScore,
      });
    }
  }

  return Array.from(expanded.values()).sort((a, b) => {
    if (a.source !== b.source) {
      return a.source.localeCompare(b.source);
    }

    return a.chunkIndex - b.chunkIndex;
  });
}

export async function searchDocuments(
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  console.log("limiting search to", limit);
  const embedding = await createEmbedding(query);

  const result = await pool.query(
    `SELECT dc.id, d.filename AS source, dc.chunk_index, dc.content, dc.embedding <=> $1::vector AS distance
        FROM document_chunks dc
        JOIN documents d on dc.document_id = d.id
        ORDER BY embedding <=> $1::vector
        LIMIT $2`,
    [JSON.stringify(embedding), limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    source: row.source,
    chunkIndex: row.chunk_index,
    content: row.content,
    distance: row.distance,
    score: 1 - row.distance,
  }));
}
