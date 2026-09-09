import { hybridCodeSearch } from "../hybridCodeSearch.js";
import { buildCodeContext } from "../codeContext.js";

async function testIngestQuery() {
  const queries = [
    "how do I ingest code into the app?",
    "code ingestion",
    "how to ingest",
    "ingestion pipeline",
  ];

  for (const query of queries) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Query: "${query}"`);
    console.log("=".repeat(60));

    try {
      const results = await hybridCodeSearch(query);

      console.log(`\nFound ${results.length} results:\n`);

      if (results.length === 0) {
        console.log("❌ NO RESULTS");
      } else {
        for (const result of results.slice(0, 5)) {
          console.log(`- ${result.symbolName} (${result.symbolType})`);
          console.log(`  File: ${result.filePath}`);
          console.log(
            `  Similarity: ${result.similarity ? (result.similarity * 100).toFixed(1) + "%" : "N/A"}`,
          );
          console.log(`  Retrieval: ${result.retrieval.join(", ")}`);
          console.log();
        }
      }

      if (results.length > 0) {
        const rerankedResults = results.map(r => ({
          ...r,
          rerankerScore: r.similarity ?? 0,
        }));
        const context = buildCodeContext(rerankedResults);
        console.log(`Context length: ${context.content.length} chars`);
      }
    } catch (err: any) {
      console.log(`Error: ${err.message}`);
    }
  }
}

testIngestQuery().catch(console.error);
