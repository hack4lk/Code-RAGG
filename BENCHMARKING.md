# Benchmarking: Reranker Performance Testing

## Overview
The RAG system supports an optional reranker (Qwen3-Reranker-0.6B) that improves answer quality by filtering results. You can disable it to benchmark performance vs. quality trade-offs.

## How to Test

### Test WITH Reranker (Default)
```bash
# Make sure .env has DISABLE_RERANKER=false
echo "DISABLE_RERANKER=false" >> .env

# Start the server
npx tsx src/server/server.ts &
sleep 2

# Run benchmark
npx tsx src/tests/benchmark-reranker.ts
```

**Result**: Slower (~2-5s per query) but higher quality answers

### Test WITHOUT Reranker
```bash
# Disable reranker in .env
echo "DISABLE_RERANKER=true" >> .env

# Start the server
npx tsx src/server/server.ts &
sleep 2

# Run benchmark
npx tsx src/tests/benchmark-reranker.ts
```

**Result**: Faster (~0.5-1s per query) but may include less relevant results

## What the Reranker Does

**With Reranker Enabled:**
1. Find semantically similar results (vector search)
2. Run each through Qwen model: "Does this answer the question?"
3. Filter by reranker score (default 0.05 threshold)
4. Sort by reranker confidence
5. Send top 3 to LLM

**With Reranker Disabled:**
1. Find semantically similar results (vector search)
2. Filter by semantic similarity alone (default 0.05 threshold)
3. Sort by semantic similarity
4. Send top 3 to LLM

## Expected Performance Differences

| Aspect | With Reranker | Without Reranker |
|--------|---------------|------------------|
| Speed | 2-5s per query | 0.5-1s per query |
| Quality | Higher (LLM validates) | Good (but may include noise) |
| Cost | Higher (LLM inference) | Lower (no LLM) |
| Use Case | Production | Fast prototyping |

## Environment Variables

```env
# Enable/disable reranking (default: false)
DISABLE_RERANKER=false

# When disabled, these thresholds still apply:
CODE_RERANK_THRESHOLD=0.05      # For reranker (ignored when disabled)
CODE_SIMILARITY_SCORE=0.05       # For semantic similarity (always used)
```

## Running Your Own Benchmarks

Edit `benchmark-reranker.ts` to add your own test queries:

```typescript
const queries = [
  "your question here?",
  "another test query?",
  // Add more...
];
```

Then run:
```bash
npx tsx src/tests/benchmark-reranker.ts
```

## Tips

- **For quick feedback loops**: Use `DISABLE_RERANKER=true`
- **For production**: Use `DISABLE_RERANKER=false` (default)
- **To optimize**: Lower `CODE_RERANK_THRESHOLD` for stricter filtering
- **For bleeding edge**: Disable reranker but increase `CODE_SIMILARITY_SCORE` to 0.3+
