import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { chunkMarkdown } from "../parsing/chunker.js";
import { createEmbedding } from "../core/embeddings";
import pool from "../core/db";

const DOCUMENTS_DIR = process.env.DOCUMENTS_DIR;

function createHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function ingest() {
  if (!DOCUMENTS_DIR) {
    throw new Error("DOCUMENTS_DIR environment variable is not set.");
  }

  const forceIngest = process.argv.includes("--force");
  if (forceIngest) {
    console.log("Force ingestion enabled (--force flag detected)");
  }

  console.log(`Using documents directory: ${DOCUMENTS_DIR}`);
  const files = await fs.readdir(DOCUMENTS_DIR);

  for (const filename of files) {
    if (!filename.endsWith(".md")) {
      continue;
    }

    console.log(`\nProcessing ${filename}`);

    const filePath = path.join(DOCUMENTS_DIR, filename);

    const content = await fs.readFile(filePath, "utf-8");

    const contentHash = createHash(content);

    // Check whether we've already ingested this document
    const existingDocument = await pool.query(
      `
      SELECT id, content_hash
      FROM documents
      WHERE filename = $1
      `,
      [filename],
    );

    if (existingDocument.rows.length > 0) {
      const document = existingDocument.rows[0];

      if (document.content_hash === contentHash && !forceIngest) {
        console.log("Document unchanged. Skipping. (Use --force to re-ingest)");

        continue;
      }

      if (document.content_hash === contentHash && forceIngest) {
        console.log("Document unchanged but re-ingesting (--force flag).");
      } else {
        console.log("Document changed. Re-ingesting.");
      }

      // Remove the old chunks
      await pool.query(
        `
        DELETE FROM document_chunks
        WHERE document_id = $1
        `,
        [document.id],
      );

      // Update the document hash
      await pool.query(
        `
        UPDATE documents
        SET
          content_hash = $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [contentHash, document.id],
      );
    }

    let documentId: number;

    if (existingDocument.rows.length === 0) {
      const result = await pool.query(
        `
        INSERT INTO documents (
          filename,
          content_hash
        )
        VALUES ($1, $2)
        RETURNING id
        `,
        [filename, contentHash],
      );

      documentId = result.rows[0].id;

      console.log(`Created document ${documentId}`);
    } else {
      documentId = existingDocument.rows[0].id;
    }

    const chunks = chunkMarkdown(content, 1000);

    console.log(`Created ${chunks.length} chunks`);

    for (const chunk of chunks) {
      console.log(`Embedding chunk ${chunk.index}`);

      const embedding = await createEmbedding(chunk.content);

      await pool.query(
        `
        INSERT INTO document_chunks (
          document_id,
          source,
          chunk_index,
          content,
          embedding
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          documentId,
          filename,
          chunk.index,
          chunk.content,
          JSON.stringify(embedding),
        ],
      );
    }
  }

  console.log("\nIngestion complete!");
}

ingest().catch((error) => {
  console.error(error);
  process.exit(1);
});
