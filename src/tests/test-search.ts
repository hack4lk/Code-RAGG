import { hybridCodeSearch } from "../hybridCodeSearch.js";
import { buildCodeContext } from "../codeContext.js";

async function testSearch() {
  const query = "what is findCallees and what does it do?";
  console.log(`\nTesting query: "${query}"\n`);
  
  const results = await hybridCodeSearch(query);
  
  console.log(`Found ${results.length} results:\n`);
  
  for (const result of results.slice(0, 3)) {
    console.log(`- ${result.symbolName} (${result.symbolType})`);
    console.log(`  File: ${result.filePath}`);
    console.log(`  Retrieval: ${result.retrieval.join(", ")}`);
    console.log(`  Similarity: ${result.similarity ? (result.similarity * 100).toFixed(1) + "%" : "N/A"}`);
    console.log();
  }
  
  // Build context and check if it has content
  const rerankedResults = results.map(r => ({
    ...r,
    rerankerScore: r.similarity ?? 0,
  }));
  const context = buildCodeContext(rerankedResults);
  console.log("Code Context Length:", context.content.length);
  console.log("First 300 chars:", context.content.substring(0, 300));
}

testSearch().catch(e => console.error("Error:", e.message));
