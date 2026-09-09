import { searchDocuments } from "../search.js";
import { generateAnswer } from "../embeddings.js";
import pool from "../db.js";

async function testChat() {

  const question =
    "What version of Node.js do I need?";

  try {

    console.log("Question:");
    console.log(question);

    console.log("\nSearching documentation...");

    const documents =
      await searchDocuments(question, 3);

    console.log(
      `Found ${documents.length} relevant documents`
    );

    console.log("\nGenerating answer...");

    const answer =
      await generateAnswer(
        question,
        documents
      );

    console.log("\n==============================");
    console.log("ANSWER");
    console.log("==============================\n");

    console.log(answer);

    console.log("\n==============================");
    console.log("SOURCES");
    console.log("==============================\n");

    for (const document of documents) {
      console.log(
        `${document.source} (chunk ${document.chunkIndex})`
      );
    }

  } catch (error) {

    console.error(
      "Chat failed:"
    );

    console.error(error);

  } finally {

    await pool.end();

  }
}

testChat();