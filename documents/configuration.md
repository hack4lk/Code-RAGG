# Configuration Guide

Comprehensive guide for configuring the RAG Demo application.

## Environment Variables

Configuration is managed through the `.env` file in the project root.

### Template (.env.example)

```env
# ============================================
# MODEL PROVIDER SELECTION
# ============================================

# Choose: "lm_studio" or "openai"
MODEL_PROVIDER=lm_studio

# ============================================
# LM STUDIO CONFIGURATION
# ============================================

# Local inference server endpoint (only used when MODEL_PROVIDER=lm_studio)
LM_STUDIO_URL=http://localhost:1234/v1

# Embedding model name (must be loaded in LM Studio)
# IMPORTANT: Embeddings ALWAYS use LM Studio regardless of MODEL_PROVIDER setting
# Examples (768 dimensions):
#   - text-embedding-nomic-embed-text-v1.5@q4_k_m (recommended)
#   - all-MiniLM-L6-v2
EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5@q4_k_m

# Chat model name (used when MODEL_PROVIDER=lm_studio)
# Examples:
#   - qwen/qwen3.5-9b (recommended for code)
#   - llama2-7b
#   - mistral-7b
CHAT_MODEL=qwen/qwen3.5-9b

# ============================================
# OPENAI CONFIGURATION (optional)
# ============================================

# OpenAI API endpoint (only used when MODEL_PROVIDER=openai)
OPENAI_API_URL=https://api.openai.com/v1

# OpenAI API key (required if MODEL_PROVIDER=openai)
OPENAI_API_KEY=sk-your-key-here

# OpenAI chat model (used when MODEL_PROVIDER=openai)
# Examples:
#   - gpt-4 (recommended)
#   - gpt-4-turbo
#   - gpt-3.5-turbo
OPENAI_MODEL=gpt-4

# ============================================
# DOCUMENT INGESTION CONFIGURATION
# ============================================

# Path to markdown documents directory (can be anywhere on filesystem)
DOCUMENTS_DIR=/Users/lukasz/Documents/ChatGPT/rag_docs

# ============================================
# CODE INGESTION CONFIGURATION
# ============================================

# Root directory for code parsing (can be anywhere on filesystem)
CODE_SOURCE_DIRECTORY=/Users/lukasz/Documents/ChatGPT/src

# Directories to skip during code parsing (comma-separated)
CODE_SKIP_DIRECTORIES=node_modules,.git,dist,build,coverage,tests

# File extensions to process (comma-separated, without dots)
CODE_EXTENSIONS=ts,tsx,js,jsx

# ============================================
# DATABASE CONFIGURATION
# ============================================

# PostgreSQL host
DB_HOST=localhost

# PostgreSQL port
DB_PORT=5432

# PostgreSQL database name
DB_NAME=rag_demo

# PostgreSQL user
DB_USER=postgres

# PostgreSQL password
DB_PASSWORD=your_password_here

# ============================================
# SERVER CONFIGURATION
# ============================================

# HTTP server port
PORT=3000
```

## Configuration Reference

### Model Provider Selection

#### MODEL_PROVIDER

- **Type**: String (`"lm_studio"` or `"openai"`)
- **Required**: Yes
- **Default**: `lm_studio`
- **Description**: Which LLM provider to use for chat completions and reasoning

**Provider Comparison**:

| Aspect      | LM Studio                  | OpenAI            |
| ----------- | -------------------------- | ----------------- |
| **Cost**    | Free (local)               | Paid (per-token)  |
| **Speed**   | Depends on hardware        | Fast (API)        |
| **Privacy** | 100% local                 | Sent to OpenAI    |
| **Models**  | Limited to loaded models   | All OpenAI models |
| **Setup**   | Requires LM Studio running | API key only      |

**Important**: Embeddings always use LM Studio regardless of this setting (for consistency and cost savings)

### LM Studio Configuration

#### EMBEDDING_MODEL

- **Type**: String
- **Required**: Yes
- **Default**: `text-embedding-nomic-embed-text-v1.5@q4_k_m`
- **Description**: Name of the embedding model loaded in LM Studio
- **Important**: Embeddings always use this model regardless of `MODEL_PROVIDER` setting
- **Supported Models** (768 dimensions recommended):
  - `text-embedding-nomic-embed-text-v1.5@q4_k_m` - **Recommended**, excellent quality, ~100 MB
  - `all-MiniLM-L6-v2` - Good quality, fast, ~100 MB
  - Other models: Must use 768-dimensional embeddings (database schema is fixed at vector(768))

**Selection Tips**:

- Use `text-embedding-nomic-embed-text-v1.5@q4_k_m` for best quality/speed balance
- Do not use OpenAI embedding models (different dimensions, would require re-ingesting all data)
- Changing embedding models requires re-ingesting all documents

#### CHAT_MODEL

