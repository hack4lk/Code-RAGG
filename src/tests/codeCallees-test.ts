import { findCallees } from "../codeCallees.js";

const symbolName = process.argv[2];

if (!symbolName) {
  console.error("Usage: npx tsx src/codeCallees-test.ts <symbol>");
  process.exit(1);
}

(async () => {
  const callees = await findCallees(symbolName);

  console.log(`\nCallees of ${symbolName}:\n`);

  for (const callee of callees) {
    console.log(`${callee.symbol_type}: ${callee.symbol_name}`);

    console.log(`${callee.file_path}:${callee.start_line}-${callee.end_line}`);

    console.log();
  }
})();
