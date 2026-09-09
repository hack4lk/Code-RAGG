import pool from "../db.js";

async function debugSearch() {
  console.log("Checking if findCallees is indexed...\n");
  
  const result = await pool.query(
    `SELECT symbol_name, symbol_type, file_path FROM code_chunks WHERE symbol_name = $1`,
    ["findCallees"]
  );
  
  console.log("findCallees found:", result.rows.length);
  if (result.rows.length > 0) {
    for (const row of result.rows) {
      console.log(`  - ${row.symbol_name} (${row.symbol_type}) in ${row.file_path}`);
    }
  } else {
    console.log("  ❌ findCallees not found in database!");
  }
  
  // Check if there are any functions at all
  const functionCount = await pool.query(`SELECT COUNT(*) as count FROM code_chunks WHERE symbol_type = 'function'`);
  console.log(`\nTotal functions indexed: ${functionCount.rows[0].count}`);
  
  // Check if there are any methods
  const methodCount = await pool.query(`SELECT COUNT(*) as count FROM code_chunks WHERE symbol_type = 'method'`);
  console.log(`Total methods indexed: ${methodCount.rows[0].count}`);
  
  // Sample some functions
  const sampleFunctions = await pool.query(`SELECT symbol_name, file_path FROM code_chunks WHERE symbol_type = 'function' LIMIT 5`);
  console.log("\nSample functions:");
  for (const row of sampleFunctions.rows) {
    console.log(`  - ${row.symbol_name} (${row.file_path})`);
  }
  
  // Try a search query
  console.log("\nTesting semantic search for 'findCallees'...");
  
  // This is a simple vector similarity search
  const searchResult = await pool.query(
    `SELECT symbol_name, symbol_type, file_path, 1 - (embedding <=> 
      (SELECT embedding FROM code_chunks WHERE symbol_name = 'findCallees' LIMIT 1)
    ) as similarity
    FROM code_chunks
    WHERE symbol_name != 'findCallees'
    ORDER BY similarity DESC
    LIMIT 5`,
  );
  
  console.log("Search results:");
  for (const row of searchResult.rows) {
    console.log(`  - ${row.symbol_name} (${row.symbol_type}, similarity: ${(row.similarity * 100).toFixed(1)}%)`);
  }
  
  await pool.end();
}

debugSearch().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
