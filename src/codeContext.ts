import { CodeRerankerResult } from "./codeReranker.js";

export interface CodeContext {
  content: string;
  chunks: CodeRerankerResult[];
}

function getRelationshipDescription(result: CodeRerankerResult): string {
  if (result.retrieval.includes("caller")) {
    return "This symbol calls the target symbol.";
  }

  if (result.retrieval.includes("callee")) {
    return "The target symbol calls this symbol.";
  }

  if (result.symbolType === "interface" || result.symbolType === "type") {
    return "This is a data contract/type definition used in the codebase.";
  }

  if (result.symbolType === "class") {
    return "This is a component class.";
  }

  if (result.symbolType === "constant") {
    return "This is a configuration constant.";
  }

  if (result.symbolType === "route") {
    return "This is an API route/endpoint definition.";
  }

  return "This symbol is the target of the relationship query.";
}

function getSectionTitle(result: CodeRerankerResult): string {
  if (result.retrieval.includes("caller")) {
    return "CALLER";
  }

  if (result.retrieval.includes("callee")) {
    return "CALLEE";
  }

  if (result.retrieval.includes("target")) {
    return "TARGET";
  }

  // Use symbol type for architectural entities
  if (result.symbolType === "interface") return "DATA CONTRACT (INTERFACE)";
  if (result.symbolType === "type") return "DATA CONTRACT (TYPE)";
  if (result.symbolType === "class") return "COMPONENT CLASS";
  if (result.symbolType === "route") return "API ENDPOINT";
  if (result.symbolType === "constant") return "CONFIGURATION";

  return "TARGET / SEMANTIC MATCH";
}

export function buildCodeContext(
  results: CodeRerankerResult[],
  maxChunks = 5,
): CodeContext {
  const selected = results.slice(0, maxChunks);
  const sections: string[] = [];

  // Add main results
  for (const result of selected) {
    sections.push(
      [
        getSectionTitle(result),
        "=".repeat(getSectionTitle(result).length),
        "",
        `File: ${result.filePath}`,
        `Symbol: ${result.symbolName}`,
        `Type: ${result.symbolType}`,
        `Lines: ${result.startLine}-${result.endLine}`,
        "",
        getRelationshipDescription(result),
        "",
        "CODE",
        "----",
        result.content,
      ].join("\n"),
    );
  }

  return {
    content: sections.join("\n\n---\n\n"),
    chunks: selected,
  };
}
