import pool from "../db.js";
import { searchCode } from "../codeSearch.js";

async function main() {
  const query = process.argv.slice(2).join(" ");

  if (!query) {
    console.error('Usage: npx tsx src/codeSearch-test.ts "your question"');

    process.exit(1);
  }

  const results = await searchCode(query, 5);

  console.log(`\nSearch: "${query}"\n`);

  for (const result of results) {
    console.log("----------------------------------------");

    console.log(`${result.symbolType}: ${result.symbolName}`);

    console.log(`${result.filePath}:${result.startLine}-${result.endLine}`);

    console.log(`Similarity: ${result.similarity.toFixed(4)}`);

    if (result.metadata.calls.length > 0) {
      console.log(
        "Calls:",
        result.metadata.calls.map((call) => call.symbolName).join(", "),
      );
    }

    console.log("\n" + result.content);
  }

  await pool.end();
}

main();
