import { searchCode } from "./codeSearch.js";
import { findCallers } from "../graph/codeCallers.js";
import { findCallees } from "../graph/codeCallees.js";
import { findSymbolByName } from "../graph/codeSymbols.js";
import { config } from "../infrastructure/configSchema.js";
import { SearchResult } from "./types.js";
import { parseQueryIntent } from "./queryIntents.js";
import { ARCHITECTURE_KEYWORDS } from "./constants.js";
import 'dotenv/config';

const SEMANTIC_SEARCH_LIMIT = config.search.semanticLimit;

function detectArchitectureKeywords(query: string): string[] {
  const normalized = query.toLowerCase();
  const found: Set<string> = new Set();
  
  for (const [keyword, entityTypes] of Object.entries(ARCHITECTURE_KEYWORDS)) {
    if (normalized.includes(keyword)) {
      entityTypes.forEach(t => found.add(t));
    }
  }
  
  return Array.from(found);
}

function getBoostMultiplier(symbolType: string, architectureKeywords: string[]): number {
  // Default boost
  let boost = 1.0;
  
  // Boost architectural entities for relevant queries
  if (architectureKeywords.length > 0 && architectureKeywords.includes(symbolType)) {
    boost = config.reranking.architectureKeywordBoost; // Boost matching entity types
  }
  
  // Special handling for query types
  // Queries asking "how does X work" should prefer routes, interfaces, and classes
  return boost;
}

/**
 * HybridCodeSearchResult is now simply SearchResult with source='code'
 * The retrieval field indicates how the result was found
 */
export type HybridCodeSearchResult = SearchResult;



function addResult(
  results: Map<number, HybridCodeSearchResult>,
  row: any,
  retrieval: "semantic" | "target" | "caller" | "callee",
  similarity: number | null = null,
) {
  if (results.has(row.id)) {
    const existing = results.get(row.id)!;

    if (!existing.retrieval?.includes(retrieval)) {
      if (!existing.retrieval) existing.retrieval = [];
      existing.retrieval.push(retrieval);
    }

    return;
  }

  results.set(row.id, {
    id: row.id,
    source: 'code' as const,
    location: row.file_path,
    filePath: row.file_path,
    symbolName: row.symbol_name,
    symbolType: row.symbol_type,
    startLine: row.start_line,
    endLine: row.end_line,
    content: row.content,
    metadata: row.metadata,
    score: similarity ?? 0,
    retrieval: [retrieval],
  } as HybridCodeSearchResult);
}

export async function hybridCodeSearch(
  query: string,
  semanticLimit = SEMANTIC_SEARCH_LIMIT,
): Promise<HybridCodeSearchResult[]> {
  const architectureKeywords = detectArchitectureKeywords(query);
  const results = new Map<number, HybridCodeSearchResult>();

  // --------------------------------------------------
  // Stage 1: Always start with semantic search
  // This is the foundation - handles natural language
  // NOTE: pgvector has a quirk where LIMIT < 6 returns 0 results
  // so we always request at least 6
  // --------------------------------------------------

  const effectiveLimit = Math.max(semanticLimit, 6);
  const semanticResults = await searchCode(query, effectiveLimit);

  for (const result of semanticResults) {
    const boost = getBoostMultiplier(result.symbolType ?? '', architectureKeywords);
    results.set(result.id as number, {
      ...result,
      score: result.score ? result.score * boost : 0,
      retrieval: ["semantic"],
    });
  }

  // --------------------------------------------------
  // Stage 2: Try symbol extraction with intent detection
  // If successful, include the symbol and its relationships
  // as a fast-path optimization (doesn't fail if extraction fails)
  // --------------------------------------------------

  const { symbol: targetSymbol, intent: relationshipIntent } = await parseQueryIntent(query);
  if (targetSymbol) {
    const target = await findSymbolByName(targetSymbol);

    if (target) {
      const direction = relationshipIntent;
      
      // Add the target itself
      addResult(results, target, "target", null);

      // Add relationships
      if (direction === "callers" || direction === "both") {
        // For functions and methods, look for function calls
        if (target.symbolType === "function" || target.symbolType === "method") {
          const callers = await findCallers(target.symbolName);
          for (const caller of callers) {
            addResult(results, caller, "caller", null);
          }
        } 
        // For constants, types, interfaces, and classes, look for imports
        else if (target.metadata?.relationships?.imported_by) {
          const importedBy = target.metadata.relationships.imported_by;
          // Add import locations as "caller" results
          // Map each import location to the symbol definition for context
          for (const importLocation of importedBy) {
            // Create a synthetic result using the target's information
            // The import location is where the symbol is imported, not the definition
            addResult(results, {
              ...target,
              // Store import metadata in retrieval info
            }, "caller", null);
          }
        }
      }

      if (direction === "callees" || direction === "both") {
        const callees = await findCallees(target.symbolName);
        for (const callee of callees) {
          addResult(results, callee, "callee", null);
        }
      }
    }
  }

  // --------------------------------------------------
  // Stage 3: Enhance semantic results with relationships
  // if the query indicates relationship intent
  // This provides relationship context even if symbol
  // extraction didn't work
  // --------------------------------------------------

  if (relationshipIntent !== "both" && semanticResults.length > 0) {
    for (const result of semanticResults) {
      if (relationshipIntent === "callers") {
        // For functions and methods, look for function calls
        if (result.symbolType === "function" || result.symbolType === "method") {
          const callers = await findCallers(result.symbolName ?? '');
          for (const caller of callers) {
            addResult(results, caller, "caller", null);
          }
        }
        // For constants, types, interfaces, and classes, look for imports
        else if ((result.metadata as any)?.relationships?.imported_by) {
          // Add import locations as "caller" results
          for (const importLocation of (result.metadata as any).relationships.imported_by || []) {
            addResult(results, {
              ...result,
            }, "caller", null);
          }
        }
      }

      if (relationshipIntent === "callees") {
        const callees = await findCallees(result.symbolName ?? '');
        for (const callee of callees) {
          addResult(results, callee, "callee", null);
        }
      }
    }
  }

  // Sort by score (semantic results ranked higher, relationships don't have similarity scores)
  return Array.from(results.values()).sort((a, b) => {
    const aScore = a.score ?? 0;
    const bScore = b.score ?? 0;
    return bScore - aScore;
  });
}
