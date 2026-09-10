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

/**
 * Find all files/symbols that import a given symbol
 * Used for constants, types, interfaces, and other non-function symbols
 */
export async function findImportedBy(symbolName: string) {
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
    WHERE metadata->'relationships'->'imported_by' IS NOT NULL
      AND metadata->'relationships'->'imported_by' @> jsonb_build_array(
        jsonb_build_object('symbolName', $1)
      )
        OR metadata->'relationships'->'imported_by' @> 
           (SELECT jsonb_agg(jsonb_object(ARRAY['filePath', elem->>'filePath']))
            FROM code_chunks,
            jsonb_array_elements(metadata->'relationships'->'imported_by') AS elem
            WHERE symbol_name = $1)
    ORDER BY file_path, start_line
    `,
    [symbolName],
  );

  return result.rows;
}

/**
 * Find all places where a symbol is imported by querying the imported_by metadata directly
 * This returns the actual import locations, not the importing files' symbols
 */
export async function findImportLocations(symbolName: string) {
  const result = await pool.query(
    `
    SELECT
      id,
      symbol_name,
      metadata->'relationships'->'imported_by' as imported_by
    FROM code_chunks
    WHERE symbol_name = $1
      AND metadata->'relationships'->'imported_by' IS NOT NULL
      AND jsonb_array_length(COALESCE(metadata->'relationships'->'imported_by', '[]'::jsonb)) > 0
    `,
    [symbolName],
  );

  return result.rows;
}
