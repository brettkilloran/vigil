import type { HgStructuredBlock, HgStructuredBody } from "@/src/lib/hg-doc/structured-body";

export const HG_HEADING_GUIDANCE_PROMPT = [
  "Use H1 for the document title (always present as the first block).",
  "Use H2 for major sections when the body is long or multi-topic.",
  "Use H3 only when there are at least two parallel sub-sections under an H2.",
  "Prefer bullet/ordered lists for small enumerations over adding extra sub-headings.",
  "Do not skip heading levels.",
].join(" ");

export type StructureReport = {
  autoPrependedH1: boolean;
  demotedOrphanH3Count: number;
  promotedH3ToH2Count: number;
  flaggedFlatLongBody: boolean;
  collapsedDuplicateTitleParagraph: boolean;
  finalHeadingCount: { h1: number; h2: number; h3: number };
};

type LintOptions = {
  title?: string;
  requireH1?: boolean;
};

function normalizeTitleLikeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function diceSimilarity(a: string, b: string): number {
  const left = normalizeTitleLikeText(a);
  const right = normalizeTitleLikeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const pairs = (v: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < v.length - 1; i += 1) {
      const pair = v.slice(i, i + 2);
      out.set(pair, (out.get(pair) ?? 0) + 1);
    }
    return out;
  };
  const aPairs = pairs(left);
  const bPairs = pairs(right);
  let intersection = 0;
  for (const [pair, count] of aPairs.entries()) {
    const bCount = bPairs.get(pair) ?? 0;
    intersection += Math.min(count, bCount);
  }
  return (2 * intersection) / (left.length - 1 + (right.length - 1));
}

function blockTextLength(block: HgStructuredBlock): number {
  if (block.kind === "paragraph" || block.kind === "heading" || block.kind === "quote") {
    return block.text.length;
  }
  if (block.kind === "bullet_list" || block.kind === "ordered_list") {
    return block.items.join(" ").length;
  }
  return 0;
}

function countParagraphLikeBlocks(blocks: HgStructuredBlock[]): number {
  return blocks.filter((b) => b.kind === "paragraph" || b.kind === "quote").length;
}

export function lintAndRepairStructuredBody(
  input: HgStructuredBody,
  options: LintOptions = {},
): { body: HgStructuredBody; report: StructureReport } {
  const blocks = input.blocks.map((b) => structuredClone(b));
  let autoPrependedH1 = false;
  let demotedOrphanH3Count = 0;
  let promotedH3ToH2Count = 0;
  let collapsedDuplicateTitleParagraph = false;

  const title = (options.title ?? "").trim();
  if (options.requireH1 && title) {
    const first = blocks[0];
    if (!first || first.kind !== "heading" || first.level !== 1) {
      blocks.unshift({ kind: "heading", level: 1, text: title });
      autoPrependedH1 = true;
    } else if (normalizeTitleLikeText(first.text) !== normalizeTitleLikeText(title)) {
      first.text = title;
    }
  }

  let seenH2 = false;
  let previousLevel = 1;
  for (const block of blocks) {
    if (block.kind !== "heading") continue;
    if (block.level === 2) {
      seenH2 = true;
    } else if (block.level === 3 && !seenH2) {
      block.level = 2;
      promotedH3ToH2Count += 1;
      seenH2 = true;
    }
    if (block.level > previousLevel + 1) {
      if (block.level === 3 && previousLevel <= 1) {
        block.level = 2;
        promotedH3ToH2Count += 1;
      } else {
        block.level = (previousLevel + 1) as 1 | 2 | 3;
      }
    }
    previousLevel = block.level;
  }

  let sectionH3Start = -1;
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!block || block.kind !== "heading") continue;
    if (block.level <= 2) {
      if (sectionH3Start >= 0) {
        const h3Count = i - sectionH3Start;
        if (h3Count === 1) {
          const only = blocks[sectionH3Start];
          if (only?.kind === "heading" && only.level === 3) {
            blocks[sectionH3Start] = { kind: "paragraph", text: only.text };
            demotedOrphanH3Count += 1;
          }
        }
      }
      sectionH3Start = -1;
      continue;
    }
    if (block.level === 3 && sectionH3Start < 0) {
      sectionH3Start = i;
    }
  }
  if (sectionH3Start >= 0) {
    const trailing = blocks.slice(sectionH3Start).filter((b) => b.kind === "heading" && b.level === 3);
    if (trailing.length === 1) {
      const only = blocks[sectionH3Start];
      if (only?.kind === "heading" && only.level === 3) {
        blocks[sectionH3Start] = { kind: "paragraph", text: only.text };
        demotedOrphanH3Count += 1;
      }
    }
  }

  const first = blocks[0];
  const second = blocks[1];
  if (
    first?.kind === "heading" &&
    first.level === 1 &&
    second?.kind === "paragraph" &&
    diceSimilarity(first.text, second.text) >= 0.85
  ) {
    blocks.splice(1, 1);
    collapsedDuplicateTitleParagraph = true;
  }

  const headingCounts = { h1: 0, h2: 0, h3: 0 };
  for (const block of blocks) {
    if (block.kind !== "heading") continue;
    if (block.level === 1) headingCounts.h1 += 1;
    else if (block.level === 2) headingCounts.h2 += 1;
    else headingCounts.h3 += 1;
  }
  const bodyTextLength = blocks.reduce((sum, block) => sum + blockTextLength(block), 0);
  const paragraphLikeCount = countParagraphLikeBlocks(blocks);
  const flaggedFlatLongBody =
    headingCounts.h2 === 0 &&
    (bodyTextLength >= 1500 || (bodyTextLength >= 600 && paragraphLikeCount >= 5));

  return {
    body: { blocks },
    report: {
      autoPrependedH1,
      demotedOrphanH3Count,
      promotedH3ToH2Count,
      flaggedFlatLongBody,
      collapsedDuplicateTitleParagraph,
      finalHeadingCount: headingCounts,
    },
  };
}
