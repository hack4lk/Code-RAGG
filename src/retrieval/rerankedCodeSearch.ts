import { hybridCodeSearch } from "./hybridCodeSearch.js";
import { rerankCode, CodeRerankerResult } from "./codeReranker.js";
import 'dotenv/config';

const SEMANTIC_SEARCH_LIMIT = process.env.SEMANTIC_SEARCH_LIMIT ? parseInt(process.env.SEMANTIC_SEARCH_LIMIT) : 5;

function isRelationshipQuestion(query: string): boolean {
  const normalized = query.toLowerCase();

  return (
    normalized.includes("what calls") ||
    normalized.includes("who calls") ||
    (normalized.includes("what does") && normalized.includes("call")) ||
    normalized.includes("who uses") ||
    (normalized.includes("where is") && normalized.includes("used"))
  );
}

export async function rerankedCodeSearch(
  query: string,
  semanticLimit = SEMANTIC_SEARCH_LIMIT,
): Promise<CodeRerankerResult[]> {
  const candidates = await hybridCodeSearch(query, semanticLimit);

  const relationshipQuestion = isRelationshipQuestion(query);

  return rerankCode(query, candidates, relationshipQuestion);
}
