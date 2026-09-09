import { answerCodeQuestion } from "../codeAnswer.js";

const question = process.argv.slice(2).join(" ") || "What does ingest call?";

(async () => {
  const result = await answerCodeQuestion(question);

  console.log(`\nQuestion:\n${question}\n`);

  console.log("Answer:");

  console.log(result.answer);

  console.log("\nSources:\n");

  for (const source of result.results) {
    console.log(
      `- ${source.symbolName} (${source.filePath}:${source.startLine}-${source.endLine})`,
    );
  }
})();
