import { hybridCodeSearch } from "./hybridCodeSearch.js";
import { rerankCode, CodeRerankerResult } from "./codeReranker.js";
import { config } from "../infrastructure/configSchema.js";
import { isRelationshipQuestion } from "./queryIntents.js";
import 'dotenv/config';

const SEMANTIC_SEARCH_LIMIT = config.search.semanticLimit;

export async function rerankedCodeSearch(
  query: string,
  semanticLimit = SEMANTIC_SEARCH_LIMIT,
): Promise<CodeRerankerResult[]> {
  const candidates = await hybridCodeSearch(query, semanticLimit);

  const relationshipQuestion = isRelationshipQuestion(query);

  return rerankCode(query, candidates, relationshipQuestion);
}
