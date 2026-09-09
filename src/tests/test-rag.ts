import { createEmbedding } from "../embeddings";
import pool from "../db";

async function testRag() {
  const text = "The application requires Node 22 or later";

  try {
    const embedding = await createEmbedding(text);

    console.log("Embedding dimensions:", embedding.length);

    const result = await pool.query(
      `INSERT INTO document_chunks 
         (source, chunk_index, content, embedding)
         VALUES($1, $2, $3, $4)
         RETURNING id`,
      ["test.md", 0, text, JSON.stringify(embedding)],
    );

    console.log("Stored document chunk:", result.rows[0]);
  } catch (error) {
    console.error("Error creating embedding:");
    console.error(error);
  }
}

testRag();
