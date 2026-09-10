import { hybridCodeSearch } from "./hybridCodeSearch.js";
import { rerankCode, CodeRerankerResult } from "./codeReranker.js";
import { config } from "../infrastructure/configSchema.js";
import 'dotenv/config';

const SEMANTIC_SEARCH_LIMIT = config.search.semanticLimit;

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
