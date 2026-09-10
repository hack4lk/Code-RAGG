import { hybridDocumentSearch, expandContext, SearchResult } from "../../retrieval/documentSearch.js";
import { rerank } from "../../retrieval/reranker.js";
import { generateAnswer } from "../../core/embeddings.js";
import { config } from "../../infrastructure/configSchema.js";

const RERANK_THRESHOLD = config.reranking.documentThreshold;
const PG_SEARCH_LIMIT = config.search.pgLimit;
const MAX_CONTEXT_DOCS = config.search.maxContextDocs;

export interface DocumentQAResult {
  answer: string;
  sources: Array<{
    file: string;
    chunkIndex: number;
  }>;
}

/**
 * Answer a question about documentation
 * Pipeline:
 *   1. Hybrid document search (vector + keyword fallback)
 *   2. Rerank results by relevance
 *   3. Filter by threshold
 *   4. Generate answer using top documents
 */
export async function answerDocumentQuestion(
  question: string
): Promise<DocumentQAResult> {
  console.log(`\n[DocumentQA] Processing question: "${question}"`);
  
  // 1. Hybrid search (semantic + keyword fallback)
  const documents = await hybridDocumentSearch(question, PG_SEARCH_LIMIT);
  console.log(`[DocumentQA] Hybrid search returned ${documents.length} documents`);

  if (documents.length === 0) {
    console.log(`[DocumentQA] No documents found, returning empty answer`);
    return {
      answer: "I don't have enough information in the documentation to answer that.",
      sources: [],
    };
  }

  // 2. Rerank
  const rerankedDocuments = await rerank(question, documents);
  console.log(`[DocumentQA] Reranked ${rerankedDocuments.length} documents`);
  rerankedDocuments.forEach((doc, i) => {
    console.log(`  [${i + 1}] Score: ${(doc.rerankerScore ?? 0).toFixed(3)} | Source: ${doc.source}`);
  });

  // 3. Filter by threshold
  const relevantDocuments = rerankedDocuments
    .filter((doc) => (doc.rerankerScore ?? 0) >= RERANK_THRESHOLD)
    .slice(0, MAX_CONTEXT_DOCS);
  
  console.log(`[DocumentQA] After threshold filter (>= ${RERANK_THRESHOLD}): ${relevantDocuments.length} documents`);

  if (relevantDocuments.length === 0) {
    console.log(`[DocumentQA] No documents passed rerank threshold, returning empty answer`);
    return {
      answer: "I don't have enough information in the documentation to answer that.",
      sources: [],
    };
  }

  // 4. Expand context and generate answer
  const expandedDocuments = await expandContext(relevantDocuments);
  const answer = await generateAnswer(question, expandedDocuments);

  return {
    answer,
    sources: expandedDocuments.map((doc: SearchResult) => ({
      file: doc.location,
      chunkIndex: doc.documentChunkIndex ?? 0,
    })),
  };
}
