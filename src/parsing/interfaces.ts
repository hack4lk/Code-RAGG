/**
 * Unified interfaces for language-agnostic code parsing
 * All language parsers (TypeScript, Python, Java) implement these contracts
 * 
 * This ensures consistent symbol extraction, relationship tracking, and metadata
 * across all supported programming languages.
 */

/**
 * Represents a code symbol (function, class, variable, etc.)
 * Universal format used by all parsers
 */
export interface CodeSymbol {
  id: string;
  name: string;
  type: 'function' | 'class' | 'interface' | 'method' | 'variable' | 'type';
  language: string;
  filePath: string;
  startLine: number;
  endLine: number;
  documentation?: string;
  // Language-specific metadata extensions
  metadata?: Record<string, any>;
}

/**
 * Represents an import statement
 */
export interface Import {
  source: string;
  specifiers: string[];
  isDefault: boolean;
}

/**
 * Represents a relationship between code elements
 * (who calls whom, who imports what, inheritance, etc.)
 */
export interface Relationship {
  type: 'calls' | 'imports' | 'extends' | 'implements';
  source: CodeSymbol;
  target: string; // Symbol name or file path
  line: number;
}

/**
 * Result of parsing a single code file
 * Returned by all language parsers
 */
export interface ParsedCodeChunk {
  filePath: string;
  language: 'typescript' | 'python' | 'java' | string;
  content: string;
  symbols: CodeSymbol[];
  imports: Import[];
  relationships: Relationship[];
  metadata: {
    lineCount: number;
    complexity?: number;
    [key: string]: any;
  };
}

/**
 * Contract that all language parsers must implement
 * New languages plug in by implementing this interface
 */
export interface CodeParser {
  language: string;
  supportedExtensions: string[];

  /**
   * Parse a code file and extract symbols, imports, relationships
   * @param filePath - Absolute or relative path to the file
   * @param content - Raw file content
   * @returns Promise resolving to parsed chunk with all extracted information
   */
  parse(filePath: string, content: string): Promise<ParsedCodeChunk>;
}
