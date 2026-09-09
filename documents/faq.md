# Frequently Asked Questions

Common questions and solutions for the RAG Demo application.

## Installation & Setup

### Q: How do I install PostgreSQL?

**A:** See [installation.md](installation.md#prerequisites-installation) for platform-specific instructions.

**Quick links:**

- **macOS**: `brew install postgresql@16`
- **Linux**: `sudo apt install postgresql-16`
- **Windows (WSL2)**: See installation guide

### Q: Do I need to manually create the database schema?

**A:** No. Use the provided installation script:

```bash
# After creating the database
createdb rag_demo

# Run the installation script
npx tsx scripts/install-db.ts
```

This script will:
- Install pgvector extension
- Create all required tables if they don't exist
- Create optimized indexes for vector search
- Verify setup is complete

**Manual setup** (if preferred):
1. Create the database:
   ```bash
   createdb rag_demo
   ```

2. Run schema initialization:
   ```bash
   psql -U postgres -d rag_demo < scripts/schema.sql
   ```

### Q: Can I use a remote PostgreSQL database?

**A:** Yes. Update `.env`:

```env
DB_HOST=mydb.example.com
DB_PORT=5432
DB_USER=rag_user
DB_PASSWORD=secure_password
```

For AWS RDS:

```env
DB_HOST=mydb.c9akciq32.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=<your-password>
```

### Q: Do I need LM Studio?

**A:** Yes, LM Studio provides local LLM inference. Download from [lmstudio.ai](https://lmstudio.ai).

**Alternatives** (future support):

- OpenAI API (requires API key)
- Ollama (local, simpler setup)
- HuggingFace Inference API

### Q: Can I use different models than the recommended ones?

**A:** Yes, but model quality affects results. See [configuration.md](configuration.md) for compatible models.

**Recommended:**

- Embedding: `text-embedding-nomic-embed-text-v1.5@q4_k_m`
- Chat: `qwen/qwen3.5-9b` or `mistral-7b`

**Requirements:**

- Embedding model output must be loaded in LM Studio
- Chat model must support `/v1/chat/completions` API

## Data Ingestion

### Q: How do I ingest documents?

**A:**

1. Add markdown files to `documents/` folder
2. Run ingestion:
   ```bash
   npx tsx src/ingest.ts
   ```

This will:

- Find all `.md` files
- Create embeddings
- Store in PostgreSQL

### Q: How do I ingest code?

**A:**

1. Ensure code is in the directory specified by `CODE_SOURCE_DIRECTORY` in `.env` (default: `src`)
2. Run ingestion:
   ```bash
   npx tsx src/codeIngest.ts
   ```

This will:

- Parse TypeScript/JavaScript files
- Extract functions, classes, methods
- Create embeddings
- Store in PostgreSQL

### Q: Does ingestion delete existing data?

**A:** Yes, both `ingest.ts` and `codeIngest.ts` delete all existing data before re-ingesting.

**To preserve data:**

```bash
# Create backup
pg_dump rag_demo > backup.sql

# Ingest
npx tsx src/ingest.ts

# If needed, restore
psql rag_demo < backup.sql
```

### Q: How long does ingestion take?

**A:** Depends on:

- Number of documents/files
- Document size
- LM Studio model speed
- Hardware (CPU/GPU)

**Typical:**

- 10 markdown files: 1-2 minutes
- 50 TypeScript files: 5-10 minutes
- Large codebase (1000+ files): 30+ minutes

**To speed up:**

- Use faster model: `all-MiniLM-L6-v2`
- Increase `BATCH_SIZE` in `.env` (uses more memory)
- Skip more directories with `CODE_SKIP_DIRECTORIES`
- Limit `CODE_EXTENSIONS` to needed types

### Q: Can I ingest selectively (without deleting)?

**A:** Currently, ingestion scripts delete all data. To avoid this, you could:

1. Modify the scripts to check for existing data
2. Maintain separate databases
3. Use different table prefixes

This requires code changes. Request this feature if needed.

### Q: Why is embedding creation slow?

**A:** Embedding depends on:

1. **Model size**: Larger models are slower
2. **Batch size**: Larger batches are faster but use more memory
3. **Hardware**: CPU-only is slow; GPU is fast
4. **Network**: Remote LM Studio adds latency

**Solutions:**

```env
# Use faster model
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Increase batch size (if sufficient memory)
BATCH_SIZE=64

# Or reduce if out of memory
BATCH_SIZE=8
```

## Querying

### Q: How do I ask about my documentation?

**A:** Use the document Q&A endpoint:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I install?"}'
```

Or use `/api/chat/stream` for streaming responses.

### Q: How do I ask about my code?

**A:** Use the code Q&A endpoint:

```bash
curl -X POST http://localhost:3000/api/code/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What does the parseCode function do?"}'
```

### Q: Why am I getting "empty context" errors?

**A:** Causes:

1. **No data ingested** - Run `npx tsx src/ingest.ts` and `npx tsx src/codeIngest.ts`
2. **Question too specific** - Try more general phrasing
3. **Wrong database** - Verify `DB_NAME` in `.env`
4. **Query didn't match anything** - Try rephrasing

**Debug:**

```bash
# Check database has data
psql rag_demo -c "SELECT COUNT(*) FROM document_chunks;"
psql rag_demo -c "SELECT COUNT(*) FROM code_chunks;"

# Test search directly
npx tsx src/tests/hybridCodeSearch-test.ts "your question"
```

### Q: How do I ask about function relationships?

**A:** Use specific question patterns:

```
# What calls this function?
"What calls the parseCode function?"
"Who calls createEmbedding?"

# What does this function call?
"What does ingestCode call?"
"What does parseCodebase call?"

# Where is this used?
"Where is the database pool used?"
"Who uses the reranker?"
```

### Q: Can I ask questions combining code and docs?

**A:** Currently, you must ask either code or document questions separately:

- `/api/chat` - Document questions only
- `/api/code/chat` - Code questions only

Future enhancement could combine both sources.

### Q: Why are answers not accurate?

**A:** Common causes:

1. **Poor question phrasing** - Be specific
2. **Insufficient context** - Ingest more related documents
3. **Model limitations** - Smaller models give worse answers
4. **Relevance threshold too high** - Sources filtered out

**Solutions:**

```env
# Use better model
CHAT_MODEL=llama2-7b

# Lower relevance threshold in server.ts
# Change RERANK_THRESHOLD from 0.05 to 0.02
```

### Q: How do I know which sources were used?

**A:** The API response includes sources:

```json
{
  "answer": "...",
  "sources": [
    {
      "file": "installation.md",
      "chunk": 0,
      "score": 0.85,
      "rerankerScore": 0.92
    }
  ]
}
```

- `score`: Vector similarity (0-1)
- `rerankerScore`: Relevance score (0-1)

Higher scores = more relevant.

## Troubleshooting

### Q: Server won't start - "Cannot find module 'express'"

**A:** Install dependencies:

```bash
npm install
```

Or clean install:

```bash
rm -rf node_modules package-lock.json
npm install
npm install
```

### Q: "ECONNREFUSED" - Cannot connect to PostgreSQL

**A:** PostgreSQL isn't running.

**macOS:**

```bash
brew services start postgresql@16
```

**Linux:**

```bash
sudo systemctl start postgresql
sudo systemctl status postgresql  # verify
```

**Verify connection:**

```bash
psql -U postgres -d rag_demo -c "SELECT 1"
```

### Q: "ECONNREFUSED" - Cannot connect to LM Studio

**A:** LM Studio isn't running.

1. Open LM Studio application
2. Go to "Local Server" tab
3. Click "Start Server"
4. Verify: `curl http://localhost:1234/v1/models`

### Q: "Model not found" error

**A:** Model isn't loaded in LM Studio.

1. Open LM Studio
2. Go to "Search Models" tab
3. Download your model
4. In "Loaded" tab, select and start model
5. Verify with: `curl http://localhost:1234/v1/models | jq '.data[] | .id'`

### Q: "pgvector extension not found"

**A:** Install pgvector extension.

**macOS:**

```bash
brew install pgvector
psql rag_demo -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Linux:**

```bash
sudo apt install postgresql-16-pgvector
psql rag_demo -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Verify:

```bash
psql rag_demo -c "\dx"  # Should list vector extension
```

### Q: "Out of memory" during ingestion

**A:** Reduce batch size and skip more directories.

```env
# In .env
BATCH_SIZE=8
CODE_SKIP_DIRECTORIES=node_modules,.git,dist,build,coverage,tests,__pycache__

# Or ingest in smaller batches
# Split large codebases and run separately
```

### Q: Ingestion very slow

**A:** Use faster model and settings:

```env
EMBEDDING_MODEL=all-MiniLM-L6-v2
BATCH_SIZE=64
CODE_EXTENSIONS=ts,js
CODE_SKIP_DIRECTORIES=node_modules,.git,dist,build,coverage,tests
```

### Q: TypeScript compilation errors

**A:** Run:

```bash
npx tsc --noEmit
```

Check for missing types:

```bash
npm install -D @types/node @types/express
```

### Q: Responses are slow (30+ seconds)

**A:** Causes:

1. **Large context** - Too many sources being searched
2. **Slow model** - Larger models are slower
3. **Slow hardware** - CPU inference is slow
4. **Network latency** - Remote LM Studio adds delay

**Solutions:**

- Reduce model size: `EMBEDDING_MODEL=all-MiniLM-L6-v2`
- Run LM Studio locally (not remote)
- Use GPU if available
- Increase `REQUEST_TIMEOUT` in `.env`

### Q: Getting HTTP 503 or timeouts

**A:** Request is taking too long.

```env
# Increase timeout (milliseconds)
REQUEST_TIMEOUT=60000  # 60 seconds
```

Or optimize:

- Use faster model
- Reduce data being searched
- Check LM Studio is responsive

### Q: No sources returned

**A:** Database is empty or query didn't match.

**Debug:**

```bash
# Check data exists
psql rag_demo -c "SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL;"

# Test embedding creation
npx tsx src/tests/test-embedding.ts

# Test search
npx tsx src/tests/search-test.ts "your question"
```

### Q: Inconsistent answers for same question

**A:** Normal behavior. LLMs have inherent randomness.

To make more consistent:

- Lower `temperature` in `embeddings.ts` (currently 0.1-0.2)
- Use same model consistently

## Performance

### Q: How many documents can I ingest?

**A:** Depends on hardware and database:

- **Typical**: 1000-10000 documents (100k-1M chunks)
- **Limit**: Database storage size (PostgreSQL can handle millions of chunks)
- **Performance**: Search gets slower with more data (mitigated by pgvector indexes)

### Q: What's the maximum question length?

**A:** No hard limit, but practical limit ~5000 characters. LLMs work best with focused questions.

### Q: Can multiple users query simultaneously?

**A:** Yes, Express handles concurrent requests. Performance depends on:

- Number of concurrent users
- Hardware (especially for LM Studio)
- Database connections (default: 10 in pg pool)

For production with many users, use load balancing and connection pooling.

### Q: How do I improve search relevance?

**A:**

1. **Ingest more context** - Add related documents
2. **Better documentation** - Clear, well-organized docs help
3. **Use better model** - `text-embedding-nomic-embed-text-v1.5` is best
4. **Reranker tuning** - Adjust `RERANK_THRESHOLD` in server.ts
5. **Question phrasing** - Be specific and complete

## Development

### Q: How do I add custom models?

**A:** Update `.env` with your model names:

```env
EMBEDDING_MODEL=my-custom-embedding-model
CHAT_MODEL=my-custom-chat-model
```

Ensure models are loaded in LM Studio.

### Q: Can I use this with OpenAI?

**A:** Currently only supports LM Studio's API. To add OpenAI:

1. Modify `embeddings.ts` to use OpenAI endpoint
2. Add OpenAI API key to `.env`
3. Update request format for OpenAI compatibility

Example contribution opportunity!

### Q: How do I modify the reranker?

**A:**

1. See `src/reranker.ts`
2. Understand ranking algorithm
3. Modify or replace scoring logic
4. Test with `src/tests/reranker-test.ts`

For BGE reranker:

- See `src/reranker-bge.ts`
- Requires BGE model loaded in LM Studio

### Q: Can I extend the code parser?

**A:**

1. Modify `src/codeParser.ts`
2. Add new language support
3. Update `CODE_EXTENSIONS` in `.env`
4. Test with `src/tests/test-codeParser.ts`

Currently supports: TypeScript, JavaScript

### Q: How do I contribute improvements?

**A:** File issues and pull requests on the repository.

Areas for contribution:

- Support for more languages
- Better reranking algorithms
- OpenAI/other LLM integration
- Web UI improvements
- Performance optimization

## Data & Privacy

### Q: Where is my data stored?

**A:**

- **Documents & code**: PostgreSQL database
- **Embeddings**: PostgreSQL (pgvector)
- **LM Studio**: Runs locally, models cached locally

All data stays on your machine (if using local setup).

### Q: How do I backup my data?

**A:**

```bash
# Backup database
pg_dump rag_demo > backup.sql

# Restore from backup
psql rag_demo < backup.sql

# Backup specific tables
pg_dump -t code_chunks rag_demo > code_backup.sql
pg_dump -t document_chunks rag_demo > docs_backup.sql
```

### Q: How do I delete data?

**A:**

```bash
# Delete all code data
psql rag_demo -c "DELETE FROM code_chunks;"

# Delete all document data
psql rag_demo -c "DELETE FROM document_chunks; DELETE FROM documents;"

# Full reset
psql rag_demo -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql rag_demo -c "CREATE EXTENSION vector;"
```

### Q: Is my data secure?

**A:** Security considerations:

- **Local setup**: Very secure (no network exposure)
- **Remote DB**: Use SSH tunnels or VPN
- **API**: Add authentication middleware for production
- **Credentials**: Use environment variables, never commit `.env`

## More Help

- Check [README.md](README.md) for architecture overview
- See [installation.md](installation.md) for setup
- Review [configuration.md](configuration.md) for options
- Check [api.md](api.md) for API details

## Still Have Questions?

1. Check application logs: `npx tsx src/server/server.ts 2>&1 | tee app.log`
2. Enable debug logging: `DEBUG=true` in `.env`
3. Check database directly: `psql rag_demo`
4. Test components: See `src/tests/` directory
