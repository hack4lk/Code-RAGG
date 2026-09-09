# Installation Guide

Complete step-by-step instructions for setting up the RAG Demo application.

## System Requirements

### Minimum Requirements

- **Node.js**: v22 or later
- **PostgreSQL**: v16 or later
- **RAM**: 8 GB (16 GB recommended for larger models)
- **Disk Space**: 20 GB minimum (for models and database)

### Supported Platforms

- macOS (Intel and Apple Silicon)
- Linux (Ubuntu 20.04+, Debian 11+)
- Windows (with WSL2)

## Prerequisites Installation

### macOS (Homebrew)

```bash
# Install Node.js
brew install node

# Install PostgreSQL
brew install postgresql@16

# Start PostgreSQL service
brew services start postgresql@16

# Verify installations
node --version    # Should be v22+
psql --version   # Should be 16+
```

### Linux (Ubuntu/Debian)

```bash
# Update package lists
sudo apt update

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql-16 postgresql-contrib-16

# Start PostgreSQL
sudo systemctl start postgresql

# Verify installations
node --version
psql --version
```

### Windows (WSL2)

```bash
# In WSL2 terminal:
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo service postgresql start

# Verify installations
node --version
psql --version
```

## LM Studio Setup

LM Studio provides local inference for embeddings and chat models.

### Installation

