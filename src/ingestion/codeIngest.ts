import "dotenv/config";

import { codeRepository } from "../core/repository.js";
import { parseCodebase } from "../parsing/codebase.js";
import { createEmbedding } from "../core/embeddings.js";
import { config } from "../infrastructure/configSchema.js";

async function ingestCode() {
  console.log("Starting code ingestion...\n");

  const sourceDirectory = config.filesystem.codeSourceDirectory;

  console.log(`Source directory: ${sourceDirectory}`);

  const chunks = parseCodebase(sourceDirectory);

  console.log(`\nParsed ${chunks.length} code chunks.`);

  console.log("\nRemoving existing code chunks...");

  await codeRepository.deleteAll();

  console.log("Existing code chunks removed.");

  // Helper function to detect if a function is a React component
  function isReactComponent(chunk: any): boolean {
    const name = chunk.symbolName || '';
    const content = chunk.content || '';
    
    // React components typically:
    // 1. Have a capitalized name (PascalCase)
    // 2. Return JSX (contains JSX elements or Fragment syntax)
    // 3. May use React hooks
    
    const isCapitalized = name.length > 0 && name[0] === name[0].toUpperCase();
    
    // Check for JSX return statements or hooks
    const hasJSXReturn = /return\s*[(<]/.test(content) && (
      /<[A-Z][\w.]*[\s>]/.test(content) ||  // JSX element with capitalized tag
      content.includes('</>') ||              // Fragment closing tag
      content.includes('</') ||               // Closing tag
      content.includes('/>')                  // Self-closing tag
    );
    
    const hasReactHooks = /use[A-Z]\w+\s*\(/.test(content);
    
    return isCapitalized && (hasJSXReturn || hasReactHooks);
  }

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
        // Check if it looks like a React component
        if (isReactComponent(chunk)) {
          text = `React component: ${text}`;
        }
        break;
      default:
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

    await codeRepository.insertChunk({
      filePath: chunk.filePath,
      symbolName: chunk.symbolName,
      symbolType: chunk.symbolType,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      content: chunk.content,
      embedding,
      metadata: chunk.metadata,
    });
  }

  console.log(`\nInserted ${chunks.length} code chunks.`);

  console.log("Code ingestion complete!");
}

ingestCode().catch((error) => {
  console.error("Code ingestion failed:", error);

  process.exit(1);
});
