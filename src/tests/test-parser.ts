import { parseCodeFile } from "../codeParser.js";

const chunks = parseCodeFile("./src/tests/test-entities.ts");

console.log(`Parsed ${chunks.length} chunks:\n`);
for (const chunk of chunks) {
  console.log(`${chunk.symbolType.padEnd(12)} ${chunk.symbolName.padEnd(25)} [lines ${chunk.startLine}-${chunk.endLine}]`);
  if (chunk.metadata.architecturalRole) {
    console.log(`  └─ role: ${chunk.metadata.architecturalRole}`);
  }
  if (chunk.metadata.relationships && Object.keys(chunk.metadata.relationships).length > 0) {
    console.log(`  └─ relationships: ${JSON.stringify(chunk.metadata.relationships)}`);
  }
}
