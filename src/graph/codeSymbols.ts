import { codeRepository } from "../core/repository.js";

export async function findSymbol(filePath: string, symbolName: string) {
  return codeRepository.findByFileAndSymbol(filePath, symbolName);
}

export async function findSymbolByName(symbolName: string) {
  return codeRepository.findBySymbol(symbolName);
}
