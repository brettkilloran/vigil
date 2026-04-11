/**
 * Light sanitization for retrieved canvas text before it is embedded in an LLM user message.
 * Reduces prompt-injection surface from adversarial note content; not a cryptographic guarantee.
 */
const LINE_LOOKS_LIKE_INSTRUCTION =
  /^\s*(ignore\s+(all\s+)?(previous|prior|above)|disregard\s+(all\s+)?(previous|instructions)|you\s+are\s+now\s+(the|a)\s+|system\s*:|###\s*instructions)/i;

export function sanitizeRetrievedTextForLorePrompt(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (LINE_LOOKS_LIKE_INSTRUCTION.test(line)) {
      out.push("[line omitted: resembled meta-instructions]");
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}
