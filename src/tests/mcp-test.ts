// test-mcp.ts
import { spawn } from "node:child_process";

const mcpProcess = spawn("npm", ["run", "mcp"]);

let requestId = 1;

mcpProcess.stdout.on("data", (data) => {
  const lines = data.toString().split("\n");
  for (const line of lines) {
    if (line.trim() && line.includes('"jsonrpc"')) {
      console.log("📨 Response:", line);
    }
  }
});

mcpProcess.stderr.on("data", (data) => {
  console.log("🔴 Error:", data.toString());
});

// Send a test request after 1 second
setTimeout(() => {
  const request = {
    jsonrpc: "2.0",
    id: requestId++,
    method: "tools/list",
  };
  console.log("📤 Sending:", JSON.stringify(request));
  mcpProcess.stdin.write(JSON.stringify(request) + "\n");
}, 1000);

// Send a code search request after 2 seconds
setTimeout(() => {
  const request = {
    jsonrpc: "2.0",
    id: requestId++,
    method: "tools/call",
    params: {
      name: "search_code",
      arguments: {
        query: "what parameters are passed to the mealcard component?",
        limit: 10,
        include_callers: true,
        include_callees: true,
      },
    },
  };
  console.log("📤 Sending code search:", JSON.stringify(request));
  mcpProcess.stdin.write(JSON.stringify(request) + "\n");
}, 2000);

// Exit after 8 seconds
setTimeout(() => {
  mcpProcess.kill();
  process.exit(0);
}, 8000);
