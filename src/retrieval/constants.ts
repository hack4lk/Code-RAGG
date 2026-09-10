/**
 * Shared constants for retrieval operations
 * Single source of truth for keyword filtering, patterns, and configuration
 */

/**
 * Standard stop words for query keyword extraction
 * Used by both document and code keyword-based searches
 */
export const STOP_WORDS = new Set([
  // Common English words
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
  'has', 'have', 'he', 'her', 'his', 'how', 'i', 'in', 'is', 'it', 'its',
  'of', 'on', 'or', 'that', 'the', 'this', 'to', 'used', 'was', 'what', 'which',
  'who', 'will', 'with', 'you', 'your',
  // Verb forms
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  // Additional noise words
  'about',
]);

/**
 * Keywords that indicate callers relationship in a query
 * Used to detect: "what calls X", "who calls X", etc.
 */
export const CALLERS_KEYWORDS = new Set([
  'calls', 'called', 'uses', 'used', 'who', 'where', 'callers', 'calling'
]);

/**
 * Keywords that indicate callees relationship in a query
 * Used to detect: "what does X call", etc.
 */
export const CALLEES_KEYWORDS = new Set([
  'call', 'calls', 'called', 'does', 'do', 'callees'
]);

/**
 * Architecture keywords that should boost certain symbol types
 * Maps domain concepts to relevant code entity types
 */
export const ARCHITECTURE_KEYWORDS = {
  api: ["route", "interface", "type"],
  endpoint: ["route"],
  interface: ["interface", "type"],
  contract: ["interface", "type"],
  flow: ["function", "method", "route"],
  architecture: ["class", "interface", "route"],
  design: ["class", "interface"],
  config: ["constant"],
  configuration: ["constant"],
  setup: ["constant"],
  middleware: ["method", "function", "constant"],
  handler: ["method", "function"],
  ingest: ["function", "method", "class"],
  ingestion: ["function", "method", "class"],
  pipeline: ["function", "method", "class"],
  process: ["function", "method", "class"],
};
