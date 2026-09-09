import pool from "../db.js";
import { hybridCodeSearch } from "../hybridCodeSearch.js";

async function main() {
  const query = process.argv.slice(2).join(" ");

  if (!query) {
    console.error(
      'Usage: npx tsx src/hybridCodeSearch-test.ts "your question"',
    );

    process.exit(1);
  }

  const results = await hybridCodeSearch(query, 5);

  console.log(`\nHybrid search: "${query}"\n`);

  for (const result of results) {
    console.log("----------------------------------------");

    console.log(`${result.symbolType}: ${result.symbolName}`);

    console.log(`${result.filePath}:${result.startLine}-${result.endLine}`);

    console.log(`Retrieval: ${result.retrieval.join(", ")}`);

    if (result.similarity !== null) {
      console.log(`Similarity: ${result.similarity.toFixed(4)}`);
    }

    console.log();
  }

  await pool.end();
}

main();
