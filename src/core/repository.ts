import pool from "./db.js";

/**
 * Base Repository class for common database operations
 * Centralizes all pool.query() calls with consistent error handling and row mapping
 */
class BaseRepository {
  /**
   * Convert snake_case DB columns to camelCase object properties
   */
  protected toCamelCase(row: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = value;
    }
    return result;
  }

  /**
   * Execute a query that returns multiple rows
   */
  protected async query<T = any>(
    sql: string,
    params?: any[],
  ): Promise<T[]> {
    const result = await pool.query(sql, params);
    return result.rows.map((row) => this.toCamelCase(row)) as T[];
  }

  /**
   * Execute a query that returns a single row or null
   */
  protected async queryOne<T = any>(
    sql: string,
    params?: any[],
  ): Promise<T | null> {
    const result = await pool.query(sql, params);
    if (result.rows.length === 0) return null;
    return this.toCamelCase(result.rows[0]) as T;
  }

  /**
   * Execute a query that returns a single value (e.g., COUNT, MAX, etc.)
   */
  protected async queryScalar<T = any>(
    sql: string,
    params?: any[],
  ): Promise<T | null> {
    const result = await pool.query(sql, params);
    if (result.rows.length === 0) return null;
    const firstKey = Object.keys(result.rows[0])[0];
    return result.rows[0][firstKey] as T;
  }

  /**
   * Execute a query that returns rowCount (INSERT, UPDATE, DELETE)
   */
  protected async execute(
    sql: string,
    params?: any[],
  ): Promise<number> {
    const result = await pool.query(sql, params);
    return result.rowCount ?? 0;
  }
}

/**
 * Code chunk repository for all code_chunks table queries
 */
export class CodeRepository extends BaseRepository {
  /**
   * Find a code chunk by file path and symbol name
   */
  async findByFileAndSymbol(
    filePath: string,
    symbolName: string,
  ): Promise<CodeChunk | null> {
    return this.queryOne<CodeChunk>(
      `
      SELECT
        id,
        file_path,
        symbol_name,
        symbol_type,
        start_line,
        end_line,
        content,
        metadata
      FROM code_chunks
      WHERE file_path = $1
        AND symbol_name = $2
      LIMIT 1
      `,
      [filePath, symbolName],
    );
  }

  /**
   * Find a code chunk by symbol name only
   */
  async findBySymbol(symbolName: string): Promise<CodeChunk | null> {
    return this.queryOne<CodeChunk>(
      `
      SELECT
        id,
        file_path,
        symbol_name,
        symbol_type,
        start_line,
        end_line,
        content,
        metadata
      FROM code_chunks
      WHERE symbol_name = $1
      LIMIT 1
      `,
      [symbolName],
    );
  }

  /**
   * Find all code chunks with a given symbol name (for relationships)
   */
  async findAllBySymbol(symbolName: string): Promise<CodeChunk[]> {
    return this.query<CodeChunk>(
      `
      SELECT
        id,
        file_path,
        symbol_name,
        symbol_type,
        start_line,
        end_line,
        content,
        metadata
      FROM code_chunks
      WHERE symbol_name = $1
      ORDER BY file_path, start_line
      `,
      [symbolName],
    );
  }

  /**
   * Find callers: all symbols that call the given symbol
   */
  async findCallers(symbolName: string): Promise<CodeChunk[]> {
    return this.query<CodeChunk>(
      `
      SELECT
        id,
        file_path,
        symbol_name,
        symbol_type,
        start_line,
        end_line,
        content,
        metadata
      FROM code_chunks
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(metadata->'calls') AS call
        WHERE call->>'symbolName' = $1
      )
      ORDER BY file_path, start_line
      `,
      [symbolName],
    );
  }

  /**
   * Find all files/symbols that import the given symbol
   */
  async findImportedBy(symbolName: string): Promise<CodeChunk[]> {
    return this.query<CodeChunk>(
      `
      SELECT
        id,
        file_path,
        symbol_name,
        symbol_type,
        start_line,
        end_line,
        content,
        metadata
      FROM code_chunks
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(metadata->'imports') AS import
        WHERE import->>'symbolName' = $1
      )
      ORDER BY file_path, start_line
      `,
      [symbolName],
    );
  }

  /**
   * Search code chunks by embedding vector
   */
  async searchByEmbedding(
    embedding: number[],
    limit: number,
  ): Promise<(CodeChunk & { similarity: number })[]> {
    const results = await this.query<CodeChunk & { similarity: string }>(
      `
      SELECT
        id,
        file_path,
        symbol_name,
        symbol_type,
        start_line,
        end_line,
        content,
        metadata,
        1 - (embedding <=> $1::vector) AS similarity
      FROM code_chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $2
      `,
      [JSON.stringify(embedding), limit],
    );

    return results.map((row) => ({
      ...row,
      similarity: Number(row.similarity),
    }));
  }

  /**
   * Get metadata for a code chunk (for finding callees/relationships)
   */
  async getMetadata(
    symbolName: string,
  ): Promise<Record<string, any> | null> {
    const result = await this.queryOne<{ metadata: Record<string, any> }>(
      `SELECT metadata FROM code_chunks WHERE symbol_name = $1 LIMIT 1`,
      [symbolName],
    );
    return result?.metadata ?? null;
  }