- **Type**: String
- **Required**: Yes
- **Default**: `qwen/qwen3.5-9b`
- **Description**: Name of the chat model loaded in LM Studio
- **Supported Models**:
  - `qwen/qwen3.5-9b` - Excellent code understanding, ~6-9 GB (quantized)
  - `llama2-7b` - Good general knowledge, ~7 GB
  - `mistral-7b` - Fast and capable, ~7 GB
  - `neural-chat-7b` - Good conversation quality, ~7 GB

**Selection Tips**:

- For code-heavy projects: `qwen/qwen3.5-9b`
- For general documentation: `mistral-7b` (faster)
- For balanced results: `llama2-7b` or `neural-chat-7b`

#### LM_STUDIO_URL

- **Type**: URL
- **Required**: When `MODEL_PROVIDER=lm_studio` or for embeddings
- **Default**: `http://localhost:1234/v1`
- **Description**: Endpoint for LM Studio local inference server
- **Examples**:
  - Local: `http://localhost:1234/v1`
  - Remote (same network): `http://192.168.1.100:1234/v1`
  - Docker: `http://lm-studio:1234/v1`
- **Note**: Always required for embeddings, even when using OpenAI for chat

### OpenAI Configuration (Optional)

#### OPENAI_API_URL

- **Type**: URL
- **Required**: When `MODEL_PROVIDER=openai`
- **Default**: `https://api.openai.com/v1`
- **Description**: Endpoint for OpenAI API
- **Examples**:
  - Official: `https://api.openai.com/v1`
  - Azure: `https://<resource>.openai.azure.com/v1`
  - Compatible services: Any service with OpenAI-compatible API

#### OPENAI_API_KEY

- **Type**: String (Secret)
- **Required**: When `MODEL_PROVIDER=openai`
- **Default**: (empty)
- **Description**: Your OpenAI API key
- **How to get**:
  1. Go to https://platform.openai.com/api-keys
  2. Create a new API key
  3. Copy and paste into `.env`
- **Security**:
  - Never commit to version control
  - Use environment variables in production
  - Rotate periodically

#### OPENAI_MODEL

- **Type**: String
- **Required**: When `MODEL_PROVIDER=openai`
- **Default**: `gpt-4`
- **Description**: OpenAI model to use for chat completions
- **Recommended Models**:
  - `gpt-4` - Most capable (recommended)
  - `gpt-4-turbo` - Faster than GPT-4, more tokens
  - `gpt-3.5-turbo` - Fast and economical
- **Note**: Embedding always uses local LM Studio (not affected by this setting)

### Document Ingestion Configuration

#### DOCUMENTS_DIR

- **Type**: Path (absolute or relative)
- **Required**: For document ingestion only
- **Default**: `documents`
- **Description**: Directory containing markdown files to ingest
- **Can be anywhere**: `/Users/lukasz/Documents/my-docs`, `../docs`, etc.
- **Usage**:
  ```bash
  npx tsx src/ingest.ts  # Ingests all .md files from DOCUMENTS_DIR
  ```

### Database Configuration

#### DB_HOST

- **Type**: String
- **Required**: Yes
- **Default**: `localhost`
- **Description**: PostgreSQL server hostname
- **Examples**:
  - Local: `localhost`
  - Docker: `postgres-db`
  - AWS RDS: `mydb.xxxxx.us-east-1.rds.amazonaws.com`

#### DB_PORT

- **Type**: Number
- **Required**: Yes
- **Default**: `5432`
- **Description**: PostgreSQL server port
- **Note**: Standard PostgreSQL port is 5432

#### DB_USER

- **Type**: String
- **Required**: Yes
- **Default**: `postgres`
- **Description**: PostgreSQL username
- **Examples**:
  - Local system user: `postgres`
  - Application user: `rag_user`

#### DB_PASSWORD

- **Type**: String
- **Required**: If authentication required
- **Default**: (empty)
- **Description**: PostgreSQL password
- **Security Note**:
  - For development: Can be empty for local system user
  - For production: Use strong passwords and environment secrets

#### DB_NAME

- **Type**: String
- **Required**: Yes
- **Default**: `rag_demo`
- **Description**: PostgreSQL database name
- **Note**: Must already exist; use `createdb rag_demo` to create

### Code Ingestion Configuration

#### CODE_SOURCE_DIRECTORY

- **Type**: Path
- **Required**: Yes
- **Default**: `src`
- **Description**: Root directory containing code to ingest
- **Examples**:
  - Single directory: `src`
  - Full project: `.`
  - Multiple (run separately): `src` then `lib`

#### CODE_SKIP_DIRECTORIES

