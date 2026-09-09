# RAG Demo - Retrieval-Augmented Generation Application

A powerful Retrieval-Augmented Generation (RAG) application that enables semantic search and AI-powered Q&A over your codebase and documentation.

## Overview

RAG Demo combines semantic search with large language models to provide intelligent answers about your code and documentation. It uses vector embeddings to find relevant code snippets and documents, then uses an LLM to synthesize comprehensive answers.

### Key Features

- **Dual-mode Search**: Query both your codebase and documentation
- **Semantic Understanding**: Uses embeddings to find relevant code/docs even with different wording
- **Relationship Tracking**: Understands function callers/callees and dependencies
- **Streaming Responses**: Get real-time answers via Server-Sent Events (SSE)
- **Reranking**: Improves relevance by reranking search results
- **Context Expansion**: Automatically includes related code/documentation for better context
- **Flexible LLM Providers**: Use local LM Studio or OpenAI with a simple config change
- **Local Embeddings**: Always uses local embeddings for speed, privacy, and cost savings

## Architecture

### Components

- **Frontend**: Express.js serving static HTML/CSS/JS
- **Backend**: TypeScript/Node.js REST API
- **Database**: PostgreSQL with pgvector extension for vector similarity search
- **LLM/Embeddings**: LM Studio (local inference server)
- **Ingestion**: Code parser and markdown chunker for preparing data

### Data Flow

```
Question
   ↓
Embedding (LM Studio)
   ↓
Vector Search (PostgreSQL)
   ↓
Reranking (BGE Model or Cross-Encoder)
   ↓
Context Building
   ↓
LLM Response (LM Studio)
   ↓
User
```

## Quick Start

### Prerequisites

- **Node.js**: v22 or later
- **PostgreSQL**: v16 or later with pgvector extension
- **For Local LLM**: LM Studio running on `http://localhost:1234/v1`
- **For OpenAI**: OpenAI API key (if using `MODEL_PROVIDER=openai`)

### Installation

1. **Clone and Install**

   ```bash
   git clone <repository>
   cd "Rag demo"
   npm install
   ```

2. **Set Up PostgreSQL Database**

   ```bash
   # Create database
   createdb rag_demo

   # Install schema using the provided script
   npx tsx scripts/install-db.ts
   ```

3. **Configure Environment**

   ```bash
   cp .env.example .env
   # Edit .env with your settings
   # Choose MODEL_PROVIDER: "lm_studio" or "openai"
   # Set embedding model (always local): EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5@q4_k_m
   # For LM Studio: Set CHAT_MODEL and ensure LM Studio is running
   # For OpenAI: Set OPENAI_API_KEY and OPENAI_MODEL
   ```

4. **Start LM Studio (if using `MODEL_PROVIDER=lm_studio`)**
   - Open LM Studio
   - Load your embedding model: `text-embedding-nomic-embed-text-v1.5@q4_k_m`
   - Load your chat model: `qwen/qwen3.5-9b` (or your choice)
   - Start the local inference server on `http://localhost:1234/v1`

   **Note**: LM Studio is always required for embeddings, even if using OpenAI for chat

5. **Ingest Data**

   ```bash
   # Ingest documentation (markdown files in /documents)
   npx tsx src/ingest.ts

   # Ingest code (TypeScript/JavaScript in /src)
   npx tsx src/codeIngest.ts
   ```

6. **Start the Server**

   ```bash
   npx tsx src/server/server.ts
   ```

   - API available at `http://localhost:3000`
   - Web UI available at `http://localhost:3000`

## Usage

### Document Q&A

Ask questions about your documentation:

