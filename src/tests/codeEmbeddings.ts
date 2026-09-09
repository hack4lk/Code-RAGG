import "dotenv/config";

import pool from "../db.js";
import { createEmbedding } from "../embeddings.js";

function buildEmbeddingText(chunk: {
  filePath: string;
  symbolName: string;
  symbolType: string;
  content: string;
  metadata: {
    calls: {
      symbolName: string;
    }[];
  };
}): string {
  const calls = chunk.metadata.calls.map((call) => call.symbolName).join(", ");

  return `
File: ${chunk.filePath}
Symbol: ${chunk.symbolName}
Type: ${chunk.symbolType}

Calls:
${calls || "None"}

Code:
${chunk.content}
`.trim();
}

async function embedCode() {
  console.log("Starting code embedding...\n");

  const result = await pool.query(`
    SELECT
      id,
      file_path,
      symbol_name,
      symbol_type,
      content,
      metadata
    FROM code_chunks
    ORDER BY id
  `);

  console.log(`Found ${result.rows.length} code chunks.\n`);

  for (const row of result.rows) {
    const embeddingText = buildEmbeddingText(row);

    console.log(`Embedding ${row.file_path}:${row.symbol_name}`);

    const embedding = await createEmbedding(embeddingText);

    await pool.query(
      `
      UPDATE code_chunks
      SET embedding = $1
      WHERE id = $2
      `,
      [JSON.stringify(embedding), row.id],
    );
  }

  console.log(`\nEmbedded ${result.rows.length} code chunks.`);

  await pool.end();

  console.log("Code embedding complete!");
}

embedCode().catch((error) => {
  console.error("Code embedding failed:", error);

  process.exit(1);
});
