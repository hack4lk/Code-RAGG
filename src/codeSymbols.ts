import pool from "./db.js";

export async function findSymbol(filePath: string, symbolName: string) {
  const result = await pool.query(
    `
    SELECT
      id,
      file_path,
      symbol_name,
      symbol_type,
      start_line,
      end_line,
      content,
      metadata
    FROM code_chunks
    WHERE file_path = $1
      AND symbol_name = $2
    LIMIT 1
    `,
    [filePath, symbolName],
  );

  return result.rows[0] ?? null;
}

export async function findSymbolByName(symbolName: string) {
  const result = await pool.query(
    `
    SELECT
      id,
      file_path,
      symbol_name,
      symbol_type,
      start_line,
      end_line,
      content,
      metadata
    FROM code_chunks
    WHERE symbol_name = $1
    LIMIT 1
    `,
    [symbolName],
  );

  return result.rows[0] ?? null;
}
