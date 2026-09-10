import * as ts from "typescript";
import path from "node:path";
import "dotenv/config";
import { config } from "../../../infrastructure/configSchema.js";

export interface CodeRelationship {
  name: string;
  filePath: string;
  symbolName: string;
  line: number;
}

export interface TypeDependency {
  name: string;
  filePath?: string;
  line?: number;
}

// NEW: Track who imports this symbol
export interface SymbolImport {
  filePath: string;
  symbolName: string | null; // null = file-level import
  line: number;
  context: "import" | "re_export";
}

// NEW: Track where this symbol is referenced/used
export interface SymbolReference {
  filePath: string;
  symbolName: string | null; // null = file-level reference
  line: number;
  context:
    | "usage"
    | "parameter"
    | "type_annotation"
    | "jsx"
    | "assignment"
    | "return"
    | "extends"
    | "implements"
    | "type_parameter";
}

export interface RelationshipData {
  inherits_from?: string[];
  implements?: string[];
  inherited_by?: string[];
  type_deps?: TypeDependency[];
  used_by?: CodeRelationship[];
  imports?: string[];
  
  // NEW: Comprehensive relationship tracking
  imported_by?: SymbolImport[];
  referenced_in?: SymbolReference[];
  used_in_types?: SymbolReference[];
  re_exported_by?: Array<{ filePath: string; line: number }>;
}

export interface ParsedCodeChunk {
  filePath: string;
  symbolName: string;
  symbolType: string;
  startLine: number;
  endLine: number;
  content: string;
  metadata: {
    calls: CodeRelationship[];
    externalCalls: string[];
    dependencies: string[];
    relationships?: RelationshipData;
    architecturalRole?: string;
  };
}

// Parse environment configuration
const IGNORE_DIRECTORIES = new Set(
  config.filesystem.codeSkipDirectories
    .split(",")
    .map((directory) => directory.trim())
    .filter(Boolean),
);

const CODE_EXTENSIONS = new Set(
  config.filesystem.codeExtensions
    .split(",")
    .map((extension) => {
      const trimmed = extension.trim();
      return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
    })
    .filter((extension) => extension !== "."),
);

// Cache for TypeScript programs to avoid recreating for every file
const programCache = new Map<string, ts.Program>();

// Symbol registry to track all symbol definitions and their uses across the codebase
export interface SymbolRegistry {
  [symbolName: string]: {
    definitions: ParsedCodeChunk[];
    imports: SymbolImport[];
    references: SymbolReference[];
    typeReferences: SymbolReference[];
  };
}

