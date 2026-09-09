import pool from "./db.js";

export async function findCallers(symbolName: string) {
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
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(metadata->'calls') AS call
      WHERE call->>'symbolName' = $1
    )
    ORDER BY file_path, start_line
    `,
    [symbolName],
  );

  return result.rows;
}
