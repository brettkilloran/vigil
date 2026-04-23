/**
 * Lightweight defensive HTML sanitizer for rich-text card/focus surfaces.
 * Keeps allowed markup but strips executable vectors from legacy HTML paths.
 */
export function sanitizeRichHtmlForEditor(html: string): string {
  if (!html) return "";
  let sanitized = html;

  // Strip high-risk container tags entirely.
  sanitized = sanitized.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)\b[^>]*\/?\s*>/gi,
    "",
  );

  // Remove inline event-handler attributes.
  sanitized = sanitized.replace(/\son[a-z0-9_-]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");

  // Neutralize javascript: and HTML data URLs in href/src.
  sanitized = sanitized.replace(
    /\s(href|src)\s*=\s*(['"])\s*(?:javascript:|data:text\/html)[\s\S]*?\2/gi,
    ' $1="#"',
  );

  return sanitized;
}

export function sanitizedHtmlOrBr(html: string): string {
  const sanitized = sanitizeRichHtmlForEditor(html);
  return sanitized.trim() ? sanitized : "<br>";
}
