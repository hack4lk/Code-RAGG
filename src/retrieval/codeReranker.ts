import { SearchResult } from "./types.js";
import "dotenv/config";
import { scoreDocument } from "./reranker.js";
import { config } from "../infrastructure/configSchema.js";

const CODE_RERANK_THRESHOLD = config.reranking.codeThreshold;

const CODE_SIMILARITY_SCORE = config.reranking.codeSimilarityScore;

const DISABLE_RERANKER = config.reranking.disabled;

export interface CodeRerankerResult extends SearchResult {
  rerankerScore: number;
}

export async function rerankCode(
  question: string,
  documents: SearchResult[],
  preserveRelationships = false,
): Promise<CodeRerankerResult[]> {
  const results: CodeRerankerResult[] = [];

  for (const document of documents) {
    let score: number;
    
    if (DISABLE_RERANKER) {
      // Skip LLM reranking and use semantic similarity as score
      score = document.score ?? 0;
    } else {
      // Use cross-encoder reranker
      score = await scoreDocument(question, document.content);
    }

    results.push({
      ...document,
      rerankerScore: score,
    } as CodeRerankerResult);
  }

  return results
    .filter((result) => {
      // Explicit relationship searches should keep
      // graph-confirmed callers and callees even when
      // their source code scores poorly on its own.
      if (
        preserveRelationships &&
        (result.retrieval?.includes("caller") ||
          result.retrieval?.includes("callee"))
      ) {
        return true;
      }

      // Filter: Keep relationship results or results with good semantic OR good reranker score
      const hasGoodSemantic = result.score && result.score >= CODE_SIMILARITY_SCORE;
      const hasGoodReranker = result.rerankerScore >= CODE_RERANK_THRESHOLD;
      return hasGoodSemantic || hasGoodReranker; // Either signal is sufficient
    })
    .sort((a, b) => b.rerankerScore - a.rerankerScore);
}
