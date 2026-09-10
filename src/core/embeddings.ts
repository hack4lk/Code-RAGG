import "dotenv/config";

import { SearchResult } from "../retrieval/documentSearch.ts";
import { getFullDocumentsForAnswer } from "../retrieval/documentSearch.ts";
import {
  generateChatCompletion,
  streamChatCompletion,
  ChatMessage,
} from "./llm.js";
import { config } from "../infrastructure/configSchema.js";
import {
  getDocumentationSystemPrompt,
  getCodeSystemPrompt,
} from "./prompts.js";

const LM_STUDIO_URL = config.models.lmStudio.url;
const EMBEDDING_MODEL = config.models.lmStudio.embeddingModel;

export async function createEmbedding(text: string): Promise<number[]> {
  const resp = await fetch(`${LM_STUDIO_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Failed to create embedding: ${resp.statusText}`);
  }

  const data = await resp.json();
  return data.data[0].embedding;
}

export async function generateAnswer(
  question: string,
  documents: SearchResult[],
): Promise<string> {
  // Get full document content for top-scoring documents
  const fullDocuments = await getFullDocumentsForAnswer(documents);

  const context = fullDocuments
    .map((doc) => {
      return `--- DOCUMENT: ${doc.filename} ---
${doc.content}`;
    })
    .join("\n\n");

  const systemPrompt = getDocumentationSystemPrompt(context);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: question,
    },
  ];

  return generateChatCompletion(messages, 0.2);
}

export async function streamAnswer(
  question: string,
  documents: SearchResult[],
  onToken: (token: string) => void,
  onUsage?: (usage: any) => void,
): Promise<void> {
  // Get full document content for top-scoring documents
  const fullDocuments = await getFullDocumentsForAnswer(documents);

  const context = fullDocuments
    .map((doc) => {
      return `--- DOCUMENT: ${doc.filename} ---
${doc.content}`;
    })
    .join("\n\n");

  const systemPrompt = getDocumentationSystemPrompt(context);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: question,
    },
  ];

  return streamChatCompletion(messages, 0.2, onToken, onUsage);
}

export async function generateCodeAnswer(
  question: string,
  context: string,
): Promise<string> {
  const prompt = getCodeSystemPrompt(question, context);

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: prompt,
    },
  ];

  return generateChatCompletion(messages, 0.1);
}

export async function streamCodeAnswer(
  question: string,
  context: string,
  onToken: (token: string) => void,
  onUsage?: (usage: any) => void,
): Promise<void> {
  const prompt = getCodeSystemPrompt(question, context);

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: prompt,
    },
  ];

  return streamChatCompletion(messages, 0.1, onToken, onUsage);
}
