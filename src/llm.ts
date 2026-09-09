import "dotenv/config";
import { getLMStudioTokenUsage } from "./tokenUsage";

const MODEL_PROVIDER = process.env.MODEL_PROVIDER || "lm_studio";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4";
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1";
const CHAT_MODEL = process.env.CHAT_MODEL;
const OPENAI_API_URL =
  process.env.OPENAI_API_URL || "https://api.openai.com/v1";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function generateChatCompletion(
  messages: ChatMessage[],
  temperature = 0.2,
): Promise<string> {
  if (MODEL_PROVIDER === "openai") {
    return generateOpenAI(messages, temperature);
  } else {
    return generateLMStudio(messages, temperature);
  }
}

async function generateOpenAI(
  messages: ChatMessage[],
  temperature: number,
): Promise<string> {
  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function generateLMStudio(
  messages: ChatMessage[],
  temperature: number,
): Promise<string> {
  const response = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    throw new Error(`LM Studio error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  temperature: number,
  onToken: (token: string) => void,
  onUsage?: (usage: any) => void,
): Promise<void> {
  if (MODEL_PROVIDER === "openai") {
    return streamOpenAI(messages, temperature, onToken, onUsage);
  } else {
    return streamLMStudio(messages, temperature, onToken, onUsage);
  }
}

async function streamOpenAI(
  messages: ChatMessage[],
  temperature: number,
  onToken: (token: string) => void,
  onUsage?: (usage: any) => void,
): Promise<void> {
  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature,
      stream: true,
      stream_options: {
        include_usage: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let usageData: any = null;
  let modelData: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const json = JSON.parse(data);
          const token = json.choices[0]?.delta?.content || "";
          if (token) {
            fullText += token;
            onToken(token);
          }
          // Capture usage data from the stream (usually in the last message)
          if (json.usage) {
            usageData = json.usage;
          }
          // Capture model name
          if (json.model) {
            modelData = json.model;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }

  // Call onUsage callback if provided and we have usage data
  if (onUsage && usageData) {
    const tokenUsageResult = getLMStudioTokenUsage({
      usage: usageData,
      model: modelData,
      choices: [{ message: { content: fullText } }],
    });
    onUsage(tokenUsageResult);
  }
}

async function streamLMStudio(
  messages: ChatMessage[],
  temperature: number,
  onToken: (token: string) => void,
  onUsage?: (usage: any) => void,
): Promise<void> {
  const response = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      temperature,
      stream: true,
      stream_options: {
        include_usage: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`LM Studio error: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let usageData: any = null;
  let modelData: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const json = JSON.parse(data);
          const token = json.choices[0]?.delta?.content || "";
          if (token) {
            fullText += token;
            onToken(token);
          }
          // Capture usage data from the stream (usually in the last message)
          if (json.usage) {
            usageData = json.usage;
          }
          // Capture model name
          if (json.model) {
            modelData = json.model;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }

  // Call onUsage callback if provided and we have usage data
  if (onUsage && usageData) {
    const tokenUsageResult = getLMStudioTokenUsage({
      usage: usageData,
      model: modelData,
      choices: [{ message: { content: fullText } }],
    });
    onUsage(tokenUsageResult);
  }
}
