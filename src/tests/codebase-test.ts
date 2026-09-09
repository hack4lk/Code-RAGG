import path from "node:path";

import {
  findCodeFiles,
  parseCodebase,
} from "../codebase.js";

const sourceDirectory =
  path.resolve("src");

const files =
  findCodeFiles(sourceDirectory);

console.log(
  `\nFound ${files.length} code files:\n`,
);

for (const file of files) {
  console.log(
    `- ${path.relative(
      process.cwd(),
      file,
    )}`,
  );
}

const chunks =
  parseCodebase(sourceDirectory);

console.log(
  `\nParsed ${chunks.length} code chunks.`,
);

for (const chunk of chunks) {
  console.log(
    `\n${chunk.symbolType}: ${chunk.symbolName}`,
  );

  console.log(
    `${chunk.filePath}:${chunk.startLine}-${chunk.endLine}`,
  );

  if (chunk.metadata.calls.length > 0) {
    console.log("Calls:");

    for (const call of chunk.metadata.calls) {
      console.log(
        `  → ${call.symbolName} (${call.filePath}:${call.line})`,
      );
    }
  }
}