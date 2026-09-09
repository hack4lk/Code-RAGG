/**
 * Test script to validate extended code parser capabilities
 * Tests extraction of interfaces, types, classes, and constants
 * 
 * Usage: npx tsx src/tests/codeParser-extended-test.ts
 */

import { parseCodeFile } from "../codeParser.js";
import path from "node:path";

async function testParserExtensions() {
  console.log("=".repeat(80));
  console.log("Testing Extended Code Parser - Entity Type Extraction");
  console.log("=".repeat(80));

  // Test on server.ts which contains interfaces, types, constants, and functions
  const serverPath = path.join(process.cwd(), "src/server/server.ts");
  
  try {
    const chunks = parseCodeFile(serverPath);
    
    console.log(`\n✓ Parsed ${chunks.length} code chunks from server.ts\n`);
    
    // Categorize chunks by type
    const byType: Record<string, typeof chunks> = {};
    for (const chunk of chunks) {
      if (!byType[chunk.symbolType]) {
        byType[chunk.symbolType] = [];
      }
      byType[chunk.symbolType].push(chunk);
    }
    
    // Report on each entity type
    console.log("Entity Type Breakdown:");
    console.log("-".repeat(80));
    for (const [type, typeChunks] of Object.entries(byType).sort()) {
      console.log(`\n${type.toUpperCase()} (${typeChunks.length} found):`);
      for (const chunk of typeChunks) {
        const role = chunk.metadata.architecturalRole ? ` [${chunk.metadata.architecturalRole}]` : "";
        console.log(`  - ${chunk.symbolName}${role}`);
        console.log(`    Lines: ${chunk.startLine}-${chunk.endLine}`);
        
        if (chunk.metadata.relationships) {
          const rel = chunk.metadata.relationships;
          if (rel.inherits_from?.length) {
            console.log(`    Inherits from: ${rel.inherits_from.join(", ")}`);
          }
          if (rel.implements?.length) {
            console.log(`    Implements: ${rel.implements.join(", ")}`);
          }
          if (rel.type_deps?.length) {
            console.log(`    Type deps: ${rel.type_deps.map(t => t.name).join(", ")}`);
          }
        }
        
        if (chunk.metadata.calls.length > 0) {
          console.log(`    Calls: ${chunk.metadata.calls.map(c => c.symbolName).join(", ")}`);
        }
      }
    }
    
    // Validation checks
    console.log("\n" + "=".repeat(80));
    console.log("Validation Results:");
    console.log("=".repeat(80));
    
    const checks = [
      {
        name: "Interfaces extracted",
        test: byType["interface"] && byType["interface"].length > 0,
      },
      {
        name: "Types extracted",
        test: byType["type"] && byType["type"].length > 0,
      },
      {
        name: "Classes extracted",
        test: byType["class"] && byType["class"].length > 0,
      },
      {
        name: "Constants extracted",
        test: byType["constant"] && byType["constant"].length > 0,
      },
      {
        name: "Functions extracted",
        test: byType["function"] && byType["function"].length > 0,
      },
      {
        name: "Methods extracted",
        test: byType["method"] && byType["method"].length > 0,
      },
      {
        name: "Architectural roles assigned",
        test: Object.values(byType).flat().some(c => c.metadata.architecturalRole),
      },
      {
        name: "Relationships tracked",
        test: Object.values(byType).flat().some(c => c.metadata.relationships),
      },
    ];
    
    let passCount = 0;
    for (const check of checks) {
      const status = check.test ? "✓ PASS" : "✗ FAIL";
      console.log(`${status}: ${check.name}`);
      if (check.test) passCount++;
    }
    
    console.log("\n" + "=".repeat(80));
    console.log(`Results: ${passCount}/${checks.length} checks passed`);
    console.log("=".repeat(80));
    
    if (passCount === checks.length) {
      console.log("\n✓ All tests passed! Parser extensions working correctly.\n");
      process.exit(0);
    } else {
      console.log("\n✗ Some tests failed. Review output above.\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("✗ Parser test failed:", error);
    process.exit(1);
  }
}

testParserExtensions();
