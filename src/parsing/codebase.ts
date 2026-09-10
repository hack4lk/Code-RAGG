import fs from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import "dotenv/config";
import { parseCodeFile, ParsedCodeChunk, buildSymbolRegistry } from "./languages/typescript/parser.js";

const IGNORE_DIRECTORIES = new Set(
  (process.env.CODE_SKIP_DIRECTORIES ?? "")
    .split(",")
    .map((directory) => directory.trim())
    .filter(Boolean),
);

if (IGNORE_DIRECTORIES.has("")) {
  throw new Error("CODE_SKIP_DIRECTORIES contains an empty value.");
}

const CODE_EXTENSIONS = new Set(
  (process.env.CODE_EXTENSIONS ?? "")
    .split(",")
    .map((extension) => {
      const trimmed = extension.trim();

      return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
    })
    .filter((extension) => extension !== "."),
);

function validateConfiguration() {
  if (CODE_EXTENSIONS.size === 0) {
    throw new Error(
      "CODE_EXTENSIONS is empty. " +
        "Set it in .env, for example: " +
        "CODE_EXTENSIONS=ts,tsx,js,jsx",
    );
  }
}

validateConfiguration();

export function findCodeFiles(directory: string): string[] {
  const files: string[] = [];

  function walk(currentDirectory: string) {
    const entries = fs.readdirSync(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        if (IGNORE_DIRECTORIES.has(entry.name)) {
          continue;
        }

        walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name);

      if (CODE_EXTENSIONS.has(extension)) {
        files.push(fullPath);
      }
    }
  }

  walk(directory);

  return files;
}

export function parseCodebase(directory: string): ParsedCodeChunk[] {
  const files = findCodeFiles(directory);

  const chunks: ParsedCodeChunk[] = [];
  
  // Map to track all imports across files
  const allImports = new Map<string, Array<{
    filePath: string;
    symbolName: string | null;
    line: number;
    context: "import" | "re_export";
  }>>();

  for (const file of files) {
    console.log(`Parsing ${path.relative(directory, file)}`);

    const fileChunks = parseCodeFile(file);
    chunks.push(...fileChunks);
    
    // Extract imports from this file using regex
    const relativeFilePath = path.relative(directory, file);
    const fileContent = fs.readFileSync(file, 'utf-8');
    
    let lineNum = 0;
    for (const line of fileContent.split('\n')) {
      lineNum++;
      
      // Match: import { name1, name2 } from "..."
      // Named imports
      const namedImportMatch = line.match(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
      if (namedImportMatch) {
        const names = namedImportMatch[1];
        names.split(',').forEach(name => {
          const trimmed = name.trim().split(' as ')[0].trim();
          if (trimmed) {
            if (!allImports.has(trimmed)) {
              allImports.set(trimmed, []);
            }
            allImports.get(trimmed)!.push({
              filePath: relativeFilePath,
              symbolName: null,
              line: lineNum,
              context: "import"
            });
          }
        });
      }
      
      // Match: import Default from "..."
      // Default imports - check for patterns like: import MealCard from "..."
      const defaultImportMatch = line.match(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
      if (defaultImportMatch && !line.includes('{')) {
        const symbolName = defaultImportMatch[1];
        if (symbolName && !['React', 'styled', 'useState', 'useEffect', 'useContext', 'useCallback'].includes(symbolName)) {
          if (!allImports.has(symbolName)) {
            allImports.set(symbolName, []);
          }
          allImports.get(symbolName)!.push({
            filePath: relativeFilePath,
            symbolName: null,
            line: lineNum,
            context: "import"
          });
        }
      }
      
      // Match: import * as Name from "..."
      // Namespace imports
      const namespaceImportMatch = line.match(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/);
      if (namespaceImportMatch) {
        const symbolName = namespaceImportMatch[1];
        if (!allImports.has(symbolName)) {
          allImports.set(symbolName, []);
        }
        allImports.get(symbolName)!.push({
          filePath: relativeFilePath,
          symbolName: null,
          line: lineNum,
          context: "import"
        });
      }
      
      // Match: export { name } from "..."
      // Re-exports
      const reExportMatch = line.match(/export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
      if (reExportMatch) {
        const names = reExportMatch[1];
        names.split(',').forEach(name => {
          const trimmed = name.trim().split(' as ')[0].trim();
          if (trimmed) {
            if (!allImports.has(trimmed)) {
              allImports.set(trimmed, []);
            }
            allImports.get(trimmed)!.push({
              filePath: relativeFilePath,
              symbolName: null,
              line: lineNum,
              context: "re_export"
            });
          }
        });
      }
    }
  }

  // Second pass: enrich chunks with import information
  console.log("\nEnriching chunks with import relationships...");
  const enrichedChunks = chunks.map((chunk) => {
    const relationships = chunk.metadata.relationships || {};

    // Add imported_by if this symbol is imported
    if (allImports.has(chunk.symbolName)) {
      relationships.imported_by = allImports.get(chunk.symbolName)!;
    }

    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        relationships: Object.keys(relationships).length > 0 ? relationships : undefined,
      },
    };
  });

  console.log("Chunk enrichment complete.");

  return enrichedChunks;
}
