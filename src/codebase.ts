import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import { parseCodeFile, ParsedCodeChunk } from "./codeParser.js";

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

  for (const file of files) {
    console.log(`Parsing ${path.relative(directory, file)}`);

    const fileChunks = parseCodeFile(file);

    chunks.push(...fileChunks);
  }

  return chunks;
}
