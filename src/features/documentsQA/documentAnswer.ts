import { searchDocuments, expandContext, SearchResult } from "../../retrieval/documentSearch.js";
import { rerank } from "../../retrieval/reranker.js";
import { generateAnswer } from "../../core/embeddings.js";

const RERANK_THRESHOLD = process.env.RERANK_THRESHOLD
  ? parseFloat(process.env.RERANK_THRESHOLD)
  : 0.05;
const PG_SEARCH_LIMIT = process.env.PG_SEARCH_LIMIT
  ? parseInt(process.env.PG_SEARCH_LIMIT)
  : 10;
const MAX_CONTEXT_DOCS = process.env.MAX_CONTEXT_DOCS
  ? parseInt(process.env.MAX_CONTEXT_DOCS)
  : 3;

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
 *   1. Search documents by vector similarity
 *   2. Rerank results by relevance
 *   3. Filter by threshold
 *   4. Generate answer using top documents
 */
export async function answerDocumentQuestion(
  question: string
): Promise<DocumentQAResult> {
  // 1. Vector search
  const documents = await searchDocuments(question, PG_SEARCH_LIMIT);

  if (documents.length === 0) {
    return {
      answer: "I don't have enough information in the documentation to answer that.",
      sources: [],
    };
  }

  // 2. Rerank
  const rerankedDocuments = await rerank(question, documents);

  // 3. Filter by threshold
  const relevantDocuments = rerankedDocuments
    .filter((doc) => (doc.rerankerScore ?? 0) >= RERANK_THRESHOLD)
    .slice(0, MAX_CONTEXT_DOCS);

  if (relevantDocuments.length === 0) {
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
      file: doc.source,
      chunkIndex: doc.chunkIndex,
    })),
  };
}
