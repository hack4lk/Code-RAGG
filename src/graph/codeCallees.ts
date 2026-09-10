import pool from "../core/db.js";

export async function findCallees(symbolName: string) {
  const source = await pool.query(
    `
    SELECT metadata
    FROM code_chunks
    WHERE symbol_name = $1
    LIMIT 1
    `,
    [symbolName],
  );

  if (source.rows.length === 0) {
    return [];
  }

  const calls = source.rows[0].metadata?.calls ?? [];

  const callees = [];

  for (const call of calls) {
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
      [call.filePath, call.symbolName],
    );

    if (result.rows.length > 0) {
      callees.push(result.rows[0]);
    }
  }

  return callees;
}
