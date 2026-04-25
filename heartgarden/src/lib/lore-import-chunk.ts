import { randomUUID } from "node:crypto";

export interface SourceTextChunk {
  body: string;
  charEnd: number;
  charStart: number;
  /** Best-effort section title from markdown heading or first line. */
  heading: string;
  id: string;
}

const MAX_BODY_CHARS = 2000;
const HEADINGLESS_TARGET_CHARS = 1200;
const HEADINGLESS_MIN_CHARS = 600;

const MARKDOWN_HEADING_RE = /^(#{1,6})\s+(.+)$/;

/** Split markdown/plaintext on ATX headings; subdivide oversized bodies. */
export function chunkSourceText(fullText: string): SourceTextChunk[] {
  const text = fullText.replace(/\0/g, "").replace(/\r\n?/g, "\n").trim();
  if (!text) {
    return [];
  }

  const lines = text.split("\n");
  const sections: {
    heading: string;
    start: number;
    end: number;
    lines: string[];
  }[] = [];
  let currentHeading = "Untitled";
  let currentStart = 0;
  let currentEnd = 0;
  let buf: string[] = [];
  let offset = 0;

  const flush = () => {
    if (buf.length === 0) {
      return;
    }
    const body = buf.join("\n");
    if (body.trim().length > 0) {
      sections.push({
        end: currentEnd,
        heading: currentHeading,
        lines: [...buf],
        start: currentStart,
      });
    }
    buf = [];
  };

  for (const line of lines) {
    const lineStart = offset;
    const m = MARKDOWN_HEADING_RE.exec(line);
    if (m) {
      flush();
      currentHeading = m[2]?.trim().slice(0, 200) || "Section";
      currentStart = lineStart;
      buf.push(line);
    } else {
      if (buf.length === 0) {
        currentStart = lineStart;
      }
      buf.push(line);
    }
    offset += line.length + 1;
    currentEnd = offset;
  }
  flush();

  if (sections.length === 0) {
    return buildHeadinglessChunks(text);
  }

  const out: SourceTextChunk[] = [];
  for (const s of sections) {
    const body = s.lines.join("\n");
    out.push(...subdivideChunk(s.heading, body, s.start, s.end));
  }
  return out;
}

interface ParagraphSlice {
  end: number;
  start: number;
  text: string;
}

function headingFromParagraph(para: string): string {
  const line = para.split("\n")[0]?.trim() ?? "";
  if (!line) {
    return "Document";
  }
  return line.slice(0, 120);
}

function splitParagraphSlices(text: string): ParagraphSlice[] {
  const slices: ParagraphSlice[] = [];
  const lines = text.split("\n");
  let offset = 0;
  let paraStart = 0;
  let buf: string[] = [];
  const flush = (end: number) => {
    if (buf.length === 0) {
      return;
    }
    const body = buf.join("\n");
    if (body.trim().length > 0) {
      slices.push({ end, start: paraStart, text: body });
    }
    buf = [];
  };
  for (const line of lines) {
    const lineStart = offset;
    if (!line.trim()) {
      flush(lineStart);
      offset += line.length + 1;
      paraStart = offset;
      continue;
    }
    if (buf.length === 0) {
      paraStart = lineStart;
    }
    buf.push(line);
    offset += line.length + 1;
  }
  flush(text.length);
  return slices;
}

function buildHeadinglessChunks(text: string): SourceTextChunk[] {
  const paragraphs = splitParagraphSlices(text);
  if (paragraphs.length === 0) {
    return subdivideChunk("Document", text, 0, text.length);
  }
  const out: SourceTextChunk[] = [];
  let active: ParagraphSlice[] = [];
  const flushActive = () => {
    if (active.length === 0) {
      return;
    }
    const start = active[0]?.start;
    const end = active.at(-1)?.end;
    const body = active.map((p) => p.text).join("\n\n");
    out.push(
      ...subdivideChunk(headingFromParagraph(active[0]?.text), body, start, end)
    );
    active = [];
  };
  for (const para of paragraphs) {
    if (para.text.length > MAX_BODY_CHARS) {
      flushActive();
      out.push(
        ...subdivideChunk(
          headingFromParagraph(para.text),
          para.text,
          para.start,
          para.end
        )
      );
      continue;
    }
    if (active.length === 0) {
      active.push(para);
      continue;
    }
    const currentBody = active.map((p) => p.text).join("\n\n");
    const nextLen = currentBody.length + 2 + para.text.length;
    const shouldFlush =
      (nextLen > HEADINGLESS_TARGET_CHARS &&
        currentBody.length >= HEADINGLESS_MIN_CHARS) ||
      nextLen > MAX_BODY_CHARS;
    if (shouldFlush) {
      flushActive();
      active.push(para);
      continue;
    }
    active.push(para);
  }
  flushActive();
  return out.length > 0
    ? out
    : subdivideChunk("Document", text, 0, text.length);
}

function subdivideChunk(
  heading: string,
  body: string,
  charStart: number,
  charEnd: number
): SourceTextChunk[] {
  if (body.length <= MAX_BODY_CHARS) {
    return [
      {
        body,
        charEnd,
        charStart,
        heading,
        id: randomUUID(),
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
      body: slice,
      charEnd: charStart + localEnd,
      charStart: charStart + pos,
      heading: part === 0 ? heading : `${heading} (part ${part + 1})`,
      id: randomUUID(),
    });
    pos = localEnd;
    part += 1;
  }
  return parts;
}
