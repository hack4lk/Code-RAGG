import { AutoTokenizer, AutoModelForCausalLM } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/Qwen3-Reranker-0.6B-ONNX";

async function main() {
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);

  const model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
    dtype: "q4",
    device: "cpu",
  });

  function createRerankerPrompt(question: string, document: string): string {
    const systemPrompt =
      "Judge whether the Document meets the requirements based on the Query and the Instruct provided. " +
      'Note that the answer can only be "yes" or "no".';

    const instruction =
      "Given a web search query, retrieve relevant passages that answer the query";

    return (
      `<|im_start|>system\n${systemPrompt}<|im_end|>\n` +
      `<|im_start|>user\n` +
      `<Instruct>: ${instruction}\n\n` +
      `<Query>: ${question}\n\n` +
      `<Document>: ${document}` +
      `<|im_end|>\n` +
      `<|im_start|>assistant\n` +
      `<think>\n\n</think>\n`
    );
  }

  // Then temporarily test it

  const prompt = createRerankerPrompt(
    "How do I configure the database?",
    "The DATABASE_URL environment variable contains the PostgreSQL connection string.",
  );

  async function scoreDocument(
    question: string,
    document: string,
  ): Promise<number> {
    const prompt = createRerankerPrompt(question, document);

    const inputs = tokenizer(prompt, {
      truncation: true,
      max_length: 8192,
    });

    const output = await model(inputs);

    console.log("Logits dimensions:", output.logits.dims);

    const seqLen = output.logits.dims[1];
    const vocabSize = output.logits.dims[2];

    const lastLogits = output.logits.data.slice(
      (seqLen - 1) * vocabSize,
      seqLen * vocabSize,
    );

    const yesTokens = tokenizer("yes").input_ids.data;
    const noTokens = tokenizer("no").input_ids.data;

    console.log("YES tokens:", yesTokens);
    console.log("NO tokens:", noTokens);

    const yesToken = Number(yesTokens[yesTokens.length - 1]);
    const noToken = Number(noTokens[noTokens.length - 1]);

    console.log("YES token ID:", yesToken);
    console.log("NO token ID:", noToken);

    console.log("YES logit:", lastLogits[yesToken]);
    console.log("NO logit:", lastLogits[noToken]);

    const yesScore = Math.exp(lastLogits[yesToken]);
    const noScore = Math.exp(lastLogits[noToken]);

    return yesScore / (yesScore + noScore);
  }

  const score = await scoreDocument(
    "How do I configure the database?",
    "The application can be deployed to Kubernetes using the deployment.yaml file.",
  );

  console.log("Reranker score:", score);
}

main();
