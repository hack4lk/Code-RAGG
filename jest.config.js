/**
 * Jest Configuration
 * 
 * This file configures Jest for:
 * - TypeScript support via ts-jest
 * - Node.js environment
 * - Test discovery and execution
 * - Coverage reporting
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Root directories to search for tests and code
  roots: ['<rootDir>/__tests__', '<rootDir>/src'],
  
  // Test file patterns
  testMatch: ['**/__tests__/**/*.test.ts'],
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',           // Barrel export
    '!src/infrastructure/config.ts', // Config language routing (not testable)
  ],
  
  // Coverage thresholds (optional - set to fail if below)
  // coverageThreshold: {
  //   global: {
  //     branches: 50,
  //     functions: 50,
  //     lines: 50,
  //     statements: 50,
  //   },
  // },
  
  // Setup files
  setupFilesAfterEnv: [],
  
  // Module name mapping for path aliases (if needed later)
  moduleNameMapper: {},
  
  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  
  // Transform patterns
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
};
