import { describe, expect, it } from "vitest";

import {
  buildContentJsonForContentEntity,
  canvasItemToEntity,
} from "@/src/components/foundation/architectural-db-bridge";
import type { CanvasContentEntity } from "@/src/components/foundation/architectural-types";
import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";
import type { CanvasItem } from "@/src/model/canvas-types";

function baseItem(partial: Partial<CanvasItem>): CanvasItem {
  return {
    id: "item-1",
    spaceId: "space-1",
    itemType: "note",
    x: 0,
    y: 0,
    width: 320,
    height: 240,
    zIndex: 1,
    title: "Title",
    contentText: "",
    contentJson: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("hgDoc persistence cutover", () => {
  it("default/task entity persists as content_json.format=hgDoc when bodyDoc exists", () => {
    const mapped = canvasItemToEntity(
      baseItem({
        itemType: "checklist",
        contentJson: { format: "html", html: "<p>legacy html</p>" },
      }),
      "space-1",
    );
    expect(mapped?.kind).toBe("content");
    if (!mapped || mapped.kind !== "content") return;
    expect(mapped.bodyDoc).toBeTruthy();

    const contentJson = buildContentJsonForContentEntity(mapped);
    expect(contentJson).toMatchObject({
      format: "hgDoc",
      doc: mapped.bodyDoc,
    });
  });

  it("code theme with legacy html migrates to hgDoc persistence", () => {
    const mapped = canvasItemToEntity(
      baseItem({
        itemType: "note",
        contentJson: { format: "html", html: "<pre>code-ish</pre>", hgArch: { theme: "code" } },
      }),
      "space-1",
    );
    expect(mapped?.kind).toBe("content");
    if (!mapped || mapped.kind !== "content") return;
    expect(mapped.theme).toBe("code");
    expect(mapped.bodyDoc).toBeTruthy();

    const contentJson = buildContentJsonForContentEntity(mapped);
    expect(contentJson).toMatchObject({
      format: "hgDoc",
      doc: mapped.bodyDoc,
    });
  });

  it("legacy note HTML hydrates into hgDoc body content", () => {
    const mapped = canvasItemToEntity(
      baseItem({
        itemType: "note",
        contentJson: { format: "html", html: "<p>legacy prose should not carry over</p>" },
      }),
      "space-1",
    );
    expect(mapped?.kind).toBe("content");
    if (!mapped || mapped.kind !== "content") return;
    expect(mapped.bodyDoc).not.toEqual(EMPTY_HG_DOC);
    expect(JSON.stringify(mapped.bodyDoc)).toContain("legacy prose should not carry over");

    const contentJson = buildContentJsonForContentEntity(mapped);
    expect(contentJson).toMatchObject({ format: "hgDoc", doc: mapped.bodyDoc });
  });

  it("lore character HTML body wins over stray bodyDoc when serializing PATCH payload", () => {
    const html = '<div data-hg-lore-portrait-root="v11"></div>';
    const strayDoc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "stale" }] }] };
    const entity: CanvasContentEntity = {
      id: "char-1",
      title: "Agent",
      kind: "content",
      theme: "default",
      rotation: 0,
      width: 320,
      height: 400,
      tapeRotation: 0,
      tapeVariant: "clear",
      bodyHtml: html,
      bodyDoc: strayDoc,
      loreCard: { kind: "character", variant: "v11" },
      stackId: null,
      stackOrder: null,
      slots: { "space-1": { x: 0, y: 0 } },
    };
    const contentJson = buildContentJsonForContentEntity(entity);
    expect(contentJson).toMatchObject({ format: "html", html });
    expect(contentJson).not.toHaveProperty("doc");
  });
});

