import fs from "node:fs/promises";

import { chunkMarkdown } from "../chunker.js";

async function main() {
  const markdown = await fs.readFile(
    "documents/installation.md",
    "utf-8",
  );

  const chunks = chunkMarkdown(
    markdown,
    150,
  );

  console.log(
    `Created ${chunks.length} chunks\n`,
  );

  for (const chunk of chunks) {
    console.log("==============================");
    console.log(`CHUNK ${chunk.index}`);
    console.log("==============================");
    console.log(chunk.content);
    console.log();
  }
}

main();