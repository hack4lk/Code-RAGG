import pool from "../db.js";

async function validateEnrichment() {
  console.log("\n📊 Entity Enrichment Status");
  console.log("=".repeat(80));
  
  // Check for relationships and architectural roles
  const result = await pool.query(`
    SELECT 
      symbol_type,
      COUNT(*) as total,
      SUM(CASE WHEN metadata->>'architecturalRole' IS NOT NULL THEN 1 ELSE 0 END) as with_role,
      SUM(CASE WHEN metadata->'relationships' IS NOT NULL THEN 1 ELSE 0 END) as with_relationships
    FROM code_chunks
    GROUP BY symbol_type
    ORDER BY total DESC
  `);
  
  console.log("\nEntity Distribution with Metadata:");
  console.log("-".repeat(80));
  for (const row of result.rows) {
    const role_pct = row.total > 0 ? ((row.with_role / row.total) * 100).toFixed(0) : "0";
    const rel_pct = row.total > 0 ? ((row.with_relationships / row.total) * 100).toFixed(0) : "0";
    console.log(
      `${row.symbol_type.padEnd(12)} | Total: ${row.total.toString().padEnd(3)} | Has Role: ${role_pct.padEnd(3)}% | Has Relationships: ${rel_pct.padEnd(3)}%`
    );
  }
  
  // Sample some interface entries
  console.log("\n📋 Sample Interface Entries:");
  console.log("-".repeat(80));
  const interfaces = await pool.query(`
    SELECT symbol_name, file_path, metadata 
    FROM code_chunks 
    WHERE symbol_type = 'interface' 
    LIMIT 3
  `);
  
  for (const row of interfaces.rows) {
    console.log(`\n  ${row.symbol_name} (${row.file_path})`);
    const meta = row.metadata;
    if (meta.architecturalRole) console.log(`    └─ Role: ${meta.architecturalRole}`);
    if (meta.relationships && Object.keys(meta.relationships).length > 0) {
      console.log(`    └─ Relationships: ${JSON.stringify(meta.relationships)}`);
    }
  }
  
  // Sample constants
  console.log("\n⚙️  Sample Configuration Constants:");
  console.log("-".repeat(80));
  const constants = await pool.query(`
    SELECT symbol_name, file_path, metadata 
    FROM code_chunks 
    WHERE symbol_type = 'constant' 
    LIMIT 3
  `);
  
  for (const row of constants.rows) {
    console.log(`\n  ${row.symbol_name} (${row.file_path})`);
    const meta = row.metadata;
    if (meta.architecturalRole) console.log(`    └─ Role: ${meta.architecturalRole}`);
  }
  
  console.log("\n" + "=".repeat(80) + "\n");
  await pool.end();
}

validateEnrichment().catch(e => {
  console.error("❌ Validation failed:", e.message);
  process.exit(1);
});
