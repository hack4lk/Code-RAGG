import pool from "../db.js";
import { findCallers } from "../codeCallers.js";

const symbolName = process.argv[2];

if (!symbolName) {
  console.error("Usage: npx tsx src/codeCallers-test.ts <symbol>");

  process.exit(1);
}

(async () => {
  const callers = await findCallers(symbolName);

  console.log(`\nCallers of ${symbolName}:\n`);

  for (const caller of callers) {
    console.log(`${caller.symbol_type}: ${caller.symbol_name}`);
    console.log(`${caller.file_path}:${caller.start_line}-${caller.end_line}`);

    console.log();
  }

  await pool.end();
})();
