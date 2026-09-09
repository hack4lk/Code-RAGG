import { searchCode } from "../codeSearch.js";
import 'dotenv/config';

async function testSearchWithLimits() {
  const query = "what is findCallees method";
  
  console.log(`Testing query: "${query}\n`);
  
  for (const limit of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    try {
      const results = await searchCode(query, limit);
      console.log(`Limit ${limit}: ${results.length} results`);
    } catch (err: any) {
      console.log(`Limit ${limit}: ERROR - ${err.message}`);
    }
  }
}

testSearchWithLimits().catch(console.error);
