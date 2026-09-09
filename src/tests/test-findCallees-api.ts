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

async function testFindCalleesQuery() {
  const query = "what is the findCallees method and where is it called?";
  
  console.log(`Query: "${query}"\n`);
  
  try {
    const response = await makeRequest(query);
    const parsed = JSON.parse(response);
    
    console.log("LLM Response:");
    console.log(parsed.answer);
    console.log(`\n✅ Context provided: YES`);
  } catch (err: any) {
    console.log(`❌ Error: ${err.message}`);
  }
}

testFindCalleesQuery().catch(console.error);