- **Type**: Comma-separated list
- **Required**: No
- **Default**: `node_modules,.git,dist,build,coverage,tests`
- **Description**: Directories to skip during code parsing
- **Common Values**:
  - `node_modules` - Dependencies (huge and slow)
  - `.git` - Version control metadata
  - `dist`, `build` - Compiled output (don't index)
  - `coverage` - Test coverage (don't index)
  - `tests` - Can skip if you only want production code
  - `__pycache__` - Python cache
  - `venv`, `env` - Virtual environments

**Tips**:

- Skip dependency directories to speed up ingestion
- Skip compiled output to avoid duplicates
- Include test directories if they contain important examples

#### CODE_EXTENSIONS

- **Type**: Comma-separated list
- **Required**: Yes
- **Default**: `ts,tsx,js,jsx`
- **Description**: File extensions to process (without dots)
- **Common Values**:
  - TypeScript: `ts,tsx`
  - JavaScript: `js,jsx`
  - Python: `py`
  - Go: `go`
  - Java: `java`
  - Rust: `rs`

**Tips**:

- Only include extensions relevant to your project
- More extensions = longer ingestion time
- Some languages have better parser support

### Server Configuration

#### PORT

- **Type**: Number
- **Required**: No
- **Default**: `3000`
- **Description**: HTTP server port for the API and web UI
- **Examples**:
  - Development: `3000`
  - Production: `8080`
  - Behind proxy: `3000`

**Note**: Must be available and not in use by other services.

### Optional Configurations

#### DEBUG

- **Type**: Boolean
- **Default**: `false`
- **Description**: Enable verbose debug logging
- **Values**: `true` or `false`
- **Usage**: Helpful for troubleshooting issues

#### REQUEST_TIMEOUT

- **Type**: Number (milliseconds)
- **Default**: `30000` (30 seconds)
- **Description**: Request timeout for LLM API calls
- **Tips**:
  - Increase for slower hardware or larger context
  - Decrease for faster timeouts (not recommended)
  - Typical: 30000-60000

#### BATCH_SIZE

- **Type**: Number
- **Default**: `32`
- **Description**: Number of embeddings to create in parallel
- **Tips**:
  - Higher = faster ingestion but more memory
  - Lower = slower ingestion but less memory
  - Typical: 8-64 depending on GPU

## Advanced Configuration

### Performance Tuning

#### For Faster Ingestion

```env
# Use smaller/faster model
EMBEDDING_MODEL=all-MiniLM-L6-v2
CODE_EXTENSIONS=ts,js
BATCH_SIZE=64
```

#### For Better Quality

```env
# Use larger models with more dimensions
EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5@q4_k_m
CHAT_MODEL=llama2-7b
REQUEST_TIMEOUT=60000
```

#### For Production

```env
DB_HOST=prod-db.aws.com
DB_USER=rag_user
DB_PASSWORD=<strong-password>
DEBUG=false
PORT=8080
```

### Multi-Model Setup

If you want to run multiple models:

1. **Load multiple models in LM Studio**
2. **Create separate environment files**:
   ```bash
   cp .env .env.fast
   cp .env .env.quality
   ```
3. **Use with command**:
   ```bash
   # Run with different config
   . .env.fast && npx tsx src/ingest.ts
   . .env.quality && npx tsx src/server/server.ts
   ```

### Docker Environment

For Docker deployment, pass environment variables:

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY . .
RUN npm install

ENV LM_STUDIO_URL=http://lm-studio:1234/v1
ENV DB_HOST=postgres-db
ENV DB_PORT=5432
ENV DB_USER=rag_user
ENV PORT=3000

EXPOSE 3000

CMD ["npx", "tsx", "src/server/server.ts"]
```

Or in docker-compose:

```yaml
services:
  app:
    image: rag-demo:latest
    environment:
      LM_STUDIO_URL: http://lm-studio:1234/v1
      DB_HOST: postgres-db
      DB_PORT: 5432
      DB_USER: rag_user
      DB_PASSWORD: password
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      - postgres-db
      - lm-studio
```

## Configuration Validation

Verify your configuration:

```bash
# Check Node.js
node -e "console.log('Node.js:', process.version)"

# Check environment variables
npx tsx -e "console.log(process.env)"

# Test database connection
npx tsx -e "import pool from './src/db.js'; pool.query('SELECT NOW()', (err, res) => { console.log(res?.rows[0]); process.exit(err ? 1 : 0); })"

# Test LM Studio connection
curl "$LM_STUDIO_URL/models"

# Verify TypeScript
npx tsc --noEmit
```

## Common Configuration Issues

### Issue: "Database connection failed"

**Solution**: Verify DB_HOST, DB_PORT, DB_USER, DB_PASSWORD

### Issue: "Cannot connect to LM Studio"

**Solution**: Verify LM_STUDIO_URL and that LM Studio is running

### Issue: "Model not found in LM Studio"

**Solution**: Verify EMBEDDING_MODEL and CHAT_MODEL names match loaded models

### Issue: "Ingestion is very slow"

**Solution**: Use faster model or reduce CODE_EXTENSIONS, increase BATCH_SIZE

### Issue: "Out of memory during ingestion"

**Solution**: Reduce BATCH_SIZE, skip more directories with CODE_SKIP_DIRECTORIES

## Next Steps

1. Create and validate `.env` file
2. Test database connection
3. Verify LM Studio is running
4. Run ingestion scripts
5. Start the server
6. Check [api.md](api.md) for API usage
7. See [faq.md](faq.md) for troubleshooting
