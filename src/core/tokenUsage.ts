import { logger } from '../infrastructure/logger';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
}

export interface GeneratedAnswer {
  answer: string;
  usage: TokenUsage;
}

interface TokenData {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  choices: {
    message: {
      content: string;
    };
  }[];
}

export const getLMStudioTokenUsage = (data: TokenData): GeneratedAnswer => {
  const usage: TokenUsage = {
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    totalTokens: data.usage?.total_tokens ?? 0,
    model: data.model ?? "qwen/qwen3.5-9b",
  };

  logger.report(`
========== TOKEN USAGE ==========
Model:         ${usage.model}
Input tokens:  ${usage.inputTokens}
Output tokens: ${usage.outputTokens}
Total tokens:  ${usage.totalTokens}
=================================
`);

  return {
    answer: data.choices[0].message.content,
    usage,
  };
};
