import { LORE_LINK_TYPE_OPTIONS } from "@/src/lib/lore-link-types";
import { normalizeLinkTypeAlias } from "@/src/lib/connection-kind-colors";

const ALLOWED_LINK_TYPES = new Set<string>(
  LORE_LINK_TYPE_OPTIONS.map((o) => o.value as string),
);

export function normalizeLoreLinkType(raw: string | undefined): string {
  if (!raw) return "history";
  const t = normalizeLinkTypeAlias(raw);
  return ALLOWED_LINK_TYPES.has(t) ? t : "history";
}

export function escapeHtmlForNoteBody(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escaped HTML fragment with newlines preserved as `<br />` (merge / rich display). */
export function escapePlainBodyToHtmlFragment(plain: string): string {
  return escapeHtmlForNoteBody(plain).replace(/\n/g, "<br />");
}

const HG_ARCH_DEFAULT = {
  theme: "default",
  tapeVariant: "clear",
  rotation: 0,
  tapeRotation: 0,
} as const;

export type BuildLoreNoteContentJsonOptions = {
  /** When true, entire body is LLM/import output pending review. */
  aiPending?: boolean;
};

/** Matches `buildContentJsonForContentEntity` defaults for a simple note card. */
export function buildLoreNoteContentJson(
  plainBody: string,
  options?: BuildLoreNoteContentJsonOptions,
): Record<string, unknown> {
  const inner =
    options?.aiPending === true
      ? `<span data-hg-ai-pending="true">${escapeHtmlForNoteBody(plainBody)}</span>`
      : escapeHtmlForNoteBody(plainBody);
  const bodyHtml = `<div contenteditable="true">${inner}</div>`;
  return {
    format: "html",
    html: bodyHtml,
    hgArch: { ...HG_ARCH_DEFAULT },
  };
}

/**
 * Merge append: approved plain text stays unmarked; proposed import text is wrapped as pending AI.
 */
export function buildLoreNoteContentJsonMerged(
  approvedPlain: string,
  proposedPlain: string,
): Record<string, unknown> {
  const approved = escapePlainBodyToHtmlFragment(approvedPlain.trim());
  const proposed = escapePlainBodyToHtmlFragment(proposedPlain.trim());
  const inner = `${approved}<br /><br /><span data-hg-ai-pending="true">${proposed}</span>`;
  const bodyHtml = `<div contenteditable="true">${inner}</div>`;
  return {
    format: "html",
    html: bodyHtml,
    hgArch: { ...HG_ARCH_DEFAULT },
  };
}

const NODE_W = 280;
const SOURCE_W = 420;
const SOURCE_H = 360;
const GAP = 28;
const ROW_H = 280;
const COLS = 2;

export type LoreImportLayoutPlan = {
  source?: { x: number; y: number; width: number; height: number };
  entities: Array<{ x: number; y: number; width: number; height: number }>;
};

export function planLoreImportCardLayout(
  originX: number,
  originY: number,
  hasSource: boolean,
  entityCount: number,
): LoreImportLayoutPlan {
  const entities: LoreImportLayoutPlan["entities"] = [];
  let cursorY = originY;
  let source: LoreImportLayoutPlan["source"];
  if (hasSource) {
    source = { x: originX, y: originY, width: SOURCE_W, height: SOURCE_H };
    cursorY = originY + SOURCE_H + GAP;
  }
  for (let i = 0; i < entityCount; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    entities.push({
      x: originX + col * (NODE_W + GAP),
      y: cursorY + row * ROW_H,
      width: NODE_W,
      height: 260,
    });
  }
  return { source, entities };
}
