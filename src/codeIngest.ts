import "dotenv/config";

import pool from "./db.js";
import { parseCodebase } from "./codebase.js";
import { createEmbedding } from "./embeddings.js";

async function ingestCode() {
  console.log("Starting code ingestion...\n");

  const sourceDirectory = process.env.CODE_SOURCE_DIRECTORY;

  if (!sourceDirectory) {
    throw new Error("CODE_SOURCE_DIRECTORY environment variable is not set.");
  }

  console.log(`Source directory: ${sourceDirectory}`);

  const chunks = parseCodebase(sourceDirectory);

  console.log(`\nParsed ${chunks.length} code chunks.`);

  console.log("\nRemoving existing code chunks...");

  await pool.query("DELETE FROM code_chunks");

  console.log("Existing code chunks removed.");

  // Helper function to prepend entity type hints for better embedding encoding
  function getEmbeddingText(chunk: any): string {
    let text = chunk.content;
    
    // Prepend entity type hints to encode architectural role
    switch (chunk.symbolType) {
      case "interface":
      case "type":
        text = `Data contract: ${text}`;
        break;
      case "class":
        text = `Component class: ${text}`;
        break;
      case "route":
        text = `API endpoint: ${text}`;
        break;
      case "constant":
        text = `Configuration: ${text}`;
        break;
      case "method":
      case "function":
      default:
        // Functions don't need special prefix
        break;
    }
    
    return text;
  }

  for (const chunk of chunks) {
    console.log(`Embedding and inserting ${chunk.filePath}:${chunk.symbolName} (${chunk.symbolType})`);
    
    const callCount = chunk.metadata.calls.length;
    const externalCallCount = chunk.metadata.externalCalls.length;
    const depCount = chunk.metadata.dependencies.length;
    const hasRelationships = chunk.metadata.relationships && Object.keys(chunk.metadata.relationships).length > 0;
    
    if (callCount > 0 || externalCallCount > 0 || depCount > 0) {
      console.log(`  Metadata: ${callCount} internal calls, ${externalCallCount} external calls, ${depCount} dependencies`);
    }
    
    if (hasRelationships && chunk.metadata.relationships) {
      const rel = chunk.metadata.relationships;
      const relDetails = [
        rel.inherits_from?.length && `inherits_from: ${rel.inherits_from.join(', ')}`,
        rel.implements?.length && `implements: ${rel.implements.join(', ')}`,
        rel.type_deps?.length && `type_deps: ${rel.type_deps.map((t: any) => t.name).join(', ')}`,
      ].filter(Boolean);
      if (relDetails.length > 0) {
        console.log(`  Relationships: ${relDetails.join('; ')}`);
      }
    }
    
    if (chunk.metadata.architecturalRole) {
      console.log(`  Architectural role: ${chunk.metadata.architecturalRole}`);
    }

    const embeddingText = getEmbeddingText(chunk);
    const embedding = await createEmbedding(embeddingText);

    await pool.query(
      `
      INSERT INTO code_chunks (
        file_path,
        symbol_name,
        symbol_type,
        start_line,
        end_line,
        content,
        metadata,
        embedding
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        chunk.filePath,
        chunk.symbolName,
        chunk.symbolType,
        chunk.startLine,
        chunk.endLine,
        chunk.content,
        JSON.stringify(chunk.metadata),
        JSON.stringify(embedding),
      ],
    );
  }

  console.log(`\nInserted ${chunks.length} code chunks.`);

  await pool.end();

  console.log("Code ingestion complete!");
}

ingestCode().catch((error) => {
  console.error("Code ingestion failed:", error);

  process.exit(1);
});
