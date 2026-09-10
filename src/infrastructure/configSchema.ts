/**
 * Centralized Application Configuration
 * 
 * This file is the single source of truth for all tunable parameters:
 * - Search limits and thresholds
 * - Reranking parameters
 * - Model URLs and settings
 * - Database configuration
 * 
 * All values are read from environment variables with sensible defaults.
 * This enables easy tuning without code changes.
 */

import 'dotenv/config';

// Helper function to safely parse environment variables
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Application configuration object
 * All configuration is centralized here to avoid duplication across files
 */
export const config = {
  // Server settings
  server: {
    port: getEnvInt('PORT', 3000),
  },

  // Search parameters
  search: {
    // How many semantic search results to fetch before reranking
    semanticLimit: getEnvInt('SEMANTIC_SEARCH_LIMIT', 5),
    
    // How many keyword search results to fetch before reranking (PostgreSQL)
    pgLimit: getEnvInt('PG_SEARCH_LIMIT', 10),
    
    // Maximum number of documents to include in the final context
    maxContextDocs: getEnvInt('MAX_CONTEXT_DOCS', 3),
    
    // Maximum size of a single document in characters
    maxDocumentSize: getEnvInt('MAX_DOCUMENT_SIZE', 10240),
  },

  // Reranking thresholds
  reranking: {
    // Minimum score to include document results (0.0 - 1.0)
    // Lowered from 0.05: keyword matches usually score lower than semantic matches
    documentThreshold: getEnvNumber('RERANK_THRESHOLD', 0.02),
    
    // Minimum score to include code results (0.0 - 1.0)
    codeThreshold: getEnvNumber('CODE_RERANK_THRESHOLD', 0.05),
    
    // Minimum semantic similarity score for code relationships
    codeSimilarityScore: getEnvNumber('CODE_SIMILARITY_SCORE', 0.05),
    
    // Boost multiplier for matching architecture keywords in hybrid search
    architectureKeywordBoost: getEnvNumber('CODE_ARCHITECTURE_BOOST', 1.5),
    
    // Boost multiplier for caller relationships
    callerRelationshipBoost: getEnvNumber('CODE_CALLER_BOOST', 1.5),
    
    // Disable reranking entirely (for debugging)
    disabled: getEnvBoolean('DISABLE_RERANKER', false),
  },

  // File system settings
  filesystem: {
    // Directory containing markdown documents
    documentsDir: getEnvString('DOCUMENTS_DIR', './documents'),
    
    // Directory containing source code to ingest
    codeSourceDirectory: getEnvString('CODE_SOURCE_DIRECTORY', './src'),
    
    // Directories to skip during code parsing (comma-separated)
    codeSkipDirectories: getEnvString('CODE_SKIP_DIRECTORIES', 'node_modules,dist,build,.git,.next,__pycache__'),
    
    // File extensions to parse (comma-separated)
    codeExtensions: getEnvString('CODE_EXTENSIONS', 'ts,tsx,js,jsx'),
  },

  // Model provider and configuration
  models: {
    // Which model provider to use: 'lm_studio' or 'openai'
    provider: getEnvString('MODEL_PROVIDER', 'lm_studio'),
    
    // LM Studio configuration (local API)
    lmStudio: {
      // Base URL for LM Studio API (includes /v1)
      url: getEnvString('LM_STUDIO_URL', 'http://localhost:1234/v1'),
      
      // Embedding model name
      embeddingModel: getEnvString('EMBEDDING_MODEL', 'all-MiniLM-L6-v2'),
      
      // Chat model name
      chatModel: getEnvString('CHAT_MODEL', 'neural-chat'),
    },
    
    // OpenAI configuration (cloud API)
    openai: {
      // API key for OpenAI
      apiKey: getEnvString('OPENAI_API_KEY', ''),
      
      // Base URL for OpenAI API
      url: getEnvString('OPENAI_API_URL', 'https://api.openai.com/v1'),
      
      // Chat model name
      chatModel: getEnvString('OPENAI_MODEL', 'gpt-4'),
    },
  },

  // Database settings (from env)
  database: {
    host: getEnvString('DB_HOST', 'localhost'),
    port: getEnvInt('DB_PORT', 5432),
    database: getEnvString('DB_NAME', 'rag_demo'),
    user: getEnvString('DB_USER', 'rag_user'),
    password: getEnvString('DB_PASSWORD', ''),
  },
};

/**
 * Validate that all required configuration is present
 * Called at startup to fail fast if configuration is incomplete
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Check required database settings
  if (!config.database.host) errors.push('DB_HOST is required');
  if (!config.database.user) errors.push('DB_USER is required');
  if (!config.database.password) errors.push('DB_PASSWORD is required');
  if (!config.database.database) errors.push('DB_NAME is required');

  // Check filesystem settings
  if (!config.filesystem.documentsDir) errors.push('DOCUMENTS_DIR is required');
  if (!config.filesystem.codeSourceDirectory) errors.push('CODE_SOURCE_DIRECTORY is required');

  // Check model configuration
  if (!config.models.provider) errors.push('MODEL_PROVIDER is required');
  
  if (config.models.provider === 'lm_studio') {
    if (!config.models.lmStudio.url) errors.push('LM_STUDIO_URL is required when using lm_studio provider');
    if (!config.models.lmStudio.embeddingModel) errors.push('EMBEDDING_MODEL is required when using lm_studio provider');
    if (!config.models.lmStudio.chatModel) errors.push('CHAT_MODEL is required when using lm_studio provider');
  } else if (config.models.provider === 'openai') {
    if (!config.models.openai.apiKey) errors.push('OPENAI_API_KEY is required when using openai provider');
    if (!config.models.openai.chatModel) errors.push('OPENAI_MODEL is required when using openai provider');
  } else {
    errors.push(`Unknown MODEL_PROVIDER: ${config.models.provider}. Must be 'lm_studio' or 'openai'`);
  }

  if (errors.length > 0) {
    console.error('Configuration validation failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    throw new Error('Invalid configuration');
  }

  console.log('[Config] Validation passed');
}

/**
 * Log current configuration (safe version - no passwords)
 */
export function logConfig(): void {
  const safeConfig = {
    ...config,
    database: {
      ...config.database,
      password: '***', // Hide password from logs
    },
  };
  console.log('[Config]', JSON.stringify(safeConfig, null, 2));
}
