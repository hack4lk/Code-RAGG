import { searchDocuments } from "../search.js";
import { rerank } from "../reranker.js";
import { rerankWithBGE } from "../reranker-bge.js";
import 'dotenv/config';

const RERANK_THRESHOLD = process.env.RERANK_THRESHOLD ? parseFloat(process.env.RERANK_THRESHOLD) : 0.05;

const tests = [
  // --------------------------------
  // Direct / single-document answers
  // --------------------------------

  {
    question: "What version of Node.js do I need?",
    expectedSource: "installation.md",
  },
  {
    question: "How do I configure the database connection?",
    expectedSource: "configuration.md",
  },
  {
    question: "What environment variables are required?",
    expectedSource: "installation.md",
  },
  {
    question: "How do I create a project?",
    expectedSource: "api.md",
  },
  {
    question: "How can I retrieve a project?",
    expectedSource: "api.md",
  },

  // --------------------------------
  // Paraphrased questions
  // --------------------------------

  {
    question: "Which Node version is required to run the application?",
    expectedSource: "installation.md",
  },
  {
    question: "Where is the PostgreSQL connection string configured?",
    expectedSource: "configuration.md",
  },
  {
    question: "What HTTP endpoints are available for projects?",
    expectedSource: "api.md",
  },

  // --------------------------------
  // Questions requiring related context
  // --------------------------------

  {
    question: "What do I need to configure before running the application?",
    expectedSource: "installation.md",
  },
  {
    question: "What database should be used in production?",
    expectedSource: "configuration.md",
  },

  // --------------------------------
  // Questions documentation cannot answer
  // --------------------------------

  {
    question: "What port does the API use?",
    expectedSource: null,
  },
  {
    question: "How do I configure Kubernetes?",
    expectedSource: null,
  },
  {
    question: "How do I configure Docker?",
    expectedSource: null,
  },
  {
    question: "How do I configure Redis?",
    expectedSource: null,
  },
  {
    question: "What version of Python do I need?",
    expectedSource: null,
  },
  {
    question: "How do I deploy this application to AWS?",
    expectedSource: null,
  },

  // --------------------------------
  // Specific details
  // --------------------------------

  {
    question: "What variable contains the PostgreSQL connection string?",
    expectedSource: "configuration.md",
  },
  {
    question: "Where should database credentials be stored?",
    expectedSource: "configuration.md",
  },
  {
    question: "What HTTP method is used to create a project?",
    expectedSource: "api.md",
  },
];

function evaluateQwen(
  results: Awaited<ReturnType<typeof rerank>>,
  expectedSource: string | null,
) {
  const relevantResults = results
    .filter((result) => (result.rerankerScore ?? 0) >= RERANK_THRESHOLD)
    .slice(0, 3);

  if (expectedSource === null) {
    return relevantResults.length === 0;
  }

  if (relevantResults.length === 0) {
    return false;
  }

  return relevantResults.some((result) => result.source === expectedSource);
}

function evaluateBGE(
  results: Awaited<ReturnType<typeof rerankWithBGE>>,
  expectedSource: string | null,
) {
  /*
   * BGE scores are raw logits and don't use the Qwen
   * threshold. For now we simply evaluate the top result.
   */

  if (results.length === 0) {
    return expectedSource === null;
  }

  if (expectedSource === null) {
    return false;
  }

  return results[0].source === expectedSource;
}

async function runTests() {
  let qwenPasses = 0;
  let bgePasses = 0;

  console.log(`Running ${tests.length} evaluation tests...\n`);

  for (const test of tests) {
    console.log("\n==============================");
    console.log(test.question);
    console.log("==============================");

    // --------------------------------
    // Vector search
    // --------------------------------

    const results = await searchDocuments(test.question, 10);

    console.log(`Retrieved ${results.length} candidates`);

    // --------------------------------
    // Qwen3
    // --------------------------------

    const qwenResults = await rerank(test.question, results);

    console.log("\nQWEN3:");

    qwenResults.forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.source} ` +
          `(chunk ${result.chunkIndex}) ` +
          `vector=${result.score.toFixed(3)} ` +
          `qwen=${(result.rerankerScore ?? 0).toFixed(3)}`,
      );
    });

    const qwenPass = evaluateQwen(qwenResults, test.expectedSource);

    if (qwenPass) {
      qwenPasses++;
      console.log("Qwen3: ✓ PASS");
    } else {
      console.log("Qwen3: ✗ FAIL");
    }

    // --------------------------------
    // BGE
    // --------------------------------

    const bgeResults = await rerankWithBGE(test.question, results);

    console.log("\nBGE:");

    bgeResults.forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.source} ` +
          `(chunk ${result.chunkIndex}) ` +
          `vector=${result.score.toFixed(3)} ` +
          `bge=${(result.bgeScore ?? 0).toFixed(3)}`,
      );
    });

    const bgePass = evaluateBGE(bgeResults, test.expectedSource);

    if (bgePass) {
      bgePasses++;
      console.log("BGE: ✓ PASS");
    } else {
      console.log("BGE: ✗ FAIL");
    }

    console.log(`Expected: ${test.expectedSource ?? "NONE"}`);
  }

  // --------------------------------
  // Final summary
  // --------------------------------

  console.log("\n\n========================================");
  console.log("EVALUATION SUMMARY");
  console.log("========================================");

  console.log(`Qwen3: ${qwenPasses}/${tests.length} passed`);

  console.log(`BGE:   ${bgePasses}/${tests.length} passed`);
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
