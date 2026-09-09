// Test file for extended parser validation
// Contains all entity types: interface, type, class, constant, function, method

export interface UserRequest {
  id: string;
  query: string;
  timestamp: number;
}

export type SearchScore = {
  similarity: number;
  rerankerScore: number;
};

export class CodeAnalyzer {
  private cache: Map<string, any> = new Map();

  constructor(private modelName: string) {}

  analyze(code: string): SearchScore {
    if (this.cache.has(code)) {
      return this.cache.get(code);
    }
    return { similarity: 0.5, rerankerScore: 0.3 };
  }

  private parseCode(content: string): any {
    return { lines: content.split('\n').length };
  }
}

export const API_PORT = 3000;
export const RERANK_THRESHOLD = 0.05;
export const MAX_RESULTS = 10;

export function transformResults(results: any[]): SearchScore[] {
  return results.map(r => ({
    similarity: r.score,
    rerankerScore: r.rank,
  }));
}

export async function searchCode(query: string): Promise<UserRequest> {
  return {
    id: "1",
    query,
    timestamp: Date.now(),
  };
}
