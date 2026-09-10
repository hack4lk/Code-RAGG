import { CopilotClient } from "@github/copilot-sdk";
import { logger } from "../infrastructure/logger";

async function main() {
  const question = process.argv[2];

  if (!question) {
    logger.error("Error: Please provide a question as an argument");
    logger.error("Usage: npx ts-node src/copilot-token-test.ts <question>");
    process.exit(1);
  }

  const client = new CopilotClient();

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let modelCalls = 0;

  const session = await client.createSession({
    model: "gpt-4.1",
    workingDirectory: process.cwd(),

    onPermissionRequest: async (request) => {
      logger.report("\nPermission requested:");
      logger.report(JSON.stringify(request, null, 2));

      return {
        kind: "approve-once",
      };
    },
  });

  session.on("assistant.usage", (event) => {
    const inputTokens = event.data.inputTokens ?? 0;

    const outputTokens = event.data.outputTokens ?? 0;

    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;
    modelCalls++;

    console.log("\n========== MODEL CALL ==========");

    console.log(`Model:         ${event.data.model}`);

    console.log(`Input tokens:  ${inputTokens}`);

    console.log(`Output tokens: ${outputTokens}`);

    console.log(`Total tokens:  ${inputTokens + outputTokens}`);

    console.log(`Cost:          ${event.data.cost}`);

    console.log("================================\n");
  });

  const response = await session.sendAndWait({
    prompt: question,
  });

  console.log("\n========== ANSWER ==========\n");

  console.log(response?.data.content);

  console.log("\n========================================");
  console.log("COPILOT SESSION TOTAL");
  console.log("========================================");

  console.log(`Model calls:    ${modelCalls}`);

  console.log(`Input tokens:   ${totalInputTokens}`);

  console.log(`Output tokens:  ${totalOutputTokens}`);

  console.log(`Total tokens:   ${totalInputTokens + totalOutputTokens}`);

  console.log("========================================\n");

  await client.stop();
}

main();
