import { rerankedCodeSearch } from "../rerankedCodeSearch.js";

const query =
  process.argv.slice(2).join(" ") || "Where are embeddings generated?";

(async () => {
  const results = await rerankedCodeSearch(query);

  console.log(`\nReranked code search: "${query}"\n`);

  for (const [index, result] of results.entries()) {
    console.log(`${index + 1}. ${result.symbolName}`);

    console.log(`${result.filePath}:${result.startLine}-${result.endLine}`);

    console.log(`Retrieval: ${result.retrieval.join(", ")}`);

    console.log(
      `Vector: ${
        result.similarity === null ? "n/a" : result.similarity.toFixed(3)
      }`,
    );

    console.log(`Qwen: ${result.rerankerScore.toFixed(3)}`);

    console.log();
  }
})();
