import { hybridCodeSearch } from "../hybridCodeSearch.js";
import { scoreDocument } from "../reranker.js";
import 'dotenv/config';

async function debugReranking() {
  const query = "how do I ingest code into the app?";
  
  console.log(`Testing query: "${query}"\n`);
  
  // Step 1: Get hybrid search results
  const candidates = await hybridCodeSearch(query);
  console.log(`Step 1 - Hybrid search found ${candidates.length} results`);
  
  for (const doc of candidates) {
    console.log(`  - ${doc.symbolName} (similarity: ${doc.similarity ? (doc.similarity * 100).toFixed(1) + "%" : "N/A"})`);
  }
  
  // Step 2: Score each with reranker
  console.log("\nStep 2 - BGE Reranker Scoring:");
  const threshold = process.env.CODE_RERANK_THRESHOLD ? parseFloat(process.env.CODE_RERANK_THRESHOLD) : 0.05;
  console.log(`  Threshold: ${threshold}`);
  console.log(`  Preserve if similarity >= 0.5\n`);
  
  let preserved = 0;
  for (const doc of candidates) {
    const score = await scoreDocument(query, doc.content);
    const semanticOK = doc.similarity && doc.similarity >= 0.5;
    const rerankerOK = score >= threshold;
    const status = (semanticOK || rerankerOK) ? "✅ KEPT" : "❌ FILTERED";
    
    if (semanticOK || rerankerOK) preserved++;
    
    console.log(`  ${doc.symbolName}:`);
    console.log(`    Semantic: ${doc.similarity ? (doc.similarity * 100).toFixed(1) + "%" : "N/A"} ${semanticOK ? "✅" : "❌"}`);
    console.log(`    Reranker: ${score.toFixed(4)} ${rerankerOK ? "✅" : "❌"}`);
    console.log(`    Result: ${status}`);
  }
  
  console.log(`\nPreserved: ${preserved}/${candidates.length} results`);
}

debugReranking().catch(console.error);
