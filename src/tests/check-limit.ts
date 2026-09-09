import { searchCode } from "../codeSearch.js";
import 'dotenv/config';

const SEMANTIC_SEARCH_LIMIT = process.env.SEMANTIC_SEARCH_LIMIT ? parseInt(process.env.SEMANTIC_SEARCH_LIMIT) : 5;

async function checkLimit() {
  console.log(`SEMANTIC_SEARCH_LIMIT: ${SEMANTIC_SEARCH_LIMIT}`);
  console.log(`Calling searchCode with limit 5...`);
  
  const results = await searchCode("what is findCallees", 5);
  console.log(`Got ${results.length} results`);
  
  console.log(`\nCalling searchCode with default (no limit param)...`);
  const results2 = await searchCode("what is findCallees");
  console.log(`Got ${results2.length} results`);
}

checkLimit().catch(console.error);
