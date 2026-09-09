export interface DocumentChunk {
  index: number;
  content: string;
}

export function chunkMarkdown(
  markdown: string,
  maxChars: number,
): DocumentChunk[] {
  const lines = markdown.split(/\r?\n/);

  const chunks: DocumentChunk[] = [];

  let documentHeading = "";
  let currentHeading = "";
  let currentContent: string[] = [];

  function saveChunk() {
    const content = currentContent.join("\n").trim();

    if (!content) {
      return;
    }

    chunks.push({
      index: chunks.length,
      content,
    });

    currentContent = [];

    // When a chunk gets split because of size,
    // preserve the current section heading.
    if (currentHeading) {
      currentContent.push(currentHeading);
    }
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;

      // # heading is the document title.
      // We use it as context for all sections.
      if (level === 1) {
        documentHeading = line.trim();
        continue;
      }

      // We found a new section.
      // Save the previous section first.
      if (currentContent.length > 0) {
        saveChunk();
      }

      currentHeading = line.trim();

      // Include the document title as context.
      if (documentHeading) {
        currentContent.push(documentHeading);
      }

      currentContent.push(currentHeading);

      continue;
    }

    currentContent.push(line);

    const currentText = currentContent.join("\n").trim();

    if (currentText.length >= maxChars) {
      saveChunk();
    }
  }

  // Save the final section.
  saveChunk();

  return chunks;
}