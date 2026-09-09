import { searchDocuments } from "../search.js";
import { rerankWithBGE } from "../reranker-bge.js";

async function main() {
  const question = "How do I configure the database?";

  const documents = await searchDocuments(question, 10);

  console.log(`Retrieved ${documents.length} documents`);

  const reranked = await rerankWithBGE(
    question,
    documents,
  );

  console.log("\nFirst BGE result:");
console.log(reranked[0]);

  console.log("\nBGE results:\n");

  for (const document of reranked) {
    console.log({
      file: document.source,
      chunk: document.chunkIndex,
      vectorScore: document.score,
      bgeScore: document.rerankerScore,
    });
  }
}

main();