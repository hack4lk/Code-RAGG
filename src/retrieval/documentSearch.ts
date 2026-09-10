import { createEmbedding } from "../core/embeddings";
import pool from "../core/db";
import fs from "node:fs/promises";
import path from "node:path";
import "dotenv/config";

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

// Get full document content for top-scoring documents
export async function getFullDocumentsForAnswer(
  chunks: SearchResult[],
): Promise<{ filename: string; content: string }[]> {
  const RERANK_THRESHOLD = parseFloat(process.env.RERANK_THRESHOLD || "0.05");
  const MAX_CONTEXT_DOCS = parseInt(process.env.MAX_CONTEXT_DOCS || "3");
  const MAX_DOCUMENT_SIZE = parseInt(process.env.MAX_DOCUMENT_SIZE || "10240");
  const DOCUMENTS_DIR = process.env.DOCUMENTS_DIR;

  if (!DOCUMENTS_DIR) {
    throw new Error("DOCUMENTS_DIR environment variable is not set");
  }

  // Filter chunks by rerank threshold and group by filename
  const fileMap = new Map<string, SearchResult>();
  
  for (const chunk of chunks) {
    // Check if chunk score meets threshold
    if (chunk.score < RERANK_THRESHOLD) {
      continue;
    }

    // Keep only the highest scoring chunk per file
    if (!fileMap.has(chunk.source) || chunk.score > fileMap.get(chunk.source)!.score) {
      fileMap.set(chunk.source, chunk);
    }
  }

  // Sort by score and take top N documents
  const topFiles = Array.from(fileMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXT_DOCS);

  // Read full file content for each document
  const results: { filename: string; content: string }[] = [];

  for (const chunk of topFiles) {
    try {
      const filePath = path.join(DOCUMENTS_DIR, chunk.source);
      let content = await fs.readFile(filePath, "utf-8");

      // Truncate to max size
      if (content.length > MAX_DOCUMENT_SIZE) {
        content = content.substring(0, MAX_DOCUMENT_SIZE) + "\n...[truncated]";
      }

      results.push({
        filename: chunk.source,
        content,
      });
    } catch (error) {
      console.error(`Failed to read document ${chunk.source}:`, error);
      // Continue with next file instead of failing
    }
  }

  return results;
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
