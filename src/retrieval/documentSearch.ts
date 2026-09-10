import { createEmbedding } from "../core/embeddings";
import { documentRepository } from "../core/repository";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../infrastructure/configSchema";
import { SearchResult } from "./types";
import { STOP_WORDS } from "./constants";
import "dotenv/config";

// Re-export SearchResult for backward compatibility
export type { SearchResult };

export async function expandContext(
  documents: SearchResult[],
  radius: number = 1,
): Promise<SearchResult[]> {
  const expanded = new Map<number | string, SearchResult>();

  for (const document of documents) {
    const result = await documentRepository.getExpandedContext(
      document.location,
      document.documentChunkIndex ?? 0,
      radius,
    );

    for (const row of result) {
      const original = documents.find((doc) => doc.id === row.id);

      expanded.set(row.id, {
        id: row.id,
        source: 'document',
        location: row.filename,
        documentChunkIndex: row.chunkIndex,
        content: row.content,

        // Preserve retrieval scores if this
        // was one of the originally retrieved chunks.
        distance: original?.distance ?? 0,
        score: original?.score ?? 0,
        rerankerScore: original?.rerankerScore,
        retrieval: original?.retrieval ?? ['semantic'],
      });
    }
  }

  return Array.from(expanded.values()).sort((a, b) => {
    if (a.location !== b.location) {
      return a.location.localeCompare(b.location);
    }

    return (a.documentChunkIndex ?? 0) - (b.documentChunkIndex ?? 0);
  });
}

// Get full document content for top-scoring documents
export async function getFullDocumentsForAnswer(
  chunks: SearchResult[],
): Promise<{ filename: string; content: string }[]> {
  const RERANK_THRESHOLD = config.reranking.documentThreshold;
  const MAX_CONTEXT_DOCS = config.search.maxContextDocs;
  const MAX_DOCUMENT_SIZE = config.search.maxDocumentSize;
  const DOCUMENTS_DIR = config.filesystem.documentsDir;

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
    if (!fileMap.has(chunk.location) || chunk.score > fileMap.get(chunk.location)!.score) {
      fileMap.set(chunk.location, chunk);
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
      const filePath = path.join(DOCUMENTS_DIR, chunk.location);
      let content = await fs.readFile(filePath, "utf-8");

      // Truncate to max size
      if (content.length > MAX_DOCUMENT_SIZE) {
        content = content.substring(0, MAX_DOCUMENT_SIZE) + "\n...[truncated]";
      }

      results.push({
        filename: chunk.location,
        content,
      });
    } catch (error) {
      console.error(`Failed to read document ${chunk.location}:`, error);
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

  const results = await documentRepository.searchByEmbedding(embedding, limit);

  return results.map((row) => ({
    id: row.id,
    source: 'document' as const,
    location: row.filename,
    documentChunkIndex: row.chunkIndex,
    content: row.content,
    distance: row.distance,
    score: 1 - row.distance,
    retrieval: ['semantic'] as const,
  }));
}

/**
 * Extract keywords from query by removing stop words and keeping meaningful terms
 * Filters for keywords that are likely to be specific and selective
 */
export function extractKeywords(query: string): string[] {
  const keywords = query
    .toLowerCase()
    .split(/\W+/)
    .filter(word => {
      // Keep words that are:
      // 1. Not empty
      // 2. Not stop words
      // 3. More than 4 characters (to avoid generic words like 'this')
      return word.length > 4 && !STOP_WORDS.has(word);
    });

  // Return unique keywords, sorted by length (longer = more specific)
  return Array.from(new Set(keywords)).sort((a, b) => b.length - a.length);
}

/**
 * Keyword search fallback when vector search doesn't find relevant results
 */
export async function searchDocumentsByKeyword(
  keywords: string[],
  limit = 10,
): Promise<SearchResult[]> {
  if (keywords.length === 0) {
    return [];
  }

  const results = await documentRepository.searchByKeyword(keywords, limit);

  return results.map((row) => ({
    id: row.id,
    source: 'document' as const,
    location: row.filename,
    documentChunkIndex: row.chunkIndex,
    content: row.content,
    distance: 0,
    score: Math.min(1, (row.keywordMatchCount / keywords.length) * 0.8), // Cap at 0.8 for keyword matches
    retrieval: ['keyword'] as const,
  }));
}

/**
 * Hybrid document search: combines vector similarity with keyword fallback
 * 1. Try semantic search first (always)
 * 2. Run keyword search for extracted keywords (always, if keywords found)
 * 3. Merge results intelligently, prioritizing semantic matches
 */
export async function hybridDocumentSearch(
  query: string,
  semanticLimit = 10,
): Promise<SearchResult[]> {
  console.log(`\n[Hybrid Search] Query: "${query}"`);
  
  // Stage 1: Vector similarity search
  const semanticResults = await searchDocuments(query, semanticLimit);
  console.log(`[Hybrid Search] Vector search returned ${semanticResults.length} results`);
  if (semanticResults.length > 0) {
    console.log(`[Hybrid Search] Top result score: ${semanticResults[0].score.toFixed(3)}`);
  }

  // Stage 2: Extract keywords and run keyword search
  const keywords = extractKeywords(query);
  console.log(`[Hybrid Search] Extracted keywords: ${keywords.join(', ')}`);
  
  if (keywords.length === 0) {
    console.log(`[Hybrid Search] No keywords extracted, returning ${semanticResults.length} semantic results`);
    return semanticResults;
  }

  // Always run keyword search when we have keywords
  // Use higher limit to find more keyword matches (keyword search is broader)
  const keywordLimit = Math.max(semanticLimit * 3, 30);
  console.log(`[Hybrid Search] Running keyword search with limit ${keywordLimit}...`);
  const keywordResults = await searchDocumentsByKeyword(keywords, keywordLimit);
  console.log(`[Hybrid Search] Keyword search returned ${keywordResults.length} results`);

  // Merge results intelligently:
  // - Semantic results are more reliable (higher score)
  // - Keyword results fill gaps and catch missed content
  const merged = new Map<string | number, SearchResult>();
  
  // Add semantic results first (higher priority)
  semanticResults.forEach(doc => merged.set(doc.id, doc));
  
  // Add keyword results that aren't already found by semantic search
  keywordResults.forEach(doc => {
    if (!merged.has(doc.id)) {
      merged.set(doc.id, doc);
    }
  });

  const finalResults = Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, semanticLimit);
    
  console.log(`[Hybrid Search] Final merged results: ${finalResults.length} chunks from ${new Set(finalResults.map(r => r.location)).size} documents`);
  return finalResults;
}
