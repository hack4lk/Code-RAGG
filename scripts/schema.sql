-- RAG Demo Database Schema
-- PostgreSQL schema for storing documents, code chunks, and embeddings
-- 
-- Usage:
--   createdb rag_demo
--   psql -U postgres -d rag_demo < scripts/schema.sql

-- ============================================
-- Extensions
-- ============================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Documents Table
-- ============================================

CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  filename text NOT NULL UNIQUE,
  content_hash text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

-- ============================================
-- Document Chunks Table
-- ============================================

CREATE TABLE IF NOT EXISTS document_chunks (
  id BIGSERIAL PRIMARY KEY,
  source text NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(768) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  document_id bigint REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_source ON document_chunks(source);
CREATE INDEX IF NOT EXISTS idx_document_chunks_created_at ON document_chunks(created_at);
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
  ON document_chunks USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- ============================================
-- Code Chunks Table
-- ============================================
-- Stores parsed code entities: functions, methods, interfaces, types, classes, constants
-- 
-- symbol_type values:
--   'function' - Top-level function
--   'method' - Class method
--   'interface' - TypeScript interface (data contract)
--   'type' - Type alias (data contract)
--   'class' - Class declaration (component)
--   'constant' - Configuration constant or exported variable
--   'export' - Exported symbol
--
-- metadata JSONB structure:
--   calls: CodeRelationship[] - function calls within this entity
--   externalCalls: string[] - unresolved external calls
--   dependencies: string[] - file-level imports
--   relationships: RelationshipData - entity relationships
--     inherits_from: string[] - classes/interfaces this extends
--     implements: string[] - interfaces this class implements
--     inherited_by: string[] - classes/interfaces extending this
--     type_deps: TypeDependency[] - types used in signatures
--     used_by: CodeRelationship[] - functions using this type
--     imports: string[] - modules this imports
--     imported_by: string[] - modules importing this
--   architecturalRole: string - 'data_contract', 'handler', 'middleware', 'config', 'utility', 'route'

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

CREATE INDEX IF NOT EXISTS idx_code_chunks_file_path ON code_chunks(file_path);
CREATE INDEX IF NOT EXISTS idx_code_chunks_symbol_name ON code_chunks(symbol_name);
CREATE INDEX IF NOT EXISTS idx_code_chunks_symbol_type ON code_chunks(symbol_type);
CREATE INDEX IF NOT EXISTS code_chunks_embedding_idx 
  ON code_chunks USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- ============================================
-- Verify Installation
-- ============================================

-- List all tables
SELECT 'Installation complete!' as status,
       count(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('documents', 'document_chunks', 'code_chunks');