export function parseCodeFile(filePath: string): ParsedCodeChunk[] {
  const absoluteFilePath = ts.sys.resolvePath(filePath);
  
  // Use the directory containing the file as the project root
  // This allows parsing source code from anywhere on the filesystem
  const projectRoot = path.dirname(absoluteFilePath);
  
  // Walk up to find a reasonable project root (look for tsconfig.json or package.json)
  let currentDir = projectRoot;
  let actualProjectRoot = projectRoot;
  for (let i = 0; i < 5; i++) {
    const tsConfig = path.join(currentDir, "tsconfig.json");
    const packageJson = path.join(currentDir, "package.json");
    if (ts.sys.fileExists(tsConfig) || ts.sys.fileExists(packageJson)) {
      actualProjectRoot = currentDir;
      break;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break; // Reached filesystem root
    currentDir = parent;
  }

  // Check if we have a cached program for this project root
  let program = programCache.get(actualProjectRoot);
  
  if (!program) {
    // Get all TypeScript files in the project to build a complete program
    const allFiles: string[] = [];
    function findAllTypeScriptFiles(dir: string) {
      try {
        const extensions = Array.from(CODE_EXTENSIONS);
        const ignoreDirectories = Array.from(IGNORE_DIRECTORIES);
        const entries = ts.sys.readDirectory(dir, extensions, ignoreDirectories);
        allFiles.push(...entries);
      } catch (e) {
        // Silently ignore read errors
      }
    }
    findAllTypeScriptFiles(actualProjectRoot);

    // Create program with all project files
    program = ts.createProgram(allFiles.length > 0 ? allFiles : [absoluteFilePath], {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      allowJs: true,
      checkJs: false,
    });

    programCache.set(actualProjectRoot, program);
  }

  const sourceFile = program.getSourceFile(absoluteFilePath);

  if (!sourceFile) {
    throw new Error(`Could not load source file: ${absoluteFilePath}`);
  }

  const parsedSourceFile: ts.SourceFile = sourceFile;

  const checker = program.getTypeChecker();

  const chunks: ParsedCodeChunk[] = [];

  // Normalize the current file path for comparison
  const currentFileRelativePath = path.relative(actualProjectRoot, absoluteFilePath);

  // Extract file-level imports
  const fileImports: Set<string> = new Set();
  function extractFileImports(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        fileImports.add(moduleSpecifier.text);
      }
    }
    ts.forEachChild(node, extractFileImports);
  }
  extractFileImports(sourceFile);

  // Track top-level exported functions and methods
  const topLevelFunctions: Set<string> = new Set();
  sourceFile.statements.forEach((statement) => {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      topLevelFunctions.add(statement.name.text);
    }
    if (ts.isClassDeclaration(statement) && statement.name) {
      const className = statement.name.text;
      statement.members.forEach((member) => {
        if (ts.isMethodDeclaration(member) && member.name) {
          const methodName = ts.isIdentifier(member.name)
            ? member.name.text
            : member.name.getText(sourceFile);
          topLevelFunctions.add(methodName);
        }
      });
    }
  });

  // Track ALL function names in the file (including nested helpers)
  const allFunctionNames: Set<string> = new Set();
  function extractAllFunctions(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      allFunctionNames.add(node.name.text);
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      // Named function expressions
      if ((node as any).name) {
        allFunctionNames.add((node as any).name.text);
      }
    }
    ts.forEachChild(node, extractAllFunctions);
  }
  extractAllFunctions(sourceFile);

  // Built-in methods and TypeScript API to filter from external calls
  const builtInMethods = new Set([
    // Array methods
    "push", "pop", "shift", "unshift", "map", "filter", "reduce", "forEach",
    "find", "findIndex", "slice", "splice", "concat", "join", "reverse",
    "sort", "includes", "indexOf", "lastIndexOf", "some", "every", "flat",
    "flatMap", "fill", "copyWithin", "entries", "keys", "values",
    // Object methods
    "keys", "values", "entries", "assign", "create", "defineProperty",
    "defineProperties", "getPrototypeOf", "setPrototypeOf", "freeze",
    "seal", "isFrozen", "isSealed", "hasOwnProperty",
    // String methods
    "toUpperCase", "toLowerCase", "trim", "split", "replace", "substring",
    "substr", "slice", "charAt", "charCodeAt", "startsWith", "endsWith",
    "includes", "indexOf", "lastIndexOf", "padStart", "padEnd", "repeat",
    // JSON methods
    "stringify", "parse",
    // Console methods
    "log", "error", "warn", "info", "debug", "trace",
    // TypeScript AST/Node methods
    "getStart", "getEnd", "getText", "forEachChild", "isCallExpression",
    "isIdentifier", "isPropertyAccessExpression", "isImportDeclaration",
    "isFunctionDeclaration", "isClassDeclaration", "isMethodDeclaration",
    "isArrowFunction", "isFunctionExpression", "isStringLiteral",
    "getSourceFile", "getLineAndCharacterOfPosition", "getDeclarations",
    // Common utility
    "toString", "valueOf", "toJSON",
  ]);

  // Known library prefixes
  const libraryPrefixes = ["ts.", "node.", "path.", "fs.", "console.", "Math."];
  function isLibraryCall(callName: string): boolean {
    if (builtInMethods.has(callName)) return true;
    if (allFunctionNames.has(callName)) return true; // Filter out internal functions
    return libraryPrefixes.some((prefix) => callName.startsWith(prefix));
  }

  function getLineNumber(position: number): number {
    return parsedSourceFile.getLineAndCharacterOfPosition(position).line + 1;
  }

  function getCallName(expression: ts.Expression): string {
    if (ts.isIdentifier(expression)) {
      return expression.text;
    }

    if (ts.isPropertyAccessExpression(expression)) {
      return expression.name.text;
    }

    return expression.getText(sourceFile);
  }

  function resolveCall(expression: ts.Expression): CodeRelationship | null {
    const name = getCallName(expression);

    const symbol = checker.getSymbolAtLocation(expression);

    if (!symbol) {
      return null;
    }

    let resolvedSymbol = symbol;

    if (symbol.flags & ts.SymbolFlags.Alias) {
      resolvedSymbol = checker.getAliasedSymbol(symbol);
    }

    const declarations = resolvedSymbol.getDeclarations();

    if (!declarations || declarations.length === 0) {
      return null;
    }

    const declaration = declarations[0];

    const declarationSourceFile = declaration.getSourceFile();

    const absolutePath = ts.sys.resolvePath(declarationSourceFile.fileName);

    // Ignore anything outside our project.
    if (!absolutePath.startsWith(actualProjectRoot + path.sep)) {
      return null;
    }

    if (absolutePath.includes(`${path.sep}node_modules${path.sep}`)) {
      return null;
    }

    return {
      name,
      filePath: path.relative(actualProjectRoot, absolutePath),
      symbolName: resolvedSymbol.getName(),
      line:
        declarationSourceFile.getLineAndCharacterOfPosition(
          declaration.getStart(),
        ).line + 1,
    };
  }

  function addChunk(node: ts.Node, symbolName: string, symbolType: string) {
    const startLine = getLineNumber(node.getStart(sourceFile));

    const endLine = getLineNumber(node.getEnd());

    const content = node.getText(sourceFile).trim();

    const calls: CodeRelationship[] = [];
    const externalCalls: Set<string> = new Set();

    function findResolvedCalls(child: ts.Node) {
      if (ts.isCallExpression(child)) {
        const result = resolveCall(child.expression);

        if (result) {
          // Only include calls to other files (not same-file helpers)
          if (result.filePath !== currentFileRelativePath) {
            calls.push(result);
          }
        } else {
          // Capture external calls that couldn't be resolved
          const callName = getCallName(child.expression);
          
          // Only add to external calls if it's not a library/built-in call
          // and not an internal helper function
          if (!isLibraryCall(callName)) {
            externalCalls.add(callName);
          }
        }
      }

      ts.forEachChild(child, findResolvedCalls);
    }

    findResolvedCalls(node);

    // Remove duplicate relationships.
    const uniqueCalls = Array.from(
      new Map(
        calls.map((call) => [`${call.filePath}:${call.symbolName}`, call]),
      ).values(),
    );

    chunks.push({
      filePath,
      symbolName,
      symbolType,
      startLine,
      endLine,
      content,
      metadata: {
        calls: uniqueCalls,
        externalCalls: Array.from(externalCalls).sort(),
        dependencies: Array.from(fileImports).sort(),
      },
    });
  }

  // Helper to extract class hierarchy
  function extractClassRelationships(classDecl: ts.ClassDeclaration, className: string): RelationshipData {
    const relationships: RelationshipData = {};
    
    // Extract inheritance
    if (classDecl.heritageClauses) {
      classDecl.heritageClauses.forEach((clause) => {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          relationships.inherits_from = clause.types.map((t) => t.getText(sourceFile));
        } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
          relationships.implements = clause.types.map((t) => t.getText(sourceFile));
        }
      });
    }
    
    return relationships;
  }

  // Helper to extract interface/type properties and usage
  function extractInterfaceRelationships(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration): RelationshipData {
    const relationships: RelationshipData = {};
    
    if (ts.isInterfaceDeclaration(node) && node.heritageClauses) {
      node.heritageClauses.forEach((clause) => {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          relationships.inherits_from = clause.types.map((t) => t.getText(sourceFile));
        }
      });
    }
    
    return relationships;
  }

  // Helper to detect if a variable is a route definition or config object
  function getArchitecturalRole(varDecl: ts.VariableDeclaration, content: string): string | undefined {
    const contentLower = content.toLowerCase();
    if (contentLower.includes('app.') && (contentLower.includes('get') || contentLower.includes('post') || contentLower.includes('put') || contentLower.includes('delete'))) {
      return "route";
    }
    if (contentLower.includes('const') && (contentLower.includes('=') && (contentLower.includes('{') || contentLower.includes('[')))) {
      if (contentLower.includes('config') || contentLower.includes('threshold') || contentLower.includes('limit') || contentLower.includes('const ')) {
        return "config";
      }
    }
    return undefined;
  }

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      addChunk(node, node.name.text, "function");
    }

    // Extract interfaces
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const interfaceName = node.name.text;
      const relationships = extractInterfaceRelationships(node);
      addChunkWithRelationships(node, interfaceName, "interface", relationships, "data_contract");
    }

    // Extract type aliases
    if (ts.isTypeAliasDeclaration(node) && node.name) {
      const typeName = node.name.text;
      const relationships = extractInterfaceRelationships(node as any);
      addChunkWithRelationships(node, typeName, "type", relationships, "data_contract");
    }

    // Extract classes (in addition to their methods)
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      const relationships = extractClassRelationships(node, className);
      addChunkWithRelationships(node, className, "class", relationships, "component");

      // Also extract methods
      node.members.forEach((member) => {
        if (ts.isMethodDeclaration(member) && member.name) {
          const methodName = ts.isIdentifier(member.name)
            ? member.name.text
            : member.name.getText(parsedSourceFile);

          addChunk(member, `${className}.${methodName}`, "method");
        }
      });
    }

    // Extract configuration constants and exports
    if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((decl) => {
        if (decl.name && ts.isIdentifier(decl.name)) {
          const varName = decl.name.text;
          const content = node.getText(sourceFile);
          const role = getArchitecturalRole(decl, content);
          
          // Only extract if it looks like a config constant, route, or exported
          const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
          const isCapitalized = varName[0] === varName[0].toUpperCase();
          const hasInitializer = !!decl.initializer;
          const isConfigLike = varName.includes('THRESHOLD') || varName.includes('LIMIT') || varName.includes('PORT') || varName.includes('MAX');
          
          if ((isExported || isCapitalized || isConfigLike || role) && hasInitializer) {
            addChunkWithRelationships(node, varName, "constant", {}, role || "config");
          }
        }
      });
    }

    ts.forEachChild(node, visit);
  }

  // New helper function to add chunks with relationships
  function addChunkWithRelationships(
    node: ts.Node,
    symbolName: string,
    symbolType: string,
    relationships?: RelationshipData,
    architecturalRole?: string,
  ) {
    const startLine = getLineNumber(node.getStart(sourceFile));
    const endLine = getLineNumber(node.getEnd());
    const content = node.getText(sourceFile).trim();

    chunks.push({
      filePath,
      symbolName,
      symbolType,
      startLine,
      endLine,
      content,
      metadata: {
        calls: [],
        externalCalls: [],
        dependencies: Array.from(fileImports).sort(),
        relationships: relationships && Object.keys(relationships).length > 0 ? relationships : undefined,
        architecturalRole,
      },
    });
  }

  visit(sourceFile);

  return chunks;
}

