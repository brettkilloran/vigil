import { describe, expect, it } from "vitest";

import { canvasItemToEntity } from "@/src/components/foundation/architectural-db-bridge";
import {
  buildLoreSourceContentJson,
  buildLoreStructuredBodyContentJson,
} from "@/src/lib/lore-import-commit";

function makeItem(contentJson: Record<string, unknown>, entityType: string | null = "lore") {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    spaceId: "22222222-2222-4222-8222-222222222222",
    itemType: "note" as const,
    x: 0,
    y: 0,
    width: 320,
    height: 260,
    zIndex: 1,
    title: "Imported",
    contentText: "Imported",
    contentJson,
    entityType,
    entityMeta: { aiReview: "pending" as const },
  };
}

describe("lore import body builders", () => {
  it("builds generic bodies as hgDoc and hydrates with text", () => {
    const contentJson = buildLoreStructuredBodyContentJson(
      {
        kind: "generic",
        blocks: [
          { kind: "heading", level: 2, text: "Incident" },
          { kind: "paragraph", text: "Recovered obsidian shard at trench site." },
        ],
      },
      "",
      "Imported",
    );
    expect(contentJson.format).toBe("hgDoc");
    const ent = canvasItemToEntity(makeItem(contentJson, "lore"), "22222222-2222-4222-8222-222222222222");
    expect(ent?.kind).toBe("content");
    if (!ent || ent.kind !== "content") return;
    expect(ent.bodyHtml).toContain("Recovered obsidian shard");
  });

  it("builds location slab fields into ORDO v7 slots", () => {
    const contentJson = buildLoreStructuredBodyContentJson(
      {
        kind: "location",
        name: "Vanphimwell Trench",
        context: "Saguna",
        detail: "Abyssal Site",
        notesParagraphs: ["Residual resonance and unstable tides."],
      },
      "",
      "Imported",
    );
    const html = String((contentJson as { html?: string }).html ?? "");
    expect(html).toContain('data-hg-lore-location-variant="v7"');
    expect(html.toUpperCase()).toContain("VANPHIMWELL");
    expect(html).toContain("Saguna");
    expect(html).toContain("Abyssal");
    expect(html).toContain("data-hg-ai-pending");
  });

  it("builds faction slab with archive fields", () => {
    const contentJson = buildLoreStructuredBodyContentJson(
      {
        kind: "faction",
        namePrimary: "Obsidian Chorus",
        nameAccent: "Civic Cell",
        recordParagraphs: ["Maintains custody chain for recovered artifacts."],
      },
      "",
      "Imported",
    );
    const html = String((contentJson as { html?: string }).html ?? "");
    expect(html).toContain('data-hg-lore-faction-variant="archive091"');
    expect(html).toContain("Obsidian Chorus");
    expect(html).toContain("data-hg-ai-pending");
  });

  it("builds source card content as hgDoc", () => {
    const contentJson = buildLoreSourceContentJson(
      "Section one details.\n\nSection two details.",
    );
    expect(contentJson.format).toBe("hgDoc");
    const ent = canvasItemToEntity(
      makeItem(contentJson, "lore_source"),
      "22222222-2222-4222-8222-222222222222",
    );
    expect(ent?.kind).toBe("content");
    if (!ent || ent.kind !== "content") return;
    expect(ent.bodyHtml).toContain("Section one details");
  });
});
