# API Documentation

Complete reference for the RAG Demo REST API.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, no authentication is required. In production, implement authentication middleware (JWT, API keys, etc.).

## Common Response Format

All responses are JSON unless otherwise noted.

### Success Response

```json
{
  "answer": "...",
  "sources": [...]
}
```

### Error Response

```json
{
  "error": "Error message",
  "details": "Optional additional details"
}
```

## Endpoints

### Document Q&A

#### POST /api/chat

Ask questions about your documentation.

**Request:**

```json
{
  "question": "What is the installation process?"
}
```

**Parameters:**

- `question` (string, required): The question to ask

**Response:**

```json
{
  "answer": "The installation process involves...",
  "sources": [
    {
      "file": "installation.md",
      "chunk": 0,
      "score": 0.85,
      "rerankerScore": 0.92
    }
  ]
}
```

**Response Fields:**

- `answer` (string): The generated answer
- `sources` (array): List of source documents used
  - `file` (string): Source filename
  - `chunk` (number): Chunk index in document
  - `score` (number): Vector similarity score (0-1)
  - `rerankerScore` (number): Reranker quality score (0-1)

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid question parameter
- `500 Internal Server Error`: Server error

**Example cURL:**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I install the application?"}'
```

**Example JavaScript:**

```javascript
async function askQuestion(question) {
  const response = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return response.json();
}

const result = await askQuestion("How do I configure the database?");
console.log(result.answer);
```

#### POST /api/chat/stream

Ask questions with streaming response (Server-Sent Events).

**Request:**

```json
{
  "question": "What is the architecture of this system?"
}
```

**Parameters:**

- Same as `/api/chat`

**Response Format (SSE):**

```
event: sources
data: [{"file": "README.md", "chunk": 0, ...}]

data: {"token": "The"}
data: {"token": " "}
data: {"token": "system"}
data: {"token": " "}
...
event: done
data: [DONE]
```

**Response Events:**

- `sources`: Initial array of relevant sources
- `data`: Individual tokens of the answer (streamed)
- `done`: Signals completion of response

**Status Codes:**

- `200 OK`: Stream started
- `400 Bad Request`: Invalid question
- `500 Internal Server Error`: Server error

**Example JavaScript:**

```javascript
async function askQuestionStream(question) {
  const response = await fetch("http://localhost:3000/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.startsWith("event: sources")) {
        // Handle sources
      } else if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        if (data.token) {
          process.stdout.write(data.token);
        }
      }
    }
  }
}

await askQuestionStream("How do I configure the database?");
```

### Code Q&A

#### POST /api/code/chat

Ask questions about your codebase.

**Request:**

```json
{
  "question": "What does the chunkMarkdown function do?"
}
```

**Parameters:**

- `question` (string, required): The question to ask

**Response:**

```json
{
  "answer": "The chunkMarkdown function divides markdown documents into smaller chunks...",
  "sources": [
    {
      "file": "src/chunker.ts",
      "symbol": "chunkMarkdown",
      "type": "function",
      "startLine": 10,
      "endLine": 45,
      "retrieval": ["semantic"],
      "rerankerScore": 0.88
    }
  ]
}
```

**Response Fields:**

- `answer` (string): The generated answer about the code
- `sources` (array): List of code snippets used
  - `file` (string): Source file path
  - `symbol` (string): Function/class/method name
  - `type` (string): Symbol type (function, class, method, etc.)
  - `startLine` (number): Start line in file
  - `endLine` (number): End line in file
  - `retrieval` (array): How result was found
    - `semantic`: Found by semantic search
    - `target`: Explicitly named symbol
    - `caller`: Function that calls target
    - `callee`: Function called by target
  - `rerankerScore` (number): Quality score (0-1)

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Invalid question
- `500 Internal Server Error`: Server error

**Special Question Types:**

Relationship questions (for understanding function call graphs):

```bash
# What calls this function?
"What calls the parseCode function?"
"Who calls queryDatabase?"

# What does this function call?
"What does renderComponent call?"
"What does chunkMarkdown call?"

# Where is this used?
"Where is createEmbedding used?"
"Who uses the database module?"
```

**Example cURL:**

```bash
curl -X POST http://localhost:3000/api/code/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What does the parseCodebase function do?"}'
```

**Example JavaScript:**

```javascript
async function askCodeQuestion(question) {
  const response = await fetch("http://localhost:3000/api/code/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return response.json();
}

const result = await askCodeQuestion("How does code ingestion work?");
console.log(result.answer);
console.log("Sources:", result.sources);
```

#### POST /api/code/chat/stream

Ask code questions with streaming response.

**Request:**

```json
{
  "question": "What is the code ingestion pipeline?"
}
```

**Parameters:**

- Same as `/api/code/chat`

**Response Format (SSE):**

Same as `/api/chat/stream`, but with code-specific sources.

**Example JavaScript:**

```javascript
async function askCodeQuestionStream(question) {
  const response = await fetch("http://localhost:3000/api/code/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value);
    const lines = buffer.split("\n");
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith("event: sources")) {
        console.log("Sources received");
      } else if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.token) {
            process.stdout.write(data.token);
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      } else if (line.startsWith("event: done")) {
        console.log("\n[Response complete]");
      }
    }
  }
}

