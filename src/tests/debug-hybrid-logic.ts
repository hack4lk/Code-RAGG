import { searchCode } from "../codeSearch.js";
import { findSymbolByName } from "../codeSymbols.js";
import { findCallers } from "../codeCallers.js";
import { findCallees } from "../codeCallees.js";

async function debugHybridLogic() {
  const query = "what is the findCallees method and where is it called?";
  
  console.log(`Testing hybrid logic for: "${query}\n`);
  
  // Simulate Stage 1
  console.log("Stage 1: Semantic Search");
  const semanticResults = await searchCode(query, 5);
  console.log(`  Found ${semanticResults.length} results\n`);
  
  // Simulate Stage 2 - symbol extraction
  console.log("Stage 2: Symbol Extraction");
  const patterns = [
    /what is ([a-zA-Z0-9_$]+)/i,
    /what's ([a-zA-Z0-9_$]+)/i,
    /what calls ([a-zA-Z0-9_$]+)/i,
    /who calls ([a-zA-Z0-9_$]+)/i,
    /what does ([a-zA-Z0-9_$]+) call/i,
    /who uses ([a-zA-Z0-9_$]+)/i,
    /where is ([a-zA-Z0-9_$]+) used/i,
  ];
  
  let extracted = null;
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match?.[1]) {
      extracted = match[1];
      console.log(`  Pattern matched: ${pattern}`);
      console.log(`  Extracted symbol: "${extracted}"`);
      break;
    }
  }
  
  if (!extracted) {
    console.log("  ❌ No symbol extracted from patterns");
  } else {
    const target = await findSymbolByName(extracted);
    if (target) {
      console.log(`  ✅ Found symbol in database`);
    } else {
      console.log(`  ❌ Symbol "${extracted}" not found in database`);
    }
  }
  
  // Simulate Stage 3 - relationship detection
  console.log("\nStage 3: Relationship Keyword Detection");
  const hasRelationshipKeywords = 
    query.toLowerCase().match(/\b(calls?|called|uses?|used|callers?|callees?|who|where)\b/i);
  
  if (hasRelationshipKeywords) {
    console.log(`  ✅ Found relationship keywords: ${hasRelationshipKeywords[0]}`);
  } else {
    console.log(`  ❌ No relationship keywords found`);
  }
  
  if (hasRelationshipKeywords && semanticResults.length > 0) {
    console.log(`  Would expand ${semanticResults.length} semantic results with relationships`);
    
    // Try expanding the first result
    const firstResult = semanticResults[0];
    console.log(`\n  Expanding: ${firstResult.symbolName}`);
    
    const callers = await findCallers(firstResult.symbolName);
    const callees = await findCallees(firstResult.symbolName);
    
    console.log(`    Callers: ${callers.length}`);
    console.log(`    Callees: ${callees.length}`);
  }
}

debugHybridLogic().catch(console.error);
