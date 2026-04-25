import type { JSONContent } from "@tiptap/core";

import { hgDocToPlainText } from "@/src/lib/hg-doc/serialize";

export interface HgDocSection {
  charRange: [number, number];
  headingPath: string[];
  text: string;
}

function nodeText(node: JSONContent | null | undefined): string {
  if (!node) {
    return "";
  }
  const parts: string[] = [];
  const walk = (n: JSONContent) => {
    if (typeof n.text === "string" && n.text.trim()) {
      parts.push(n.text.trim());
    }
    if (n.type === "horizontalRule") {
      parts.push("—");
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) {
        walk(child);
      }
    }
  };
  walk(node);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

interface TempSection {
  headingPath: string[];
  text: string;
}

function trimHeadingPath(path: string[]): string[] {
  const out = path.map((p) => p.trim()).filter(Boolean);
  if (out.length === 0) {
    return ["Untitled"];
  }
  return out;
}

export function deriveSectionsFromHgDoc(
  doc: JSONContent,
  itemTitle: string
): HgDocSection[] {
  const title = itemTitle.trim() || "Untitled";
  const topLevel = Array.isArray(doc?.content) ? doc.content : [];
  if (topLevel.length === 0) {
    return [{ headingPath: [title], text: "", charRange: [0, 0] }];
  }

  const sections: TempSection[] = [];
  const headingStack: string[] = [title];
  let activeText: string[] = [];

  const flush = () => {
    const text = activeText
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    sections.push({
      headingPath: trimHeadingPath([...headingStack]),
      text,
    });
    activeText = [];
  };

  for (const block of topLevel) {
    if (block?.type === "heading") {
      flush();
      const headingText = nodeText(block) || "Untitled section";
      const levelRaw = Number(block.attrs?.level);
      const level = Number.isFinite(levelRaw)
        ? Math.min(3, Math.max(1, Math.floor(levelRaw)))
        : 1;
      headingStack[level - 1] = headingText;
      headingStack.length = level;
      continue;
    }
    const text = nodeText(block);
    if (!text) {
      continue;
    }
    activeText.push(text);
  }
  flush();

  const dense = sections.filter((s) => s.text.trim().length > 0);
  const usable = dense.length > 0 ? dense : sections;
  if (usable.length === 0) {
    const plain = hgDocToPlainText(doc).trim();
    return [
      { headingPath: [title], text: plain, charRange: [0, plain.length] },
    ];
  }

  const withRanges: HgDocSection[] = [];
  let cursor = 0;
  for (const section of usable) {
    const text = section.text.trim();
    const start = cursor;
    const end = start + text.length;
    withRanges.push({
      headingPath:
        section.headingPath.length > 0 ? section.headingPath : [title],
      text,
      charRange: [start, end],
    });
    cursor = end + 2;
  }
  return withRanges;
}

export function fallbackSingleSection(
  text: string,
  itemTitle: string
): HgDocSection[] {
  const title = itemTitle.trim() || "Untitled";
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  return [
    {
      headingPath: [title],
      text: normalized,
      charRange: [0, normalized.length],
    },
  ];
}