await askCodeQuestionStream("How does the search work?");
```

## Rate Limiting

Currently no rate limiting is implemented. For production, add middleware:

```javascript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use("/api/", limiter);
```

## Error Handling

### Common Errors

#### 400 Bad Request - Missing Question

```json
{
  "error": "Invalid question",
  "question": null
}
```

**Solution**: Provide a non-empty question string.

#### 400 Bad Request - Invalid JSON

```json
{
  "error": "Invalid JSON in request body"
}
```

**Solution**: Verify JSON syntax, use proper Content-Type header.

#### 500 Internal Server Error - Database Connection

```json
{
  "error": "Database connection failed"
}
```

**Solution**: Verify PostgreSQL is running and credentials are correct.

#### 500 Internal Server Error - LM Studio Connection

```json
{
  "error": "Failed to create embedding: 500 Internal Server Error"
}
```

**Solution**: Verify LM Studio is running and models are loaded.

#### 504 Gateway Timeout

**Solution**: Increase REQUEST_TIMEOUT in .env or optimize your query.

## Best Practices

### 1. Question Phrasing

**Good questions:**

- "How do I configure the database?"
- "What does the parseCodebase function do?"
- "What calls the embedFunction?"
- "Where is createEmbedding used?"

**Avoid:**

- Single word queries: "embeddings"
- Vague questions: "how does this work?"
- Questions outside the data: "What is the meaning of life?"

### 2. Streaming vs Non-Streaming

**Use non-streaming (/api/chat) when:**

- Building chatbot interfaces
- Need complete answer before processing
- Answers are typically short

**Use streaming (/api/chat/stream) when:**

- Building real-time chat interfaces
- Answers are long
- Want perceived faster response
- Building SSE-compatible clients

### 3. Error Handling

Always handle errors in production:

```javascript
try {
  const response = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    console.error("API error:", data.error);
    return null;
  }

  return data;
} catch (error) {
  console.error("Request failed:", error);
  return null;
}
```

### 4. Source Attribution

Always attribute answers to sources:

```javascript
const result = await askQuestion("How do I configure X?");

console.log("Answer:", result.answer);
console.log("\nSources:");
for (const source of result.sources) {
  console.log(`- ${source.file} (chunk ${source.chunk})`);
  console.log(`  Relevance: ${(source.rerankerScore * 100).toFixed(0)}%`);
}
```

## Testing

### Using cURL

```bash
# Document Q&A
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is this application?"
  }'

# Code Q&A
curl -X POST http://localhost:3000/api/code/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What does the main ingest function do?"
  }'

# Streaming
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I install?"}' \
  -N
```

### Using Postman

1. Create a new POST request
2. URL: `http://localhost:3000/api/chat`
3. Headers tab: Add `Content-Type: application/json`
4. Body tab (raw): `{"question": "Your question here"}`
5. Send

For streaming:

1. Use same setup as above but `/api/chat/stream`
2. In Postman settings, enable "Stream response"

### Using Python

```python
import requests

# Non-streaming
response = requests.post(
    'http://localhost:3000/api/chat',
    json={'question': 'What is this application?'}
)
print(response.json()['answer'])

# Streaming
response = requests.post(
    'http://localhost:3000/api/chat/stream',
    json={'question': 'How do I install?'},
    stream=True
)
for line in response.iter_lines():
    if line.startswith(b'data: '):
        data = json.loads(line[6:])
        if 'token' in data:
            print(data['token'], end='', flush=True)
```

## API Limits and Performance

| Aspect               | Typical      | Maximum            |
| -------------------- | ------------ | ------------------ |
| Max question length  | 5000 chars   | 10000 chars        |
| Max answer length    | ~2000 tokens | ~4000 tokens       |
| Sources per response | 3-5          | 10                 |
| Response time        | 2-10s        | 60s timeout        |
| Concurrent requests  | 10+          | Hardware dependent |

## Webhooks (Future)

Not currently implemented. Would allow events like:

- Ingestion complete
- New sources available
- Model updates

## Next Steps

- Check [faq.md](faq.md) for API troubleshooting
- See [configuration.md](configuration.md) for server configuration
- Review [README.md](README.md) for architecture overview
