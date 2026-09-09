import { AutoTokenizer, AutoModelForCausalLM } from "@huggingface/transformers";
import { SearchResult } from "./search";

const MODEL_ID = "onnx-community/Qwen3-Reranker-0.6B-ONNX";

let tokenizer: any;
let model: any;

const SYSTEM_PROMPT =
  "Judge whether the Document meets the requirements based on the Query and the Instruct provided. " +
  'Note that the answer can only be "yes" or "no".';

const INSTRUCTION =
  "Given a user question, determine whether the document contains information that directly answers the question. " +
  "Return yes only if the document provides enough information to answer the question.";

async function loadReranker(): Promise<void> {
  if (tokenizer && model) {
    return;
  }

  console.log("Loading reranker model...");

  tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);

  model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
    dtype: "q4",
    device: "cpu",
  });

  console.log("Reranker model loaded.");
}

function createRerankerPrompt(question: string, document: string): string {
  return (
    `<|im_start|>system\n${SYSTEM_PROMPT}<|im_end|>\n` +
    `<|im_start|>user\n` +
    `<Instruct>: ${INSTRUCTION}\n\n` +
    `<Query>: ${question}\n\n` +
    `<Document>: ${document}` +
    `<|im_end|>\n` +
    `<|im_start|>assistant\n` +
    `<think>\n\n</think>\n`
  );
}

export async function scoreDocument(
  question: string,
  document: string,
): Promise<number> {
  await loadReranker();

  const prompt = createRerankerPrompt(question, document);

  const inputs = tokenizer(prompt, {
    truncation: true,
    max_length: 8192,
  });

  const output = await model(inputs);

  const seqLen = output.logits.dims[1];
  const vocabSize = output.logits.dims[2];

  const lastLogits = output.logits.data.slice(
    (seqLen - 1) * vocabSize,
    seqLen * vocabSize,
  );

  const yesTokens = tokenizer("yes").input_ids.data;

  const noTokens = tokenizer("no").input_ids.data;

  const yesToken = Number(yesTokens[yesTokens.length - 1]);

  const noToken = Number(noTokens[noTokens.length - 1]);

  const yesScore = Math.exp(lastLogits[yesToken]);

  const noScore = Math.exp(lastLogits[noToken]);

  return yesScore / (yesScore + noScore);
}

export async function rerank(
  question: string,
  documents: SearchResult[],
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  for (const document of documents) {
    const score = await scoreDocument(question, document.content);

    results.push({
      ...document,
      rerankerScore: score,
    });
  }

  return results.sort(
    (a, b) => (b.rerankerScore ?? 0) - (a.rerankerScore ?? 0),
  );
}
