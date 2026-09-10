import { searchCode } from "./codeSearch.js";
import { findCallers, findImportLocations } from "../graph/codeCallers.js";
import { findCallees } from "../graph/codeCallees.js";
import { findSymbolByName } from "../graph/codeSymbols.js";
import pool from "../core/db.js";
import { config } from "../infrastructure/configSchema.js";
import { SearchResult } from "./types.js";
import 'dotenv/config';

const SEMANTIC_SEARCH_LIMIT = config.search.semanticLimit;

// Stop words to filter from query
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'with', 'as', 'by', 'at', 'on',
  'in', 'of', 'for', 'to', 'from', 'about', 'this', 'that', 'is', 'are',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
]);

// Relationship keywords that indicate query intent
const CALLERS_KEYWORDS = new Set([
  'calls', 'called', 'uses', 'used', 'who', 'where', 'callers', 'calling'
]);

const CALLEES_KEYWORDS = new Set([
  'call', 'calls', 'called', 'does', 'do', 'callees', 'calls'
]);

// Architecture keywords that should boost relevant entity types
const ARCHITECTURE_KEYWORDS = {
  api: ["route", "interface", "type"],
  endpoint: ["route"],
  interface: ["interface", "type"],
  contract: ["interface", "type"],
  flow: ["function", "method", "route"],
  architecture: ["class", "interface", "route"],
  design: ["class", "interface"],
  config: ["constant"],
  configuration: ["constant"],
  setup: ["constant"],
  middleware: ["method", "function", "constant"],
  handler: ["method", "function"],
  ingest: ["function", "method", "class"],
  ingestion: ["function", "method", "class"],
  pipeline: ["function", "method", "class"],
  process: ["function", "method", "class"],
};

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
    boost = 1.5; // Boost matching entity types
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

// Parse query to extract symbol name and relationship intent
// Returns both the symbol and the type of relationship to search for
async function parseQueryIntent(
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
  const allNoise = new Set([...STOP_WORDS, ...CALLERS_KEYWORDS, ...CALLEES_KEYWORDS, 'function', 'component', 'class', 'method', 'interface', 'type', 'what', 'how', 'when', 'why', 'can', 'could', 'should', 'would']);
  const tokens = normalized
    .split(/\s+/)
    .filter(token => !allNoise.has(token) && token.length > 0);
  
  // Try to find exact match in DB, prioritizing longer tokens
  const sortedTokens = tokens.sort((a, b) => b.length - a.length);
  
  for (const token of sortedTokens) {
    const result = await pool.query(
      `SELECT symbol_name FROM code_chunks WHERE LOWER(symbol_name) = $1 LIMIT 1`,
      [token]
    );
    if (result.rows.length > 0) {
      return { symbol: result.rows[0].symbol_name, intent };
    }
  }
  
  return { symbol: null, intent };
}

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
        if (target.symbol_type === "function" || target.symbol_type === "method") {
          const callers = await findCallers(target.symbol_name);
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
        const callees = await findCallees(target.symbol_name);
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
