/**
 * Language configuration and file-to-parser routing
 * 
 * This file centralizes all language settings:
 * - Which file extensions map to which language
 * - Which parser to use for each language
 * - Whether relationships should be extracted
 * 
 * Used by the ingestion pipeline to auto-route files to the correct parser.
 */

/**
 * Configuration for a supported language
 */
export interface LanguageConfig {
  extensions: string[];
  parser: string;
  extractRelationships: boolean;
}

/**
 * Master language configuration
 * Add new languages here when adding support
 */
export const languageConfig: Record<string, LanguageConfig> = {
  typescript: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    parser: 'typescript',
    extractRelationships: true,
  },
  // Future languages
  python: {
    extensions: ['.py'],
    parser: 'python',
    extractRelationships: true,
  },
  java: {
    extensions: ['.java'],
    parser: 'java',
    extractRelationships: true,
  },
};

/**
 * Detect language from file extension
 * @param filePath - File path to analyze
 * @returns Language identifier (e.g., 'typescript', 'python')
 * @throws Error if file extension is not supported
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.'));

  for (const [language, config] of Object.entries(languageConfig)) {
    if (config.extensions.includes(ext)) {
      return language;
    }
  }

  throw new Error(`Unsupported file type: ${ext} (file: ${filePath})`);
}

/**
 * Get configuration for a language
 * @param language - Language identifier
 * @returns Language configuration
 * @throws Error if language is not configured
 */
export function getLanguageConfig(language: string): LanguageConfig {
  const config = languageConfig[language];
  if (!config) {
    throw new Error(`Language not configured: ${language}`);
  }
  return config;
}

/**
 * Get all supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return Object.values(languageConfig)
    .flatMap((config) => config.extensions)
    .filter((ext, idx, arr) => arr.indexOf(ext) === idx); // Unique
}
