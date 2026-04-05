import { randomUUID } from "crypto";

export type SourceTextChunk = {
  id: string;
  /** Best-effort section title from markdown heading or first line. */
  heading: string;
  body: string;
  charStart: number;
  charEnd: number;
};

const MAX_BODY_CHARS = 24_000;

/** Split markdown/plaintext on ATX headings; subdivide oversized bodies. */
export function chunkSourceText(fullText: string): SourceTextChunk[] {
  const text = fullText.replace(/\0/g, "").trim();
  if (!text) return [];

  const lines = text.split(/\n/);
  const sections: { heading: string; start: number; lines: string[] }[] = [];
  let currentHeading = "Untitled";
  let currentStart = 0;
  let buf: string[] = [];
  let offset = 0;

  const flush = () => {
    if (buf.length === 0) return;
    const body = buf.join("\n").trim();
    if (body.length > 0) {
      sections.push({ heading: currentHeading, start: currentStart, lines: [...buf] });
    }
    buf = [];
  };

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line);
    if (m) {
      flush();
      currentHeading = m[2]!.trim().slice(0, 200) || "Section";
      currentStart = offset;
      buf.push(line);
    } else {
      if (buf.length === 0) currentStart = offset;
      buf.push(line);
    }
    offset += line.length + 1;
  }
  flush();

  if (sections.length === 0) {
    return subdivideChunk("Document", text, 0, text.length);
  }

  const out: SourceTextChunk[] = [];
  for (const s of sections) {
    const body = s.lines.join("\n");
    const charStart = text.indexOf(body);
    const start = charStart >= 0 ? charStart : s.start;
    out.push(...subdivideChunk(s.heading, body, start, start + body.length));
  }
  return out;
}

function subdivideChunk(
  heading: string,
  body: string,
  charStart: number,
  charEnd: number,
): SourceTextChunk[] {
  if (body.length <= MAX_BODY_CHARS) {
    return [
      {
        id: randomUUID(),
        heading,
        body,
        charStart,
        charEnd,
      },
    ];
  }
  const parts: SourceTextChunk[] = [];
  let pos = 0;
  let part = 0;
  while (pos < body.length) {
    const slice = body.slice(pos, pos + MAX_BODY_CHARS);
    const localEnd = pos + slice.length;
    parts.push({
      id: randomUUID(),
      heading: part === 0 ? heading : `${heading} (part ${part + 1})`,
      body: slice,
      charStart: charStart + pos,
      charEnd: charStart + localEnd,
    });
    pos = localEnd;
    part += 1;
  }
  return parts;
}
