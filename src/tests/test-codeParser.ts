import { parseCodeFile } from "../codeParser.js";

const filePath = process.argv[2];

if (!filePath) {
  console.error(
    "Usage: npx tsx src/testParser.ts <file>",
  );

  process.exit(1);
}

const chunks = parseCodeFile(filePath);

console.log("\nParsed chunks:");
console.dir(chunks, { depth: null });