/**
 * Extract all import statements from a source file
 * Returns a map of symbol names to where they're imported
 */
export function extractImports(
  filePath: string,
  sourceFile: ts.SourceFile,
  projectRoot: string,
): Map<string, SymbolImport[]> {
  const imports = new Map<string, SymbolImport[]>();

  function visitImportDeclaration(node: ts.ImportDeclaration) {
    const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    if (ts.isImportDeclaration(node)) {
      const importClause = node.importClause;

      if (importClause) {
        // Named imports: import { MealCard, Config } from "..."
        if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
          importClause.namedBindings.elements.forEach((element) => {
            const importedName = element.name.text;
            const symbolImport: SymbolImport = {
              filePath: path.relative(projectRoot, filePath),
              symbolName: null, // File-level import
              line: lineNumber,
              context: "import",
            };

            if (!imports.has(importedName)) {
              imports.set(importedName, []);
            }
            imports.get(importedName)!.push(symbolImport);
          });
        }

        // Default import: import MealCard from "..."
        if (importClause.name) {
          const importedName = importClause.name.text;
          const symbolImport: SymbolImport = {
            filePath: path.relative(projectRoot, filePath),
            symbolName: null,
            line: lineNumber,
            context: "import",
          };

          if (!imports.has(importedName)) {
            imports.set(importedName, []);
          }
          imports.get(importedName)!.push(symbolImport);
        }

        // Namespace import: import * as Config from "..."
        if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
          const importedName = importClause.namedBindings.name.text;
          const symbolImport: SymbolImport = {
            filePath: path.relative(projectRoot, filePath),
            symbolName: null,
            line: lineNumber,
            context: "import",
          };

          if (!imports.has(importedName)) {
            imports.set(importedName, []);
          }
          imports.get(importedName)!.push(symbolImport);
        }
      }
    }
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      visitImportDeclaration(node);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