1. **Download LM Studio**
   - Visit [lmstudio.ai](https://lmstudio.ai)
   - Download for your platform
   - Install the application

2. **Start LM Studio**
   - Launch the application
   - Go to the "Local Server" tab
   - Configure and start the server (default: `http://localhost:1234`)

3. **Install Models**

   **Embedding Model** (recommended):

   ```
   text-embedding-nomic-embed-text-v1.5@q4_k_m
   ```

   - Size: ~100 MB
   - Quality: Excellent for semantic search
   - Speed: Very fast

   **Chat Model** (recommended):

   ```
   qwen/qwen3.5-9b
   ```

   - Size: ~6-9 GB (quantized)
   - Quality: Good for code understanding
   - Speed: Moderate (depends on hardware)

   **Alternative Models:**
   - **Embedding**: `all-MiniLM-L6-v2` (smaller, faster)
   - **Chat**: `llama2-7b`, `mistral-7b`, `neural-chat-7b`

4. **Verify Server is Running**
   ```bash
   curl http://localhost:1234/v1/models
   ```
   Should return a JSON list of loaded models.

## Database Setup

### Create Database

```bash
# Connect to PostgreSQL (default user: postgres)
psql -U postgres

# In psql shell:

-- Create database
CREATE DATABASE rag_demo;

-- Exit
\q
```

### Automated Schema Installation

The easiest way to set up the database schema is to use the provided installation script:

```bash
npx tsx scripts/install-db.ts
```

This script will:

- Install the pgvector extension
- Create all required tables if they don't exist
- Create optimized indexes for vector search
- Verify all tables are properly set up

**Requirements:**

- PostgreSQL must be running
- Database must be created (`createdb rag_demo`)
- `.env` file must be configured with DB credentials

### Manual Schema Setup (Optional)

If you prefer to create tables manually, use this SQL:

```bash
psql -U postgres -d rag_demo << 'EOF'
-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  filename text NOT NULL UNIQUE,
  content_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Document chunks (from markdown files)
CREATE TABLE IF NOT EXISTS document_chunks (
  id BIGSERIAL PRIMARY KEY,
  source text NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(768) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  document_id bigint REFERENCES documents(id) ON DELETE CASCADE
);

-- Code chunks (from source code)
CREATE TABLE IF NOT EXISTS code_chunks (
  id SERIAL PRIMARY KEY,
  file_path text NOT NULL,
  symbol_name text,
  symbol_type text,
  start_line integer,
  end_line integer,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(768)
);

-- Indexes for vector similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS code_chunks_embedding_idx
  ON code_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

COMMIT;
EOF
```

### Verify Database Setup

Check that tables were created successfully:

```bash
psql -U postgres -d rag_demo -c "\dt"
```

Should show:

````
         List of relations
 Schema |      Name      | Type  | Owner
--------+----------------+-------+-------
 public | code_chunks    | table | postgres
 public | document_chunks| table | postgres
 public | documents      | table | postgres
### Database Credentials

Default PostgreSQL credentials:

- **Host**: `localhost`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: (system user, usually no password on local setup)

For production, create a dedicated user:

```bash
psql -U postgres -d rag_demo << 'EOF'
CREATE USER rag_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE rag_demo TO rag_user;
GRANT USAGE ON SCHEMA public TO rag_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO rag_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO rag_user;
EOF
````

## Application Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd "Rag demo"
```

### 2. Install Dependencies

```bash
npm install
```

This installs:

- `express` - Web framework
- `pg` - PostgreSQL client
- `dotenv` - Environment variable management
- `@types/node`, `@types/express` - TypeScript types
- `tsx` - TypeScript execution
- `typescript` - TypeScript compiler

### 3. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# LM Studio Configuration
LM_STUDIO_URL=http://localhost:1234/v1
EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5@q4_k_m
CHAT_MODEL=qwen/qwen3.5-9b

# Database Configuration
DB_NAME=rag_demo
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
# (leave blank if using system user without password)

# Code Ingestion
CODE_SOURCE_DIRECTORY=src
CODE_SKIP_DIRECTORIES=node_modules,.git,dist,build,coverage,tests
CODE_EXTENSIONS=ts,tsx,js,jsx

# Server
PORT=3000
```

### 4. Verify TypeScript Configuration

```bash
npx tsc --version
npx tsc --noEmit  # Check for type errors
```

## Data Ingestion

### Ingest Documentation

```bash
# Add markdown files to documents/ folder
# Then run:
npx tsx src/ingest.ts
```

This will:

- Find all `.md` files in `documents/`
- Chunk them using `chunkMarkdown()`
- Create embeddings for each chunk
- Store in PostgreSQL

### Ingest Code

```bash
# Run:
npx tsx src/codeIngest.ts
```

This will:

- Parse all code files (TypeScript/JavaScript) matching `CODE_EXTENSIONS`
- Extract functions, classes, and methods
- Create embeddings for each symbol
- Store in PostgreSQL

**Note**: Both commands delete existing data before ingesting. Add backup/versioning if needed.

## Verification

### 1. Verify Node.js

```bash
node -e "console.log('Node.js', process.version)"
# Should output: Node.js v22.x.x
```

### 2. Verify PostgreSQL

```bash
psql -U postgres -d rag_demo -c "SELECT COUNT(*) FROM document_chunks;"
# Should return a count (0 if no data ingested yet)
```

### 3. Verify LM Studio

```bash
curl -s http://localhost:1234/v1/models | jq '.data | length'
# Should return the number of loaded models
```

### 4. Start Application

```bash
npx tsx src/server/server.ts
```

Should output:

```
Server running on http://localhost:3000
```

Open browser and visit `http://localhost:3000` to test the web UI.

## Troubleshooting Installation

### "Cannot find module 'express'"

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "ECONNREFUSED - PostgreSQL connection failed"

```bash
# Check PostgreSQL is running
# macOS:
brew services list | grep postgresql

# Linux:
sudo systemctl status postgresql

# Start if not running:
# macOS:
brew services start postgresql@16

# Linux:
sudo systemctl start postgresql
```

### "ECONNREFUSED - LM Studio connection failed"

```bash
# Check LM Studio is running at http://localhost:1234/v1
# 1. Open LM Studio application
# 2. Go to "Local Server" tab
# 3. Click "Start Server"
# 4. Verify server is listening
curl http://localhost:1234/v1/models
```

### "pgvector extension not found"

```bash
# Install pgvector on your system:

# macOS (Homebrew)
brew install pgvector

# Linux (Ubuntu/Debian)
sudo apt install postgresql-16-pgvector

# Then enable in database:
psql -U postgres -d rag_demo -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### "TypeScript compilation errors"

```bash
# Check TypeScript configuration
npx tsc --noEmit

# Update TypeScript if needed
npm install -D typescript@latest
```

## Next Steps

1. **Configure** - See [configuration.md](configuration.md)
2. **API Usage** - See [api.md](api.md)
3. **Troubleshooting** - See [faq.md](faq.md)
4. **Start Development** - Begin ingesting data and testing queries

## Support

For issues:

1. Check [faq.md](faq.md)
2. Review logs in terminal
3. Verify all prerequisites are installed
4. Ensure services are running (PostgreSQL, LM Studio)