**Request:**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I install the application?"}'
```

**Response:**

```json
{
  "answer": "To install...",
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

### Code Q&A

Ask questions about your codebase:

**Request:**

```bash
curl -X POST http://localhost:3000/api/code/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What does the chunkMarkdown function do?"}'
```

**Response:**

```json
{
  "answer": "The chunkMarkdown function...",
  "sources": [
    {
      "file": "src/chunker.ts",
      "symbol": "chunkMarkdown",
      "type": "function",
      "startLine": 10,
      "endLine": 45,
      "retrieval": ["semantic"],
      "rerankerScore": 0.88
    }
  ]
}
```

### Streaming Responses

For real-time answers, use the streaming endpoints:

```bash
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I configure the database?"}' \
  -N
```

Responses are sent as Server-Sent Events (SSE):

- `event: sources` - Initial relevant sources
- `data: {token}` - Streamed answer tokens
- `event: done` - Response complete

## Model Provider Configuration

RAG Demo supports multiple LLM providers for chat while keeping embeddings local:

### LM Studio (Default)

Use your own hardware for local, private inference:

```env
MODEL_PROVIDER=lm_studio
CHAT_MODEL=qwen/qwen3.5-9b
LM_STUDIO_URL=http://localhost:1234/v1
```

**Pros**:

- 100% private (data never leaves your machine)
- No API costs
- Works offline
- Good for code-heavy projects

**Cons**:

- Requires local GPU/CPU resources
- Slower responses
- Limited to available models

### OpenAI

Use OpenAI's cloud API for faster responses:

```env
MODEL_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4
```

**Pros**:

- Very fast responses
- Most capable models
- No local resources needed
- Easy to scale

**Cons**:

- Costs per API call
- Requires internet
- Data sent to OpenAI servers

### Hybrid (Recommended)

Use local embeddings with OpenAI chat for best of both worlds:

```env
MODEL_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4
# Embeddings always use local LM Studio:
LM_STUDIO_URL=http://localhost:1234/v1
EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5@q4_k_m
```

**Benefits**:

- Fast embeddings (local)
- High-quality reasoning (OpenAI)
- Lower costs (embeddings are free locally)
- Private semantic search

See [configuration.md](configuration.md) for detailed setup instructions.

## Project Structure

```
Rag demo/
├── src/
│   ├── chunker.ts              # Markdown document chunking
│   ├── codeAnswer.ts           # Code Q&A pipeline
│   ├── codebase.ts             # Code parsing and file discovery
│   ├── codeIngest.ts           # Code database ingestion
│   ├── codeParser.ts           # TypeScript/JS AST parsing
│   ├── codeSearch.ts           # Code vector search
│   ├── db.ts                   # PostgreSQL connection
│   ├── embeddings.ts           # Embedding and LLM generation
│   ├── ingest.ts               # Document database ingestion
│   ├── reranker.ts             # BGE reranking (if using BGE)
│   ├── search.ts               # Document vector search
│   ├── server/
│   │   └── server.ts           # Express API server
│   └── tests/
│       ├── *-test.ts           # Test files
│       └── test-*.ts           # Integration tests
├── documents/
│   ├── README.md               # This file
│   ├── installation.md         # Setup instructions
│   ├── configuration.md        # Configuration guide
│   ├── api.md                  # API documentation
│   └── faq.md                  # Frequently asked questions
├── public/
│   └── index.html              # Web UI
├── .env                        # Environment variables
├── package.json                # Dependencies
└── tsconfig.json               # TypeScript config
```

## Database Schema

The application uses PostgreSQL with pgvector for vector similarity search.

### Tables

**documents** - Metadata for ingested markdown documents

- `id` (BIGSERIAL) - Primary key
- `filename` (text) - Document filename, unique
- `content_hash` (text) - SHA-256 hash for change detection
- `created_at` (timestamp) - Creation time
- `updated_at` (timestamp) - Last update time

**document_chunks** - Chunked content from markdown documents

- `id` (BIGSERIAL) - Primary key
- `source` (text) - Source filename
- `chunk_index` (integer) - Position in document
- `content` (text) - Chunk text
- `embedding` (vector[768]) - Vector representation for semantic search
- `created_at` (timestamp) - Creation time
- `document_id` (bigint) - Foreign key to documents table

**code_chunks** - Parsed code symbols (functions, classes, methods)

- `id` (SERIAL) - Primary key
- `file_path` (text) - Source file path
- `symbol_name` (text) - Function/class/method name
- `symbol_type` (text) - Type: function, class, method, etc.
- `start_line` (integer) - Start line in file
- `end_line` (integer) - End line in file
- `content` (text) - Source code
- `metadata` (jsonb) - Call graph data (callers/callees)
- `embedding` (vector[768]) - Vector representation for semantic search

### Indexes

- `document_chunks_embedding_idx` - IVFFlat index on document_chunks.embedding
- `code_chunks_embedding_idx` - IVFFlat index on code_chunks.embedding

These indexes optimize vector similarity searches for O(log n) performance.

### Installation

Create tables automatically:

```bash
npx tsx scripts/install-db.ts
```

Or manually with PostgreSQL:

```bash
psql -U postgres -d rag_demo < scripts/schema.sql
```

## Performance Tips

1. **Batch Ingestion**: The ingestion scripts process documents/code in batches for efficiency
2. **Reranking Threshold**: Adjust `RERANK_THRESHOLD` in `server.ts` to balance relevance vs. speed
3. **Model Selection**: Choose smaller embedding models for faster responses
4. **Database Indexes**: Ensure pgvector indexes exist on the `embedding` column
5. **Context Limit**: Limit `maxChunks` in context building to avoid token limits

## Troubleshooting

See [faq.md](faq.md) for common issues and solutions.

## Configuration

See [configuration.md](configuration.md) for detailed environment variable and component settings.

## API Reference

See [api.md](api.md) for complete API endpoint documentation.

## License

MIT
