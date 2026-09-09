import http from "http";

function makeRequest(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ question: query });

    const options = {
      hostname: "localhost",
      port: 3000,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve(data);
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function testFullPipeline() {
  console.log("Testing full API pipeline...\n");

  const queries = [
    "how do I ingest code into the app?",
    "code ingestion",
    "how to ingest code",
  ];

  for (const query of queries) {
    console.log(`\nQuery: "${query}"`);
    console.log("-".repeat(60));

    try {
      const response = await makeRequest(query);
      const parsed = JSON.parse(response);

      console.log("Response:");
      console.log(parsed.answer);
      console.log("\nContext provided:", parsed.answer.includes("ingest") ? "✅ YES" : "❌ NO");
    } catch (err: any) {
      console.log(`Error: ${err.message}`);
    }
  }
}

testFullPipeline().catch(console.error);
