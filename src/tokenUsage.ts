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

  console.log("\n========== TOKEN USAGE ==========");
  console.log(`Model:         ${usage.model}`);
  console.log(`Input tokens:  ${usage.inputTokens}`);
  console.log(`Output tokens: ${usage.outputTokens}`);
  console.log(`Total tokens:  ${usage.totalTokens}`);
  console.log("=================================\n");

  return {
    answer: data.choices[0].message.content,
    usage,
  };
};
