import { HybridCodeSearchResult } from "./hybridCodeSearch.js";
import "dotenv/config";
import { scoreDocument } from "./reranker.js";

const CODE_RERANK_THRESHOLD = process.env.CODE_RERANK_THRESHOLD
  ? parseFloat(process.env.CODE_RERANK_THRESHOLD)
  : 0.05;

const CODE_SIMILARITY_SCORE = process.env.CODE_SIMILARITY_SCORE
  ? parseFloat(process.env.CODE_SIMILARITY_SCORE)
  : 0.05;

const DISABLE_RERANKER = process.env.DISABLE_RERANKER === "true";

export interface CodeRerankerResult extends HybridCodeSearchResult {
  rerankerScore: number;
}

export async function rerankCode(
  question: string,
  documents: HybridCodeSearchResult[],
  preserveRelationships = false,
): Promise<CodeRerankerResult[]> {
  const results: CodeRerankerResult[] = [];

  for (const document of documents) {
    let score: number;
    
    if (DISABLE_RERANKER) {
      // Skip LLM reranking and use semantic similarity as score
      score = document.similarity ?? 0;
    } else {
      // Use cross-encoder reranker
      score = await scoreDocument(question, document.content);
    }

    results.push({
      ...document,
      rerankerScore: score,
    });
  }

  return results
    .filter((result) => {
      // Explicit relationship searches should keep
      // graph-confirmed callers and callees even when
      // their source code scores poorly on its own.
      if (
        preserveRelationships &&
        (result.retrieval.includes("caller") ||
          result.retrieval.includes("callee"))
      ) {
        return true;
      }

      // Filter: Keep relationship results or results with good semantic OR good reranker score
      const hasGoodSemantic = result.similarity && result.similarity >= CODE_SIMILARITY_SCORE;
      const hasGoodReranker = result.rerankerScore >= CODE_RERANK_THRESHOLD;
      return hasGoodSemantic || hasGoodReranker; // Either signal is sufficient
    })
    .sort((a, b) => b.rerankerScore - a.rerankerScore);
}
