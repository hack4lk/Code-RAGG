/**
 * Code RAGG Assistant - Client-side functionality
 * Handles UI interactions and API communication with streaming support
 */

// ============================================================================
// DOM ELEMENT REFERENCES
// ============================================================================
const questionInput = document.getElementById('question');
const askButton = document.getElementById('askButton');
const status = document.getElementById('status');
const answer = document.getElementById('answer');
const sources = document.getElementById('sources');
const sourceSelect = document.getElementById('source');

// ============================================================================
// EVENT LISTENERS
// ============================================================================
askButton.addEventListener('click', askQuestion);

questionInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    askQuestion();
  }
});

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Processes the answer from the API and formats it into HTML
 * Supports markdown-like syntax: code blocks, lists, headings
 *
 * @param {string} text - The raw text to format
 * @returns {string} HTML representation of the formatted text
 */
function formatAnswer(text) {
  const lines = text.split('\n');

  let html = '';
  let inCodeBlock = false;
  let codeBuffer = [];
  let codeLanguage = '';

  for (const line of lines) {
    // Code fence
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBuffer = [];
        codeLanguage = line.trim().slice(3).trim();
      } else {
        inCodeBlock = false;
        html += `<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
        codeBuffer = [];
        codeLanguage = '';
      }
      continue;
    }

    // Inside a code block
    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      html += '<div class="answer-spacer"></div>';
      continue;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      html += `
        <div class="list-item">
          <strong>${numberedMatch[1]}.</strong>
          ${formatInline(numberedMatch[2])}
        </div>
      `;
      continue;
    }

    // Bullet list
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      html += `
        <div class="bullet-item">
          • ${formatInline(bulletMatch[1])}
        </div>
      `;
      continue;
    }

    // Heading
    const headingMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      html += `<h3>${formatInline(headingMatch[1])}</h3>`;
      continue;
    }

    // Normal paragraph
    html += `<div class="answer-paragraph">${formatInline(trimmed)}</div>`;
  }

  // If streaming ends while a code block is still open, show what we have
  if (inCodeBlock && codeBuffer.length > 0) {
    html += `<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
  }

  return html;
}

/**
 * Formats inline markdown syntax: bold, italic, and inline code
 *
 * @param {string} text - The text to format
 * @returns {string} HTML representation of the formatted text
 */
function formatInline(text) {
  let html = escapeHtml(text);

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  return html;
}

/**
 * Main question handler - Sends question to API and streams response
 * Handles real-time answer and sources display
 */
async function askQuestion() {
  const question = questionInput.value.trim();

  if (!question) {
    return;
  }

  askButton.disabled = true;
  status.innerHTML = '<div class="loading">Searching documentation...</div>';
  answer.innerHTML = '';
  sources.innerHTML = '';

  const endpoint =
    sourceSelect.value === 'code'
      ? '/api/code/chat/stream'
      : '/api/chat/stream';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Request failed`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let answerText = '';

    status.innerHTML = '<div class="loading">Generating answer...</div>';
    let currentEvent = '';

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          currentEvent = '';
          continue;
        }

        // Identify SSE event type
        if (trimmedLine.startsWith('event:')) {
          currentEvent = trimmedLine.slice(6).trim();
          continue;
        }

        if (!trimmedLine.startsWith('data:')) {
          continue;
        }

        const data = trimmedLine.slice(5).trim();

        if (data === '[DONE]') {
          continue;
        }

        try {
          const parsed = JSON.parse(data);

          // ===== SOURCES EVENT =====
          if (currentEvent === 'sources') {
            if (parsed && parsed.length > 0) {
              const source = sourceSelect.value;

              sources.innerHTML = `
                <h3>Sources</h3>
                ${parsed
                  .map((item) => {
                    if (source === 'code') {
                      return `
                        <div class="source">
                          <strong>${escapeHtml(item.symbol)}</strong>
                          — ${escapeHtml(item.file)}
                          :${item.startLine}-${item.endLine}
                        </div>
                      `;
                    }

                    return `
                      <div class="source">
                        <strong>${escapeHtml(item.file)}</strong>
                        — chunk ${item.chunk}
                      </div>
                    `;
                  })
                  .join('')}
              `;
            }

            continue;
          }

          // ===== ANSWER TOKEN EVENT =====
          if (parsed.token) {
            answerText += parsed.token;
            answer.innerHTML = `
              <strong>Answer</strong>
              <div class="answer-content">
                ${formatAnswer(answerText)}
              </div>
            `;
          }
        } catch (error) {
          console.error('Failed to parse stream data:', error, data);
        }
      }
    }

    status.innerHTML = '';
  } catch (error) {
    console.error('Error asking question:', error);

    status.innerHTML = `
      <div class="error">
        Something went wrong while processing the question. Please try again.
      </div>
    `;
  } finally {
    askButton.disabled = false;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escapes HTML special characters to prevent XSS vulnerabilities
 *
 * @param {string} value - The string to escape
 * @returns {string} The escaped string safe for HTML rendering
 */
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
