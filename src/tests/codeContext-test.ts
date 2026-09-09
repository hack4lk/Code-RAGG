import { rerankedCodeSearch } from "../rerankedCodeSearch.js";

import { buildCodeContext } from "../codeContext.js";

const query = process.argv.slice(2).join(" ") || "What does ingest call?";

(async () => {
  const results = await rerankedCodeSearch(query);

  const context = buildCodeContext(results);

  console.log(`\nCode context for: "${query}"\n`);

  console.log(context.content);
})();
