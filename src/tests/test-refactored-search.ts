import { hybridCodeSearch } from "../hybridCodeSearch.js";
import { rerankedCodeSearch } from "../rerankedCodeSearch.js";
import { buildCodeContext } from "../codeContext.js";

async function testRefactoredSearch() {
  const query = "what is the findCallees method and where is it called?";
  
  console.log(`Query: "${query}\n`);
  
  // Test hybrid search
  console.log("Stage 1: Hybrid Search");
  const hybridResults = await hybridCodeSearch(query);
  console.log(`Found ${hybridResults.length} results:\n`);
  
  for (const result of hybridResults.slice(0, 8)) {
    console.log(`- ${result.symbolName} (${result.symbolType})`);
    console.log(`  Retrieval: ${result.retrieval.join(", ")}`);
    console.log(`  Similarity: ${result.similarity ? (result.similarity * 100).toFixed(1) + "%" : "N/A"}`);
  }
  
  // Test reranked search
  console.log("\n\nStage 2: Reranked Search");
  const rerankedResults = await rerankedCodeSearch(query);
  console.log(`After reranking: ${rerankedResults.length} results\n`);
  
  for (const result of rerankedResults.slice(0, 8)) {
    console.log(`- ${result.symbolName} (${result.symbolType})`);
    console.log(`  Retrieval: ${result.retrieval.join(", ")}`);
    console.log(`  Reranker: ${result.rerankerScore.toFixed(4)}`);
  }
  
  // Test context building
  if (rerankedResults.length > 0) {
    console.log("\n\nStage 3: Context Building");
    const context = buildCodeContext(rerankedResults);
    console.log(`Context length: ${context.content.length} chars`);
    console.log(`\nContext preview:`);
    console.log(context.content.substring(0, 500));
  } else {
    console.log("\n\n❌ No results passed to context builder");
  }
}

testRefactoredSearch().catch(console.error);
