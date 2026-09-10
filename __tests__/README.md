# RAG Demo Test Suite

This directory contains all tests for the RAG Demo application.

## Test Structure

Tests are organized to mirror the source code structure:

```
__tests__/
├── retrieval/           # Tests for search, reranking
├── infrastructure/      # Tests for configuration, server
├── features/           # Tests for QA engines
├── ingestion/          # Tests for code/document ingestion
└── integration/        # End-to-end tests
```

## Running Tests

**Run all tests once:**

```bash
npm test
```

**Run tests in watch mode (re-run on file changes):**

```bash
npm run test:watch
```

**Generate coverage report:**

```bash
npm run test:coverage
```

**Run specific test file:**

```bash
npm test -- retrieval/documentSearch.test.ts
```

**Run tests matching a pattern:**

```bash
npm test -- --testNamePattern="threshold filtering"
```

## Writing Tests

### Basic Test Structure

```typescript
describe('Feature Name', () => {
  describe('specific behavior', () => {
    it('should do something specific', () => {
      // Arrange: Set up test data
      const input = ...;

      // Act: Execute the function/feature
      const result = ...;

      // Assert: Check the result
      expect(result).toBe(...);
    });
  });
});
```

### Mocking External Dependencies

Mock the database, APIs, and external services:

```typescript
jest.mock('../../src/core/db', () => ({
  default: {
    query: jest.fn(),
  },
}));

// In test:
const mockQuery = require('../../src/core/db').default.query;
mockQuery.mockResolvedValue({ rows: [...] });
```

### Testing Async Functions

```typescript
it('should fetch data', async () => {
  // Arrange
  const mockData = [...];

  // Act
  const result = await asyncFunction();

  // Assert
  expect(result).toEqual(mockData);
});
```

## Test Categories

### 1. Unit Tests (Isolated Logic)

Test individual functions with mocked dependencies:

- Search result filtering
- Reranking score calculations
- Configuration parsing
- Error handling

**Example:** `__tests__/retrieval/documentSearch.test.ts`

### 2. Integration Tests (Multiple Components)

Test workflows combining multiple components:

- Full search → rerank → filter → generate pipeline
- Ingestion end-to-end (parse files → extract symbols → store in DB)
- Streaming responses with proper error handling

**Example:** `__tests__/integration/qaEngine.test.ts`

### 3. Configuration Tests

Test environment variable handling:

- Default values used when env vars missing
- Invalid values rejected
- Provider-specific validation (lm_studio vs openai)

**Example:** `__tests__/infrastructure/configSchema.test.ts`

## Key Areas to Test (Priority Order)

### Phase 1: Critical Path (🔴 High Priority)

- [ ] **Search filtering** - Document/code search with thresholds
- [ ] **Reranking** - Score normalization, threshold filtering
- [ ] **Configuration** - Environment parsing, validation

### Phase 2: Integration (🟡 Medium Priority)

- [ ] **QA Pipeline** - Full search-to-answer workflow
- [ ] **Ingestion** - File parsing, symbol extraction, storage
- [ ] **Streaming** - SSE response formatting, error events

### Phase 3: Error Handling (🟢 Lower Priority)

- [ ] **Validation** - Missing env vars, invalid config
- [ ] **API Errors** - LM Studio/OpenAI failures
- [ ] **Graceful Degradation** - Fallback behaviors

## Current Template Tests

The following test files are provided as templates with placeholder tests:

1. `__tests__/retrieval/documentSearch.test.ts`
   - Filter by threshold
   - Limit results
   - Score normalization

2. `__tests__/infrastructure/configSchema.test.ts`
   - Environment variable parsing
   - Default value usage
   - Validation errors

3. `__tests__/retrieval/codeReranker.test.ts`
   - Threshold filtering
   - Score sorting
   - Relationship scoring

To use these templates:

1. Uncomment the import and jest.mock() statements
2. Implement the function calls being tested
3. Run `npm test` to see if tests pass

## Best Practices

1. **Use descriptive test names** - `it('should filter results below threshold', ...)`
2. **Follow AAA pattern** - Arrange, Act, Assert
3. **One assertion per test** when possible
4. **Mock external dependencies** - Don't call real APIs/databases
5. **Test both success and error cases**
6. **Keep tests fast** - Mock slow operations
7. **Use beforeEach/afterEach** for common setup/teardown

## Coverage Goals

Aim for these coverage levels:

- **Critical paths:** 80%+ coverage
  - Search and retrieval logic
  - Reranking and filtering
  - Configuration validation
- **Important features:** 60%+ coverage
  - Ingestion pipeline
  - API endpoints
  - Error handling
- **Overall:** 50%+ coverage across the codebase

## Debugging Tests

**Print debug output:**

```typescript
it('should work', () => {
  console.log('Debug info:', value);
  expect(value).toBe(...);
});
```

**Run only one test:**

```typescript
it.only("should work", () => {
  // Only this test runs
});
```

**Skip a test:**

```typescript
it.skip("should work", () => {
  // This test is skipped
});
```

**Run tests in debug mode:**

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/)
- [ts-jest Configuration](https://kulshekhar.github.io/ts-jest/)
