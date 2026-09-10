/**
 * Shared query intent detection utilities
 * Detects whether a query is asking about relationships (callers/callees)
 */

import { codeRepository } from "../core/repository.js";
import { CALLERS_KEYWORDS, CALLEES_KEYWORDS } from "./constants.js";

/**
 * Simple relationship detection for basic queries
 * Used when you only need to know if this is a relationship question
 * 
 * Returns true if query contains keywords indicating it's asking about
 * who calls X, what calls X, where is X used, etc.
 */
export function isRelationshipQuestion(query: string): boolean {
  const normalized = query.toLowerCase();

  return (
    normalized.includes("what calls") ||
    normalized.includes("who calls") ||
    (normalized.includes("what does") && normalized.includes("call")) ||
    normalized.includes("who uses") ||
    (normalized.includes("where is") && normalized.includes("used"))
  );
}

/**
 * Advanced query intent detection with symbol extraction
 * Parses query to determine:
 * - What symbol the user is asking about (if any)
 * - What type of relationship they want (callers/callees/both)
 * 
 * Returns:
 * - symbol: Name of the symbol being queried, or null if not found in DB
 * - intent: Type of relationship ("callers" | "callees" | "both")
 */
export async function parseQueryIntent(
  query: string,
): Promise<{ symbol: string | null; intent: "callers" | "callees" | "both" }> {
  const normalized = query.toLowerCase();
  
  // Detect relationship intent
  let intent: "callers" | "callees" | "both" = "both";
  
  const hasCallersKeywords = Array.from(CALLERS_KEYWORDS).some(kw => normalized.includes(kw));
  const hasCalleesKeywords = Array.from(CALLEES_KEYWORDS).some(kw => normalized.includes(kw));
  
  // More specific detection for common patterns
  if (normalized.includes("what calls") || normalized.includes("who calls")) {
    intent = "callers";
  } else if (normalized.includes("what does") && normalized.includes("call")) {
    intent = "callees";
  } else if (normalized.includes("who uses") || (normalized.includes("where is") && normalized.includes("used"))) {
    intent = "callers";
  } else if (hasCalleesKeywords && !hasCallersKeywords) {
    intent = "callees";
  } else if (hasCallersKeywords && !hasCalleesKeywords) {
    intent = "callers";
  }
  
  // Extract symbol: remove all stop words and relationship keywords
  const allNoise = new Set([
    ...CALLERS_KEYWORDS,
    ...CALLEES_KEYWORDS,
    'function', 'component', 'class', 'method', 'interface', 'type',
    'what', 'how', 'when', 'why', 'can', 'could', 'should', 'would'
  ]);
  const tokens = normalized
    .split(/\s+/)
    .filter(token => !allNoise.has(token) && token.length > 0);
  
  // Try to find exact match in DB, prioritizing longer tokens
  const sortedTokens = tokens.sort((a, b) => b.length - a.length);
  
  for (const token of sortedTokens) {
    const result = await codeRepository.findBySymbol(token);
    if (result) {
      return { symbol: result.symbolName, intent };
    }
  }
  
  return { symbol: null, intent };
}