  /**
   * Insert a code chunk
   */
  async insertChunk(chunk: {
    filePath: string;
    symbolName: string;
    symbolType: string;
    startLine: number;
    endLine: number;
    content: string;
    embedding?: number[];
    metadata?: Record<string, any>;
  }): Promise<number> {
    const result = await pool.query(
      `
      INSERT INTO code_chunks (
        file_path,
        symbol_name,
        symbol_type,
        start_line,
        end_line,
        content,
        embedding,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        chunk.filePath,
        chunk.symbolName,
        chunk.symbolType,
        chunk.startLine,
        chunk.endLine,
        chunk.content,
        chunk.embedding ? JSON.stringify(chunk.embedding) : null,
        chunk.metadata ? JSON.stringify(chunk.metadata) : null,
      ],
    );
    return result.rows[0].id;
  }

  /**
   * Delete all code chunks (for re-ingestion)
   */
  async deleteAll(): Promise<number> {
    return this.execute(`DELETE FROM code_chunks`);
  }
}

/**
 * Document chunk repository for document ingestion and retrieval
 */
export class DocumentRepository extends BaseRepository {
  /**
   * Find or create a document by filename
   */
  async findByFilename(
    filename: string,
  ): Promise<{ id: number; contentHash: string } | null> {
    return this.queryOne<{ id: number; contentHash: string }>(
      `SELECT id, content_hash FROM documents WHERE filename = $1`,
      [filename],
    );
  }

  /**
   * Insert a new document
   */
  async insertDocument(
    filename: string,
    contentHash: string,
  ): Promise<number> {
    const result = await pool.query(
      `
      INSERT INTO documents (filename, content_hash)
      VALUES ($1, $2)
      RETURNING id
      `,
      [filename, contentHash],
    );
    return result.rows[0].id;
  }

  /**
   * Update document's content hash and timestamp
   */
  async updateDocumentHash(
    documentId: number,
    contentHash: string,
  ): Promise<void> {
    await pool.query(
      `
      UPDATE documents
      SET content_hash = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [contentHash, documentId],
    );
  }

  /**
   * Delete all document chunks for a document
   */
  async deleteDocumentChunks(documentId: number): Promise<number> {
    return this.execute(
      `DELETE FROM document_chunks WHERE document_id = $1`,
      [documentId],
    );
  }

  /**
   * Insert a document chunk with embedding
   */
  async insertChunk(chunk: {
    documentId: number;
    source: string;
    chunkIndex: number;
    content: string;
    embedding: number[];
  }): Promise<void> {
    await pool.query(
      `
      INSERT INTO document_chunks (
        document_id,
        source,
        chunk_index,
        content,
        embedding
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        chunk.documentId,
        chunk.source,
        chunk.chunkIndex,
        chunk.content,
        JSON.stringify(chunk.embedding),
      ],
    );
  }

  /**
   * Search document chunks by embedding vector
   */
  async searchByEmbedding(
    embedding: number[],
    limit: number,
  ): Promise<
    (DocumentChunk & {
      filename: string;
      distance: number;
    })[]
  > {
    const results = await this.query<
      DocumentChunk & {
        filename: string;
        distance: string;
      }
    >(
      `
      SELECT
        dc.id,
        d.filename,
        dc.chunk_index,
        dc.content,
        dc.embedding <=> $1::vector AS distance
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE dc.embedding IS NOT NULL
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $2
      `,
      [JSON.stringify(embedding), limit],
    );

    return results.map((row) => ({
      ...row,
      distance: Number(row.distance),
    }));
  }

  /**
   * Search document chunks by keyword
   */
  async searchByKeyword(
    keywords: string[],
    limit: number,
  ): Promise<
    (DocumentChunk & {
      filename: string;
      keywordMatchCount: number;
    })[]
  > {
    const conditions = keywords
      .map((_, idx) => `content ILIKE $${idx + 1}`)
      .join(" OR ");
    const caseStatement = keywords
      .map((_, idx) => `CASE WHEN content ILIKE $${idx + 1} THEN 1 ELSE 0 END`)
      .join(" + ");

    const results = await this.query<
      DocumentChunk & {
        filename: string;
        keywordMatchCount: string;
      }
    >(
      `SELECT 
        dc.id, 
        d.filename,
        dc.chunk_index, 
        dc.content,
        (${caseStatement}) AS keyword_match_count
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       WHERE ${conditions}
       ORDER BY keyword_match_count DESC, dc.id
       LIMIT $${keywords.length + 1}`,
      [...keywords.map((kw) => `%${kw}%`), limit],
    );

    return results.map((row) => ({
      ...row,
      keywordMatchCount: Number(row.keywordMatchCount),
    }));
  }

  /**
   * Get expanded context for a document chunk (surrounding chunks)
   */
  async getExpandedContext(
    filename: string,
    chunkIndex: number,
    radius: number,
  ): Promise<
    (DocumentChunk & {
      filename: string;
      chunkIndex: number;
    })[]
  > {
    return this.query<
      DocumentChunk & {
        filename: string;
        chunkIndex: number;
      }
    >(
      `SELECT
        dc.id,
        d.filename,
        dc.chunk_index,
        dc.content
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.filename = $1
        AND dc.chunk_index BETWEEN $2 AND $3
      ORDER BY dc.chunk_index`,
      [filename, Math.max(0, chunkIndex - radius), chunkIndex + radius],
    );
  }
}

/**
 * Type definitions for common database entities
 */
export interface CodeChunk {
  id: number;
  filePath: string;
  symbolName: string;
  symbolType: string;
  startLine: number;
  endLine: number;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export interface DocumentChunk {
  id: number;
  chunkIndex: number;
  content: string;
  embedding?: number[];
}

// Export singleton instances
export const codeRepository = new CodeRepository();
export const documentRepository = new DocumentRepository();
