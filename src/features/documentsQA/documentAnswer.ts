import { hybridDocumentSearch, expandContext, SearchResult } from "../../retrieval/documentSearch.js";
import { rerank } from "../../retrieval/reranker.js";
import { generateAnswer } from "../../core/embeddings.js";
import { config } from "../../infrastructure/configSchema.js";
import { logger } from "../../infrastructure/logger.js";

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
  logger.debug("Processing document question", { question });
  
  // 1. Hybrid search (semantic + keyword fallback)
  const documents = await hybridDocumentSearch(question, PG_SEARCH_LIMIT);
  logger.debug(`Hybrid search returned ${documents.length} documents`);

  if (documents.length === 0) {
    logger.debug("No documents found");
    return {
      answer: "I don't have enough information in the documentation to answer that.",
      sources: [],
    };
  }

  // 2. Rerank
  const rerankedDocuments = await rerank(question, documents);
  logger.debug(`Reranked ${rerankedDocuments.length} documents`);

  // 3. Filter by threshold
  const relevantDocuments = rerankedDocuments
    .filter((doc) => (doc.rerankerScore ?? 0) >= RERANK_THRESHOLD)
    .slice(0, MAX_CONTEXT_DOCS);
  
  logger.debug(`Filtered to ${relevantDocuments.length} documents above threshold`);

  if (relevantDocuments.length === 0) {
    logger.debug("No documents passed threshold");
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
