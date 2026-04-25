/**
 * `/` slash-command trigger in rich text (Dropbox Paper–style block menu).
 */

export interface SlashOpenTrigger {
  /** Filter text after `/` (may be empty). */
  query: string;
  /** Plain-text offset where `/` starts (inclusive). */
  startPlainOffset: number;
}

/**
 * When the current line is only optional whitespace + `/` + optional filter (no spaces in filter).
 * Does not match lines like `foo /bar`.
 */
export function findOpenSlashTrigger(
  plainUpToCaret: string
): SlashOpenTrigger | null {
  const lineStart = plainUpToCaret.lastIndexOf("\n") + 1;
  const line = plainUpToCaret.slice(lineStart);
  const m = line.match(/^(\s*)\/(\S*)$/);
  if (!m) {
    return null;
  }
  const slashStart = lineStart + m[1]?.length;
  return { startPlainOffset: slashStart, query: m[2] ?? "" };
}