/**
 * Extract all re-export statements from a source file
 */
export function extractReExports(
  filePath: string,
  sourceFile: ts.SourceFile,
  projectRoot: string,
): Map<string, Array<{ filePath: string; line: number }>> {
  const reExports = new Map<string, Array<{ filePath: string; line: number }>>();

  function visit(node: ts.Node) {
    // export { MealCard } from "..."
    // export { MealCard as Config } from "..."
    if (ts.isExportDeclaration(node)) {
      const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach((element) => {
          const exportedName = element.name.text;
          const reExportInfo = {
            filePath: path.relative(projectRoot, filePath),
            line: lineNumber,
          };

          if (!reExports.has(exportedName)) {
            reExports.set(exportedName, []);
          }
          reExports.get(exportedName)!.push(reExportInfo);
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return reExports;
}

/**
 * Build the symbol registry from parsed chunks
 * This enriches chunks with imported_by and referenced_in relationships
 */
export function buildSymbolRegistry(
  allChunks: ParsedCodeChunk[],
  sourceFiles: Map<string, ts.SourceFile>,
  checker: ts.TypeChecker,
  projectRoot: string,
): ParsedCodeChunk[] {
  // First pass: collect all imports and re-exports
  const allImports = new Map<string, SymbolImport[]>();
  const allReExports = new Map<string, Array<{ filePath: string; line: number }>>();

  sourceFiles.forEach((sourceFile, filePath) => {
    const imports = extractImports(filePath, sourceFile, projectRoot);
    const reExports = extractReExports(filePath, sourceFile, projectRoot);

    imports.forEach((importList, symbolName) => {
      if (!allImports.has(symbolName)) {
        allImports.set(symbolName, []);
      }
      allImports.get(symbolName)!.push(...importList);
    });

    reExports.forEach((reExportList, symbolName) => {
      if (!allReExports.has(symbolName)) {
        allReExports.set(symbolName, []);
      }
      allReExports.get(symbolName)!.push(...reExportList);
    });
  });

  // Second pass: enrich chunks with import/reference information
  const enrichedChunks = allChunks.map((chunk) => {
    const relationships = chunk.metadata.relationships || {};

    // Add imported_by if this symbol is imported
    if (allImports.has(chunk.symbolName)) {
      relationships.imported_by = allImports.get(chunk.symbolName)!;
    }

    // Add re_exported_by if this symbol is re-exported
    if (allReExports.has(chunk.symbolName)) {
      relationships.re_exported_by = allReExports.get(chunk.symbolName)!;
    }

    return {
      ...chunk,
      metadata: {
        ...chunk.metadata,
        relationships: Object.keys(relationships).length > 0 ? relationships : undefined,
      },
    };
  });

  return enrichedChunks;
}
