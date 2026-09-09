import { createEmbedding } from "../embeddings";

async function testEmbedding() {
    const text = "Hello, world!";
    const embedding = await createEmbedding(text);
    console.log(`Embedding length: ${embedding.length}`);
    console.log(embedding.slice(0, 10));
}

testEmbedding();