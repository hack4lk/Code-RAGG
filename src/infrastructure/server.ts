import express from "express";
import path from "path";
import { searchDocuments, expandContext } from "../retrieval/documentSearch";
import { generateAnswer, streamAnswer, streamCodeAnswer } from "../core/embeddings";
import { rerank } from "../retrieval/reranker";
import { answerCodeQuestion } from "../features/codeQA/codeAnswer";
import { config, validateConfig } from "./configSchema";
import { formatSearchResultsForAPI, formatSearchResultForLogging } from "./responseFormatting";
import 'dotenv/config';

// Validate configuration at startup (fail fast if env vars are missing or invalid)
validateConfig();

const app = express();
const port = config.server.port;
const RERANK_THRESHOLD = config.reranking.documentThreshold;
const PG_SEARCH_LIMIT = config.search.pgLimit;
const MAX_CONTEXT_DOCS = config.search.maxContextDocs;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

app.post("/api/chat", async (req, res) => {
  try {
    const question = req.body.question;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        error: "Invalid question",
        question,
      });
    }

    console.log("Received question:", question);

    // 1. Retrieve candidate documents from PostgreSQL
    const documents = await searchDocuments(question, PG_SEARCH_LIMIT);

    if (documents.length === 0) {
      return res.json({
        answer:
          "I don't have enough information in the documentation to answer that.",
        sources: [],
      });
    }

    console.log(`Retrieved ${documents.length} documents`);

    // 2. Rerank the retrieved documents
    const rerankedDocuments = await rerank(question, documents);

    console.log("\nReranked documents:");

    for (const doc of rerankedDocuments) {
      console.log(formatSearchResultForLogging(doc));
    }

    // 3. Only send the best documents to the LLM
    const relevantDocuments = rerankedDocuments
      .filter((doc) => (doc.rerankerScore ?? 0) >= RERANK_THRESHOLD)
      .slice(0, MAX_CONTEXT_DOCS);

    const expandedDocuments = await expandContext(relevantDocuments);

    console.log("\nDocuments sent to LLM:");

    for (const doc of expandedDocuments) {
      console.log("\n---");
      console.log(`Source: ${doc.location}`);
      console.log(`Chunk: ${doc.documentChunkIndex}`);
      console.log(doc.content);
    }

    // 4. Generate answer using the reranked documents
    const answer = await generateAnswer(question, expandedDocuments);

    res.json({
      answer,
      sources: expandedDocuments.map((doc) => ({
        file: doc.location,
        chunk: doc.documentChunkIndex,
        score: doc.score,
        rerankerScore: doc.rerankerScore,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/chat/stream", async (req, res) => {
  try {
    const question = req.body.question;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        error: "Invalid question",
        question,
      });
    }

    console.log("Received streaming question:", question);

    // -----------------------------
    // 1. Vector search
    // -----------------------------

    const documents = await searchDocuments(question, PG_SEARCH_LIMIT);

    if (documents.length === 0) {
      return res.status(200).json({
        answer:
          "I don't have enough information in the documentation to answer that.",
        sources: [],
      });
    }

    console.log(`Retrieved ${documents.length} documents`);

    // -----------------------------
    // 2. Reranking
    // -----------------------------

    const rerankedDocuments = await rerank(question, documents);

    console.log("\nReranked documents:");

    for (const doc of rerankedDocuments) {
      console.log({
        file: doc.location,
        chunk: doc.documentChunkIndex,
        vectorScore: doc.score,
        rerankerScore: doc.rerankerScore,
      });
    }

    // -----------------------------
    // 3. Apply relevance threshold
    // -----------------------------

    const relevantDocuments = rerankedDocuments
      .filter((doc) => (doc.rerankerScore ?? 0) >= RERANK_THRESHOLD)
      .slice(0, 3);

    // -----------------------------
    // 4. Expand context
    // -----------------------------

    const expandedDocuments = await expandContext(relevantDocuments);

    console.log("\nDocuments sent to LLM:");

    for (const doc of expandedDocuments) {
      console.log("\n---");
      console.log(`Source: ${doc.location}`);
      console.log(`Chunk: ${doc.documentChunkIndex}`);
      console.log(doc.content);
    }

    // -----------------------------
    // 5. Set up SSE
    // -----------------------------

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.flushHeaders();

    // -----------------------------
    // 6. Send sources
    // -----------------------------

    res.write(
      `event: sources\n` +
        `data: ${JSON.stringify(formatSearchResultsForAPI(expandedDocuments))}\n\n`,
    );

    // -----------------------------
    // 7. Stream the answer
    // -----------------------------

    await streamAnswer(question, expandedDocuments, 
      (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      },
      (usage) => {
        res.write(`event: usage\ndata: ${JSON.stringify(usage)}\n\n`);
      }
    );

    // -----------------------------
    // 8. Tell the client we're done
    // -----------------------------

    res.write("event: done\ndata: [DONE]\n\n");

    res.end();
  } catch (e) {
    console.error(e);

    // If headers haven't been sent, we can
    // still return a normal HTTP error.
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Internal Server Error",
      });
    }

    // If streaming has already started,
    // send an SSE error event instead.
    res.write(
      `event: error\ndata: ${JSON.stringify({
        error: "Internal Server Error",
      })}\n\n`,
    );

    res.end();
  }
});

app.post("/api/code/chat", async (req, res) => {
  try {
    const question = req.body.question;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        error: "Invalid question",
        question,
      });
    }

    console.log("Received code question:", question);

    const result = await answerCodeQuestion(question);

    console.log("\nCode sources:");

    for (const source of result.results) {
      console.log({
        file: source.filePath,
        symbol: source.symbolName,
        lines: `${source.startLine}-${source.endLine}`,
        retrieval: source.retrieval,
        rerankerScore: source.rerankerScore,
      });
    }

    res.json({
      answer: result.answer,
      sources: result.results.map((source) => ({
        file: source.filePath,
        symbol: source.symbolName,
        type: source.symbolType,
        startLine: source.startLine,
        endLine: source.endLine,
        retrieval: source.retrieval,
        rerankerScore: source.rerankerScore,
      })),
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "Internal Server Error",
    });
  }
});

app.post("/api/code/chat/stream", async (req, res) => {
  try {
    const question = req.body.question;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        error: "Invalid question",
        question,
      });
    }

    console.log(
      "Received streaming code question:",
      question,
    );

    // 1. Retrieve and rerank code
    const result =
      await answerCodeQuestion(question);

    // 2. Set up SSE
    res.setHeader(
      "Content-Type",
      "text/event-stream",
    );
    res.setHeader(
      "Cache-Control",
      "no-cache",
    );
    res.setHeader(
      "Connection",
      "keep-alive",
    );

    res.flushHeaders();

    // 3. Send sources first
    res.write(
      `event: sources\n` +
        `data: ${JSON.stringify(formatSearchResultsForAPI(result.results))}\n\n`,
    );

    // 4. Stream the LLM response
    await streamCodeAnswer(
      question,
      result.context,
      (token) => {
        res.write(
          `data: ${JSON.stringify({
            token,
          })}\n\n`,
        );
      },
      (usage) => {
        res.write(`event: usage\ndata: ${JSON.stringify(usage)}\n\n`);
      }
    );

    // 5. Done
    res.write(
      "event: done\ndata: [DONE]\n\n",
    );

    res.end();
  } catch (e) {
    console.error(e);

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Internal Server Error",
      });
    }

    res.write(
      `event: error\n` +
        `data: ${JSON.stringify({
          error:
            "Internal Server Error",
        })}\n\n`,
    );

    res.end();
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});