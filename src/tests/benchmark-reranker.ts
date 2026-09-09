import http from "http";
import 'dotenv/config';

function makeRequest(query: string): Promise<{ answer: string; time: number }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
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
        const elapsed = Date.now() - startTime;
        try {
          const parsed = JSON.parse(data);
          resolve({ answer: parsed.answer, time: elapsed });
        } catch {
          reject(new Error("Invalid JSON response"));
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function benchmarkQueries() {
  const queries = [
    "what is the findCallees method and where is it called?",
    "how do I ingest code into the app?",
    "explain the hybrid code search",
    "what functions call searchCode?",
  ];

  const rerankerEnabled = process.env.DISABLE_RERANKER !== "true";
  const modeLabel = rerankerEnabled ? "WITH Reranker" : "WITHOUT Reranker";

  console.log(`\n${"=".repeat(70)}`);
  console.log(`Performance Benchmark: ${modeLabel}`);
  console.log(`=`.repeat(70));
  console.log();

  const times: number[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`[${i + 1}/${queries.length}] Testing: "${query}"`);

    try {
      const { answer, time } = await makeRequest(query);
      times.push(time);
      console.log(`  ✅ Response time: ${time}ms`);
      console.log(
        `  Answer preview: ${answer.substring(0, 100).replace(/\n/g, " ")}...`,
      );
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`);
    }

    console.log();
  }

  if (times.length > 0) {
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log(`${"=".repeat(70)}`);
    console.log(`Results (${modeLabel}):`);
    console.log(`  Average: ${avgTime.toFixed(0)}ms`);
    console.log(`  Min: ${minTime}ms`);
    console.log(`  Max: ${maxTime}ms`);
    console.log(`=`.repeat(70));

    console.log(
      `\n💡 To test the other mode, set DISABLE_RERANKER=${rerankerEnabled ? "true" : "false"} in .env`,
    );
  }
}

benchmarkQueries().catch(console.error);
