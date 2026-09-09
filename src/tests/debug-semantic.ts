import { searchCode } from "../codeSearch.js";

async function debugSemantic() {
  const query = "what is the findCallees method and where is it called?";
  
  console.log(`Testing semantic search for: "${query}"\n`);
  
  const results = await searchCode(query, 10);
  
  console.log(`Found ${results.length} results:\n`);
  
  for (const result of results) {
    console.log(`- ${result.symbolName} (${result.symbolType})`);
    console.log(`  Similarity: ${result.similarity ? (result.similarity * 100).toFixed(1) + "%" : "N/A"}`);
    console.log();
  }
}

debugSemantic().catch(console.error);
