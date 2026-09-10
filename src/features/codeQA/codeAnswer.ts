import { rerankedCodeSearch } from "../../retrieval/rerankedCodeSearch.js";

import { buildCodeContext } from "./codeContext.js";

import { generateCodeAnswer } from "../../core/embeddings.js";

export interface CodeAnswer {
  answer: string;
  context: string;
  results: Awaited<ReturnType<typeof rerankedCodeSearch>>;
}

export async function answerCodeQuestion(
  question: string,
): Promise<CodeAnswer> {
  const results = await rerankedCodeSearch(question);

  const codeContext = buildCodeContext(results);

  const answer = await generateCodeAnswer(question, codeContext.content);

  return {
    answer,
    context: codeContext.content,
    results,
  };
}
