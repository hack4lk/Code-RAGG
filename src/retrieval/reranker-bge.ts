import {
  AutoTokenizer,
  AutoModelForSequenceClassification,
} from "@huggingface/transformers";

import { SearchResult } from "./types.js";

const MODEL = "Xenova/bge-reranker-base";

let tokenizer: any;
let model: any;

async function loadModel() {
  if (!tokenizer || !model) {
    console.log("Loading BGE reranker...");

    tokenizer = await AutoTokenizer.from_pretrained(MODEL);

    model = await AutoModelForSequenceClassification.from_pretrained(MODEL, {
      dtype: "q8",
    });

    console.log("BGE reranker loaded.");
  }
}

export async function rerankWithBGE(
  question: string,
  documents: SearchResult[],
): Promise<SearchResult[]> {
  await loadModel();

  const results: SearchResult[] = [];

  for (const document of documents) {
    const inputs = await tokenizer([question], {
      text_pair: [document.content],
      padding: true,
      truncation: true,
    });

    const output = await model(inputs);

    const score = Number(output.logits.data[0]);

    results.push({
      ...document,
      bgeScore: score,
    });
  }

  return results.sort(
    (a, b) => (b.bgeScore ?? -Infinity) - (a.bgeScore ?? -Infinity),
  );
}
