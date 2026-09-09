import { searchCode, CodeSearchResult } from "./codeSearch.js";
import { findCallers } from "./codeCallers.js";
import { findCallees } from "./codeCallees.js";
import { findSymbolByName } from "./codeSymbols.js";
import 'dotenv/config';

const SEMANTIC_SEARCH_LIMIT = process.env.SEMANTIC_SEARCH_LIMIT ? parseInt(process.env.SEMANTIC_SEARCH_LIMIT) : 5;

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

export interface HybridCodeSearchResult extends Omit<
  CodeSearchResult,
  "similarity"
> {
  similarity: number | null;

  retrieval: ("semantic" | "target" | "caller" | "callee")[];
}

function getRelationshipDirection(
  query: string,
): "callers" | "callees" | "both" {
  const normalized = query.toLowerCase();

  if (normalized.includes("what does") && normalized.includes("call")) {
    return "callees";
  }

  if (normalized.includes("what calls") || normalized.includes("who calls")) {
    return "callers";
  }

  if (
    normalized.includes("who uses") ||
    (normalized.includes("where is") && normalized.includes("used"))
  ) {
    return "callers";
  }

  return "both";
}

function extractSymbolName(query: string): string | null {
  const patterns = [
    /what is ([a-zA-Z0-9_$]+)/i,
    /what's ([a-zA-Z0-9_$]+)/i,
    /what calls ([a-zA-Z0-9_$]+)/i,
    /who calls ([a-zA-Z0-9_$]+)/i,
    /what does ([a-zA-Z0-9_$]+) call/i,
    /who uses ([a-zA-Z0-9_$]+)/i,
    /where is ([a-zA-Z0-9_$]+) used/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function addResult(
  results: Map<number, HybridCodeSearchResult>,
  row: any,
  retrieval: "semantic" | "target" | "caller" | "callee",
  similarity: number | null = null,
) {
  if (results.has(row.id)) {
    const existing = results.get(row.id)!;

    if (!existing.retrieval.includes(retrieval)) {
      existing.retrieval.push(retrieval);
    }

    return;
  }

  results.set(row.id, {
    id: row.id,
    filePath: row.file_path,
    symbolName: row.symbol_name,
    symbolType: row.symbol_type,
    startLine: row.start_line,
    endLine: row.end_line,
    content: row.content,
    metadata: row.metadata,
    similarity,
    retrieval: [retrieval],
  });
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
    const boost = getBoostMultiplier(result.symbolType, architectureKeywords);
    results.set(result.id, {
      ...result,
      similarity: result.similarity ? result.similarity * boost : null,
      retrieval: ["semantic"],
    });
  }

  // --------------------------------------------------
  // Stage 2: Try pattern-based symbol extraction
  // If successful, include the symbol and its relationships
  // as a fast-path optimization (doesn't fail if pattern fails)
  // --------------------------------------------------

  const targetSymbol = extractSymbolName(query);
  if (targetSymbol) {
    const target = await findSymbolByName(targetSymbol);

    if (target) {
      const direction = getRelationshipDirection(query);
      
      // Add the target itself
      addResult(results, target, "target", null);

      // Add relationships
      if (direction === "callers" || direction === "both") {
        const callers = await findCallers(target.symbol_name);
        for (const caller of callers) {
          addResult(results, caller, "caller", null);
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
  // Stage 3: Detect relationship intent and enhance
  // semantic results with their relationships
  // This provides relationship context even if symbol
  // extraction didn't work
  // --------------------------------------------------

  const hasRelationshipKeywords = 
    query.toLowerCase().match(/\b(calls?|called|uses?|used|callers?|callees?|who|where)\b/i);

  if (hasRelationshipKeywords && semanticResults.length > 0) {
    const direction = getRelationshipDirection(query);

    for (const result of semanticResults) {
      if (direction === "callers" || direction === "both") {
        const callers = await findCallers(result.symbolName);
        for (const caller of callers) {
          addResult(results, caller, "caller", null);
        }
      }

      if (direction === "callees" || direction === "both") {
        const callees = await findCallees(result.symbolName);
        for (const callee of callees) {
          addResult(results, callee, "callee", null);
        }
      }
    }
  }

  // Sort by similarity (semantic results ranked higher, relationships don't have similarity scores)
  return Array.from(results.values()).sort((a, b) => {
    const aScore = a.similarity ?? 0;
    const bScore = b.similarity ?? 0;
    return bScore - aScore;
  });
}
