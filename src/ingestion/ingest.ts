import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { chunkMarkdown } from "../parsing/chunker.js";
import { createEmbedding } from "../core/embeddings";
import { documentRepository } from "../core/repository";
import { config } from "../infrastructure/configSchema.js";
import { logger } from "../infrastructure/logger";

const DOCUMENTS_DIR = config.filesystem.documentsDir;

function createHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function ingest() {
  if (!DOCUMENTS_DIR) {
    throw new Error("DOCUMENTS_DIR environment variable is not set.");
  }

  const forceIngest = process.argv.includes("--force");
  if (forceIngest) {
    logger.info("Force ingestion enabled (--force flag)");
  }

  logger.info(`Using documents directory: ${DOCUMENTS_DIR}`);
  const files = await fs.readdir(DOCUMENTS_DIR);

  for (const filename of files) {
    if (!filename.endsWith(".md")) {
      continue;
    }

    logger.debug(`Processing ${filename}`);

    const filePath = path.join(DOCUMENTS_DIR, filename);

    const content = await fs.readFile(filePath, "utf-8");

    const contentHash = createHash(content);

    // Check whether we've already ingested this document
    const document = await documentRepository.findByFilename(filename);

    if (document) {

      if (document.contentHash === contentHash && !forceIngest) {
        logger.debug("Document unchanged. Skipping.");

        continue;
      }

      if (document.contentHash === contentHash && forceIngest) {
        logger.info("Document unchanged but re-ingesting (--force flag).");
      } else {
        logger.info("Document changed. Re-ingesting.");
      }

      // Remove the old chunks
      await documentRepository.deleteDocumentChunks(document.id);

      // Update the document hash
      await documentRepository.updateDocumentHash(document.id, contentHash);
    }

    let documentId: number;

    if (!document) {
      documentId = await documentRepository.insertDocument(filename, contentHash);

      logger.info(`Created document ${documentId}`);
    } else {
      documentId = document.id;
    }

    const chunks = chunkMarkdown(content, 1000);

    logger.debug(`Created ${chunks.length} chunks`);

    for (const chunk of chunks) {
      logger.debug(`Embedding chunk ${chunk.index}`);

      const embedding = await createEmbedding(chunk.content);

      await documentRepository.insertChunk({
        documentId,
        source: filename,
        chunkIndex: chunk.index,
        content: chunk.content,
        embedding,
      });
    }
  }

  logger.info("Ingestion complete");
}

ingest().catch((error) => {
  logger.error("Ingestion failed", { error: String(error) });
  process.exit(1);
});
