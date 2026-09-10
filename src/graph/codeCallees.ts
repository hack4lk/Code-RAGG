import { codeRepository } from "../core/repository.js";

export async function findCallees(symbolName: string) {
  const metadata = await codeRepository.getMetadata(symbolName);

  if (!metadata) {
    return [];
  }

  const calls = metadata.calls ?? [];

  const callees = [];

  for (const call of calls) {
    const result = await codeRepository.findBySymbol(call.symbolName);
    if (result) {
      callees.push(result);
    }
  }

  return callees;
}
