# RAG Demo: Code Quality & Maintainability Improvements Plan

**Status:** Planning phase  
**Created:** 2026-09-10  
**Target:** Improve code reliability, reduce duplication, enhance maintainability

---

## Executive Summary

The RAG Demo codebase has solid functionality but suffers from:

- **Critical security issues** (password logging, missing validation)
- **Configuration chaos** (same constants duplicated across 7 files with different values)
- **Code duplication** (search/reranking logic copy-pasted between features)
- **Weak architecture** (no database abstraction, no tests, loose type safety)

This plan addresses these systematically in 4 phases, starting with quick wins (security) and building to architectural improvements.

---

## Issues Identified

### Critical Issues 🔴

#### 1. Configuration Constants Scattered Across Files (DRY Violation)

**Problem:**

- `RERANK_THRESHOLD`: 3 different values (0.02 in `documentAnswer.ts`, 0.05 in `server.ts` and `documentSearch.ts`)
- `SEMANTIC_SEARCH_LIMIT`, `PG_SEARCH_LIMIT`, `MAX_CONTEXT_DOCS` duplicated in 2-3 files
- Model URLs (`LM_STUDIO_URL`) defined in multiple places with different defaults
- Database credentials duplicated in `db.ts` and `install-db.ts`

**Impact:** Impossible to tune system; settings diverge over time; changing one threshold requires hunting through codebase

**Files affected:**

- `src/features/documentsQA/documentAnswer.ts`
- `src/retrieval/documentSearch.ts`
- `src/retrieval/hybridCodeSearch.ts`
- `src/core/db.ts`
- `src/infrastructure/server.ts`
- `scripts/install-db.ts`
- `src/core/llm.ts`
- `src/core/embeddings.ts`

---

#### 2. Security Issue: Database Password Logged

**Problem:**

- `src/core/db.ts` logs connection config including database credentials
- No safeguard against logging sensitive information

**Impact:** Credentials exposed in production logs, security audit failure

**File affected:** `src/core/db.ts` (lines 14-19)

---

#### 3. Missing Startup Validation

**Problem:**

- `EMBEDDING_MODEL` in `core/embeddings.ts` never validated (could be undefined)
- `CHAT_MODEL` in `core/llm.ts` not validated before use in API calls
- Silent failures in JSON parsing during streaming
- App starts and fails on first API call instead of fail-fast at startup

**Impact:** Runtime failures hard to debug; poor user experience; silent data loss

**Files affected:**

- `src/core/embeddings.ts` (line 12)
- `src/core/llm.ts` (line 8)

---

#### 4. No Tests At All

**Problem:**

- `package.json` has: `"test": "echo \"Error: no test specified\" && exit 1"`
- Zero test coverage for critical paths (search, reranking, ingestion)
- Impossible to safely refactor or tune thresholds
- Changes to ML pipelines ship untested

**Impact:** Unreliable refactors; tuning attempts break existing behavior; technical debt compounds

**File affected:** `package.json`

---

### Major Architectural Issues 🟠

#### 5. Type Safety Gaps

**Problem:**

- `SearchResult` and `CodeSearchResult` have different structures for similar purposes
- Metadata typed as `any` in multiple places (streaming callbacks, token usage)
- Field name mismatches: camelCase (TypeScript) vs snake_case (SQL) transformed manually in 5 files
- No validation of search result structure across pipeline

**Impact:** Type checking doesn't catch bugs; duplicated row mapping logic; harder to evolve API contracts

---

#### 6. Duplicated Logic Across Features (Code vs Document QA)

**Problem:**  
Document and code QA independently implement identical pipelines:

```
search → rerank → filter → generate
```

Additional duplication:

- Stop words defined twice: `documentSearch.ts` vs `hybridCodeSearch.ts`
- System prompts copied in `embeddings.ts` (lines 40 and 113)
- Query intent detection duplicated in 2 files
- Streaming response handling asymmetric (docs vs code)

**Impact:** Bug fixes in one path don't propagate; maintenance burden grows; testing effort doubles

