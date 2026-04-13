import type { LoreCard, LoreCardKind, LoreCardVariant } from "@/src/components/foundation/architectural-types";
import { stripLegacyHtmlToPlainText } from "@/src/lib/hg-doc/html-to-doc";
import {
  defaultLoreCardVariantForKind,
  getLoreNodeSeedBodyHtml,
  tapeVariantForLoreCard,
} from "@/src/lib/lore-node-seed-html";

/** Match `createNewNode` jitter: rotation ±2°, tape ±3° (scaled from UI ±4 / ±6). */
function loreRotationDeg(): number {
  return (Math.random() - 0.5) * 4;
}

function loreTapeRotationDeg(): number {
  return (Math.random() - 0.5) * 6;
}

export function resolveLoreCardForCreate(args: {
  kind: LoreCardKind;
  loreVariant?: LoreCardVariant | undefined;
}): LoreCard {
  const { kind } = args;
  if (kind === "character") {
    return { kind: "character", variant: "v11" };
  }
  const v = args.loreVariant;
  if (v === "v1" || v === "v2" || v === "v3") {
    return { kind, variant: v };
  }
  return { kind, variant: defaultLoreCardVariantForKind(kind) };
}

/**
 * Same shape as `buildContentJsonForContentEntity` for lore HTML bodies (see `ArchitecturalCanvasApp` createNewNode).
 */
export function synthesizeLoreCardContentJsonAndPlainText(args: {
  loreCard: LoreCard;
  /** Optional seed for location v3 strip; defaults to random. */
  locationStripSeed?: string;
}): { contentJson: Record<string, unknown>; plainText: string } {
  const { loreCard } = args;
  const locationStripSeed =
    loreCard.kind === "location" && loreCard.variant === "v3"
      ? (args.locationStripSeed ??
        (typeof globalThis.crypto?.randomUUID === "function"
          ? globalThis.crypto.randomUUID()
          : `loc-${Date.now()}-${Math.random()}`))
      : undefined;

  const bodyHtml = getLoreNodeSeedBodyHtml(
    loreCard.kind,
    loreCard.variant,
    locationStripSeed != null ? { locationStripSeed } : undefined,
  );
  const tapeVariant = tapeVariantForLoreCard(loreCard.kind, loreCard.variant);
  const rotation = loreRotationDeg();
  const tapeRotation = loreTapeRotationDeg();

  const contentJson: Record<string, unknown> = {
    format: "html",
    html: bodyHtml,
    hgArch: {
      theme: "default",
      tapeVariant,
      rotation,
      tapeRotation,
      loreCard,
    },
  };

  const plainText = stripLegacyHtmlToPlainText(bodyHtml).replace(/\s+/g, " ").trim();
  return { contentJson, plainText };
}
