#!/usr/bin/env npx tsx
/**
 * Database Installation Script
 * 
 * Creates the necessary tables for RAG Demo if they don't exist.
 * Usage: npx tsx scripts/install-db.ts
 */

import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function installDatabase() {
  console.log("🔧 Installing RAG Demo database schema...\n");

  try {
    // Check if pgvector extension exists
    console.log("Installing pgvector extension...");
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector;");
    console.log("✅ pgvector extension ready\n");

    // Create documents table
    console.log(" Creating documents table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id BIGSERIAL PRIMARY KEY,
        filename text NOT NULL UNIQUE,
        content_hash text NOT NULL,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );
    `);
    console.log("✅ documents table ready\n");

    // Create document_chunks table
    console.log("Creating document_chunks table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id BIGSERIAL PRIMARY KEY,
        source text NOT NULL,
        chunk_index integer NOT NULL,
        content text NOT NULL,
        embedding vector(768) NOT NULL,
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        document_id bigint REFERENCES documents(id) ON DELETE CASCADE
      );
    `);
    console.log("✅ document_chunks table ready\n");

    // Create code_chunks table
    console.log("Creating code_chunks table...");
    await pool.query(`
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
    `);
    console.log("✅ code_chunks table ready\n");

    // Create indexes for document_chunks
    console.log("Creating indexes for document_chunks...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
        ON document_chunks USING ivfflat (embedding vector_cosine_ops) 
        WITH (lists = 100);
    `);
    console.log("✅ document_chunks indexes ready\n");

    // Create indexes for code_chunks
    console.log("Creating indexes for code_chunks...");
    await pool.query(`
      CREATE INDEX IF NOT EXISTS code_chunks_embedding_idx 
        ON code_chunks USING ivfflat (embedding vector_cosine_ops) 
        WITH (lists = 100);
    `);
    console.log("✅ code_chunks indexes ready\n");

    // Verify tables exist
    console.log("✅ Verifying tables...");
    const tables = await pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('documents', 'document_chunks', 'code_chunks')
      ORDER BY tablename;
    `);

    if (tables.rows.length === 3) {
      console.log("✅ All tables verified:");
      for (const row of tables.rows) {
        console.log(`   - ${row.tablename}`);
      }
    }

    console.log("\n✨ Database installation complete!");
    console.log("\nNext steps:");
    console.log("1. Ingest documentation: npx tsx src/ingest.ts");
    console.log("2. Ingest code: npx tsx src/codeIngest.ts");
    console.log("3. Start server: npx tsx src/server/server.ts");

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Database installation failed:");
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

installDatabase();