**Files affected:**

- `src/features/codeQA/codeAnswer.ts`
- `src/features/documentsQA/documentAnswer.ts`
- `src/retrieval/documentSearch.ts` (line 115)
- `src/retrieval/hybridCodeSearch.ts` (line 8)
- `src/core/embeddings.ts`

---

#### 7. No Database Query Abstraction

**Problem:**

- Direct `pool.query()` calls scattered in 6+ files
- Row-to-object transformation logic duplicated
- Column references hardcoded in SQL strings across multiple files
- Field name mapping (snake_case → camelCase) done manually everywhere

**Impact:** Can't audit security; field name changes break multiple files; tight coupling to PostgreSQL; no abstraction for future DB swaps

**Files affected:**

- `src/core/db.ts`
- `src/graph/*.ts`
- `src/retrieval/documentSearch.ts`
- `src/retrieval/hybridCodeSearch.ts`
- `src/ingestion/codeIngest.ts`

---

#### 8. Inconsistent Hybrid Search Implementations

**Problem:**

- `hybridDocumentSearch` vs `hybridCodeSearch` are too similar
- Code version is 3x longer; lessons from one can't be applied to the other
- Duplication makes it impossible to test both consistently

**Impact:** Parallel code paths difficult to maintain; threshold tuning requires changes in two places

---

### Module Organization Issues 🟡

#### 9. Circular Dependencies & Tight Coupling

**Problem:**

- `src/core/embeddings.ts` imports from retrieval layer (violates layering)
- React component detection in ingestion layer instead of parsing layer
- Graph module queries hardcoded in `hybridCodeSearch` instead of abstracted

**Impact:** Difficult to modify layers independently; unpredictable imports; hard to test in isolation

---

#### 10. Configuration Parsed Independently in 7+ Files

**Problem:**

- Each file parses `process.env` independently with inconsistent validation
- Magic numbers throughout: `0.02`, `0.05`, `0.3`, `1.5`
- No centralized config module

**Impact:** Tuning is scattered; easy to miss instances; hard to document all knobs

---

#### 11. Embedding Preparation Logic in Wrong Layer

**Problem:**

- `src/ingestion/codeIngest.ts` prepends entity type hints to embedding text (lines 26-49)
- This is model-specific concern, not ingestion-specific
- Changing embedding models requires re-ingesting all documents

**Impact:** Not scalable; embedding model is a core concern, not an ingestion detail

---

### Testing & Logging Gaps 📝

#### 12. Sparse Instrumentation

**Problem:**

