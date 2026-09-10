import { codeRepository } from "../core/repository.js";

export async function findCallers(symbolName: string) {
  return codeRepository.findCallers(symbolName);
}

/**
 * Find all files/symbols that import a given symbol
 * Used for constants, types, interfaces, and other non-function symbols
 */
export async function findImportedBy(symbolName: string) {
  return codeRepository.findImportedBy(symbolName);
}

/**
 * Find all places where a symbol is imported by querying the imported_by metadata directly
 * This returns the actual import locations, not the importing files' symbols
 */
export async function findRelationshipForSymbol(symbolName: string) {
  return codeRepository.findBySymbol(symbolName);
}
