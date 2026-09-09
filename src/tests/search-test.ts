import { searchDocuments } from "../search.js";
import pool from "../db.js";

async function testSearch() {
  try {
    const results = await searchDocuments("How do I configure the database connection?");

    for (const result of results) {
      console.log("\n----------------------");

      console.log(`Source: ${result.source}`);
      console.log(`Chunk: ${result.chunkIndex}`);
      console.log(`Distance: ${result.distance}`);
      console.log(`Score: ${result.score}`);

      console.log(`Content:\n${result.content}`);
    }
  } catch (error) {
    console.error("Search failed:");

    console.error(error);
  } finally {
    await pool.end();
  }
}

testSearch();