- Token usage logged but not persisted (can't track costs over time)
- Ingestion logging: only counts, no per-file progress or failure tracking
- No structured logging (levels, context)
- Silent error swallowing in `core/llm.ts` (line 145) and `parsing/languages/typescript/parser.ts` (line 140)

**Impact:** Can't diagnose ingestion failures; no cost visibility; errors disappear silently

---

#### 13. Inconsistent Streaming Response Handling

**Problem:**

- Document streaming: uses SSE error events
- Code streaming: no streaming support at all
- Error handling asymmetric between endpoints
- Callback types loose (`usage: any`)

**Impact:** Inconsistent client experience; can't add streaming to code QA without major refactor; type errors hidden

---

## Improvement Plan

### PHASE 1: Security & Startup Validation (Critical) — 30 min ⚡

**Goals:**

- Fix password logging security issue
- Add fail-fast startup validation
- Prevent runtime surprises

#### Step 1.1: Remove password from logs

**File:** `src/core/db.ts`

**Changes:**

- Strip sensitive fields before logging connection config
- Log only safe fields: `host`, `port`, `database`
- Add explicit validation that `DB_USER` and `DB_PASSWORD` exist

**Why:** Credentials should never appear in logs, even at debug level

---

#### Step 1.2: Add model validation

**Files:**

- `src/core/llm.ts`
- `src/core/embeddings.ts`

**Changes:**

- Validate `CHAT_MODEL` and `EMBEDDING_MODEL` at module load time
- Throw descriptive error if missing (fail-fast before server starts)
- Validate URLs are accessible (optional: add healthcheck)

**Why:** Bad configuration caught immediately, not on first API call

---

#### Step 1.3: Verify

Run: `npm start` without required env vars → should fail immediately with clear error message

---

### PHASE 2: Centralized Configuration & Constants — 1-2 hours 📋

**Goals:**

- Single source of truth for all configuration
- Environment-based tuning without code changes
- Comprehensive documentation via `.env.example`

#### Step 2.1: Create centralized config schema

**New file:** `src/infrastructure/configSchema.ts`

**What goes here:**

- Threshold values: `RERANK_THRESHOLD`, `SEMANTIC_SEARCH_LIMIT`, `PG_SEARCH_LIMIT`, `MAX_CONTEXT_DOCS`
- Model URLs and parameters: `LM_STUDIO_URL`, model names, temperatures, max_tokens
- Database config: host, port, database, user, pool size
- Boost multipliers and weights (currently hardcoded `1.5` in hybridCodeSearch)
- Stop words lists (currently duplicated)
- Server config: port, logging level

**Implementation approach:**

- Use Zod or similar for runtime validation
- Export validated singleton config object
- Include defaults for all values
- Provide clear error messages for missing required vars

**Example structure:**

```typescript
const configSchema = z.object({
  database: z.object({
    host: z.string(),
    port: z.number().default(5432),
    database: z.string(),
    user: z.string(),
    password: z.string(),
  }),
  reranking: z.object({
    documentThreshold: z.number().default(0.05),
    codeThreshold: z.number().default(0.05),
  }),
  search: z.object({
    semanticLimit: z.number().default(10),
    pgLimit: z.number().default(10),
    maxContextDocs: z.number().default(5),
  }),
  // ... etc
});

export const config = configSchema.parse(process.env);
```

---

#### Step 2.2: Replace hardcoded constants

**Files to update:**

- `src/features/documentsQA/documentAnswer.ts` → import thresholds from config
- `src/retrieval/documentSearch.ts` → import limits, stop words from config
- `src/retrieval/hybridCodeSearch.ts` → import limits, boost, stop words from config
- `src/core/db.ts` → import DB config from config
- `src/infrastructure/server.ts` → import server config from config
- `scripts/install-db.ts` → import DB config from config

**Verification:**

- Search for hardcoded numbers (0.02, 0.05, 1.5, etc.)
- Should only appear in `configSchema.ts` (and comments)
- Grep: `grep -r "[0-9]\.[0-9]\{2\}" src/ | grep -v "node_modules"`

---

#### Step 2.3: Create `.env.example`

**New file:** `.env.example`

**Contents:**

- Document all required and optional environment variables
- Show default values
- Add comments explaining what each setting does
- Group by concern (database, models, search parameters, server)

**Example:**

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rag_demo
DB_USER=rag_user
DB_PASSWORD=

# LLM
CHAT_MODEL=neural-chat
LM_STUDIO_URL=http://localhost:1234

# Embeddings
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDINGS_URL=http://localhost:8000

# Search Thresholds
RERANK_THRESHOLD_DOCUMENTS=0.05
RERANK_THRESHOLD_CODE=0.05

# etc...
```

---

#### Step 2.4: Verify

- Run `npm start` with different `.env` values
- Verify config changes propagate (e.g., change RERANK_THRESHOLD, test behavior)
- Run with missing required vars → should fail with clear error pointing to missing var name
- Verify `.env.example` documents all vars actually used

---

### PHASE 3: Architectural Abstractions — 4-6 hours 🏗️

**Goals:**

- Reduce code duplication
- Enable safe refactoring
- Improve type safety
- Prepare for testing

#### Step 3A: Database Query Abstraction

##### Step 3A.1: Create Repository pattern

**New file:** `src/core/repository.ts`

**What it contains:**

```typescript
// Base repository class
export abstract class Repository {
  protected pool: Pool;

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    // Execute query, map snake_case → camelCase, return T[]
  }

  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    // Execute query, return first result or null
  }

  // Field mapping: snake_case (SQL) → camelCase (TypeScript)
  protected mapRow<T>(row: Record<string, any>, schema: FieldMap): T {
    // Generic row transformation
  }
}

