import { rerankedCodeSearch } from "../rerankedCodeSearch.js";
import { buildCodeContext } from "../codeContext.js";

async function checkContext() {
  const query = "what is the findCallees method and where is it called?";
  
  console.log(`Query: "${query}\n"`);
  
  const results = await rerankedCodeSearch(query);
  console.log(`Reranked results: ${results.length}`);
  
  for (const result of results.slice(0, 5)) {
    console.log(`  - ${result.symbolName} (${result.retrieval.join(", ")})`);
  }
  
  const context = buildCodeContext(results);
  console.log(`\nContext built: ${context.content.length} chars`);
  console.log(`\nFirst 1000 chars of context:`);
  console.log(context.content.substring(0, 1000));
  console.log(`\n...\n`);
  console.log(`Last 500 chars of context:`);
  console.log(context.content.substring(context.content.length - 500));
}

checkContext().catch(console.error);