// Concrete implementations
export class CodeRepository extends Repository {
  async getCodeSymbols(): Promise<CodeSymbol[]> { ... }
  async getEdges(): Promise<Edge[]> { ... }
  // etc.
}

export class DocumentRepository extends Repository {
  async getDocuments(): Promise<Document[]> { ... }
  async storeEmbeddings(): Promise<void> { ... }
  // etc.
}
```

**Benefits:**

- Single place to audit SQL queries
- Field name mapping centralized
- Consistent error handling
- Easy to add query logging/monitoring
- Future DB swaps (PostgreSQL → MongoDB, etc.)

---

##### Step 3A.2: Consolidate database queries

**Refactor these files:**

- `src/core/db.ts` → migrate queries to `CodeRepository`
- `src/graph/*.ts` → use `CodeRepository` methods
- `src/retrieval/documentSearch.ts` → use `DocumentRepository`
- `src/retrieval/hybridCodeSearch.ts` → use `CodeRepository`
- `src/ingestion/codeIngest.ts` → use `CodeRepository`

**Process:**

1. Extract each `pool.query()` into a Repository method
2. Replace direct calls with repository method calls
3. Update types to use repository's result type
4. Test that behavior is identical (same SQL, same results)

**Verification:**

- `grep -r "pool.query" src/` → should only appear in repository.ts
- `grep -r "snake_case" src/` → should only map in repository.ts
- All queries still work (test each module)

---

#### Step 3B: Unified Search & Reranking Interfaces

##### Step 3B.1: Create shared result types

**New file:** `src/retrieval/types.ts`

**What it contains:**

```typescript
// Base result type used everywhere
export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
  source: "code" | "document";
}

// Helper types
export type DocumentSearchResult = SearchResult & { source: "document" };
export type CodeSearchResult = SearchResult & { source: "code" };

// Reranker input/output
export interface RerankerInput {
  query: string;
  results: SearchResult[];
}

export interface RerankerOutput {
  results: SearchResult[];
}
```

**Why:** All search and reranking operates on same data shape

---

##### Step 3B.2: Unify Reranker interface

**Files to update:**

- `src/retrieval/reranker.ts` (interface already exists, enhance it)
- `src/retrieval/reranker-bge.ts` (implement unified interface)
- `src/retrieval/codeReranker.ts` (implement unified interface)

**Changes:**

- Both rerankers accept `SearchResult[]` (via new unified type)
- Both return `SearchResult[]` with updated scores
- Move hybrid-specific reranking logic from `hybridCodeSearch.ts` to `CodeReranker`

**Verification:**

- Both code and document search results have `SearchResult` type
- Reranker input/output matches type
- No type casting needed between search → rerank stages

---

##### Step 3B.3: Extract common QA pipeline

**New file:** `src/features/qaEngine.ts`

**What it contains:**

```typescript
export interface QAInput {
  query: string;
  search: (q: string) => Promise<SearchResult[]>;
  rerank: (results: SearchResult[]) => Promise<SearchResult[]>;
  filter: (results: SearchResult[]) => SearchResult[];
  generate: (query: string, context: SearchResult[]) => Promise<string>;
}

export class QAEngine {
  async answer(input: QAInput): Promise<string> {
    // search → rerank → filter → generate
    // With proper error handling and logging
  }
}
```

**Why:** Both code and document QA use identical orchestration pattern

**Update these files:**

- `src/features/codeQA/codeAnswer.ts` → use QAEngine
- `src/features/documentsQA/documentAnswer.ts` → use QAEngine

**Before:**

```typescript
// codeAnswer.ts
const results = await searchCode(query);
const reranked = await reranker.rerank(results);
const filtered = filterResults(reranked);
const answer = await llm.generate(query, filtered);

// documentsQA.ts
const results = await searchDocuments(query);
const reranked = await reranker.rerank(results);
const filtered = filterResults(reranked);
const answer = await llm.generate(query, filtered);
```

**After:**

```typescript
// Both now use
const answer = await qaEngine.answer({
  query,
  search: searchCode,
  rerank: codeReranker.rerank,
  filter: filterResults,
  generate: llm.generate,
});
```

**Benefit:** Logic change in one place applies to both; easier to test

---

#### Step 3C: Move Model-Specific Logic to Core

##### Step 3C.1: Move embedding preparation

**Current location:** `src/ingestion/codeIngest.ts` (lines 26-49)

**Move to:** `src/core/embeddings.ts`

**Changes:**

- Create method `prepareTextForEmbedding(text: string, context?: any): string`
- Handles model-specific text preparation (entity type hints, etc.)
- Ingestion imports and uses this method instead of doing it locally

**Why:** Embedding model details are core concerns, not ingestion concerns

**Verification:**

- Ingestion doesn't know about embedding internals
- Same embedding prep used in all embedding contexts (ingestion, search)
- Changing embedding model doesn't require re-ingestion (just uses new prep method)

---

##### Step 3C.2: Fix circular dependencies

**Current issue:** `src/core/embeddings.ts` imports from retrieval layer

**Fix:**

- Remove embeddings → retrieval import
- Create `src/retrieval/embeddingSearch.ts` that uses embeddings from core
- Move vector search logic (currently in core) to retrieval layer

**Why:** Core layer should be pure/domain logic; retrieval uses core, not vice versa

---

#### Step 3D: Verify

- All search (code, document, hybrid) returns `SearchResult` type
- Type checker passes: `tsc --noEmit` shows no `any` types in retrieval
- Both QA paths use `QAEngine`
- Rerankers work identically for both code and document results
- No circular imports: `tsc` compiles cleanly

---

### PHASE 4: Testing & Quality Assurance — 8+ hours ✅

**Goals:**

- Prevent regressions
- Enable safe threshold tuning
- Improve observability and error handling

#### Step 4.1: Set up test infrastructure

**Install:**

```bash
npm install --save-dev jest @types/jest ts-jest
```

**New files:**

- `jest.config.js`
- `__tests__/` directory structure

**Update:**

- `package.json` → `"test": "jest"`

**jest.config.js template:**

```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__", "<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
};
```

---

#### Step 4.2: Add unit tests for critical paths

**Test files to create:**

##### `__tests__/retrieval/codeSearch.test.ts`

- Mock database (Repository pattern makes this easy)
- Test filtering logic
- Test scoring
- Test threshold cutoffs

##### `__tests__/retrieval/documentSearch.test.ts`

- Mock embeddings API
- Test search results have correct structure
- Test limit enforcement

##### `__tests__/retrieval/reranker.test.ts`

- Test both code and document rerankers
- Test threshold filtering
- Test score normalization

##### `__tests__/features/qaEngine.test.ts`

- Full pipeline with mocks
- Test search → rerank → filter → generate flow
- Test error propagation

**Minimum Coverage Target:** 80% on retrieval + features layers

---

#### Step 4.3: Add integration tests

##### `__tests__/ingestion/codeIngest.test.ts`

- Test with sample TypeScript files
- Verify symbols extracted correctly
- Verify edges created
- Verify embeddings stored

##### `__tests__/ingestion/documentIngest.test.ts`

- Test chunking with various document sizes
- Verify metadata preserved
- Verify storage

---

#### Step 4.4: Fix inconsistent error handling

**Files to update:**

- `src/infrastructure/server.ts` (line 86-88)
  - Add request context to error logs (URL, method, query)
  - Structured error response with error ID for debugging

- `src/core/llm.ts` (line 145)
  - Handle JSON parse errors in streaming with error event
  - Log error details for debugging

- `src/parsing/languages/typescript/parser.ts` (line 140)
  - Log or surface parse failures instead of silently ignoring
  - Include context: file path, line number of parse failure

---

#### Step 4.5: Add structured logging (Optional but recommended)

**Choose one:**

- `winston` (popular, feature-rich)
- `pino` (fast JSON logging)

**Add logging to:**

- Search/reranking decisions (why did result get filtered?)
- Ingestion progress (files processed, failures)
- API calls (latency, errors)
- Token usage (track costs)

**Example:**

```typescript
logger.debug("Filtering search results", {
  inputCount: results.length,
  threshold: config.reranking.threshold,
  outputCount: filtered.length,
});
```

---

#### Step 4.6: Consolidate streaming behavior

**Goals:** Align code QA with document QA

**Changes:**

- Add streaming support to code QA (matches documents)
- Use consistent SSE error event format
- Properly type streaming callbacks (not `any`)
- Document streaming protocol in README

**Files to update:**

- `src/features/codeQA/codeAnswer.ts`
- `src/infrastructure/server.ts` (streaming endpoint)

---

#### Step 4.7: Verify

- `npm test` passes with >80% coverage on critical layers
- Run ingestion with sample code, verify all steps logged
- Manual test: start app without env vars → clear error
- Manual test: stream code QA response → matches document QA format
- Error messages provide actionable context (not just "Error!")

---

## Implementation Sequence

### Quick Start (30 min)

1. **Phase 1.1** - Remove password logging
2. **Phase 1.2** - Add startup validation

### Foundation (1-2 hours)

3. **Phase 2.1** - Create config schema
4. **Phase 2.2** - Replace constants (largest file updates)
5. **Phase 2.3** - Create `.env.example`

### Architecture (4-6 hours)

6. **Phase 3A** - Repository abstraction (enables future work)
7. **Phase 3B** - Unified search types
8. **Phase 3C** - Shared QA engine
9. **Phase 3D** - Fix circular dependencies

### Quality (ongoing)

10. **Phase 4.1** - Jest setup (enables testing)
11. **Phase 4.2** - Unit tests (retrieval layer first)
12. **Phase 4.3** - Integration tests
13. **Phase 4.4-7** - Error handling, logging, streaming

---

## Success Criteria

### Phase 1 ✅

- [ ] No passwords in logs (even at debug level)
- [ ] App fails to start with clear error if required env vars missing

### Phase 2 ✅

- [ ] All configuration from single `configSchema.ts`
- [ ] No hardcoded numbers in src/ except in `configSchema.ts`
- [ ] `.env.example` documents all vars

### Phase 3 ✅

- [ ] All searches return `SearchResult` type
- [ ] `pool.query()` only in `repository.ts`
- [ ] Both code/document QA use `QAEngine`
- [ ] No `any` types in retrieval layer (TypeScript strict mode passes)
- [ ] No circular imports

### Phase 4 ✅

- [ ] `npm test` runs successfully
- [ ] 80%+ coverage on retrieval + features
- [ ] Ingestion errors surfaced clearly
- [ ] Streaming works identically for code + documents
- [ ] All error messages include context (stack trace, request ID, etc.)

---

## Related Issues (Lower Priority)

1. **Query Intent Detection Duplication** (2 files)
   - Extract to `src/core/queryAnalyzer.ts`
   - Defer to Phase 4

2. **React Component Detection in Wrong Layer**
   - Currently in `src/ingestion/codeIngest.ts`
   - Move to `src/parsing/languages/typescript/parser.ts`
   - Defer to Phase 3 or 4

3. **Cost Tracking**
   - Token usage logged but not persisted
   - Optional: Add SQLite table in Phase 4
   - Enable long-term cost visibility

---

## Questions for Implementation

As we work through each phase:

- Should we use Zod or a simpler approach for config validation?
- Should we migrate to Winston/Pino logging, or add basic structured logging?
- Target Node version for test setup?
- Should streaming be fully async (WebSocket) or stay with SSE?

---

## Notes

- This plan is iterative; we can adjust scope or skip items based on priorities
- Each phase is mostly independent (Phase 3 depends on Phase 2)
- High test coverage in Phase 4 makes later refactors safe
- Configuration centralization (Phase 2) unblocks threshold tuning experiments
