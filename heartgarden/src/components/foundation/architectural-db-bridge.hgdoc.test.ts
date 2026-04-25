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
    contentJson: null,
    contentText: "",
    height: 240,
    id: "item-1",
    itemType: "note",
    spaceId: "space-1",
    title: "Title",
    updatedAt: "2026-01-01T00:00:00.000Z",
    width: 320,
    x: 0,
    y: 0,
    zIndex: 1,
    ...partial,
  };
}

describe("hgDoc persistence cutover", () => {
  it("default/task entity persists as content_json.format=hgDoc when bodyDoc exists", () => {
    const mapped = canvasItemToEntity(
      baseItem({
        contentJson: { format: "html", html: "<p>legacy html</p>" },
        itemType: "checklist",
      }),
      "space-1"
    );
    expect(mapped?.kind).toBe("content");
    if (!mapped || mapped.kind !== "content") {
      return;
    }
    expect(mapped.bodyDoc).toBeTruthy();

    const contentJson = buildContentJsonForContentEntity(mapped);
    expect(contentJson).toMatchObject({
      doc: mapped.bodyDoc,
      format: "hgDoc",
    });
  });

  it("code theme with legacy html migrates to hgDoc persistence", () => {
    const mapped = canvasItemToEntity(
      baseItem({
        contentJson: {
          format: "html",
          hgArch: { theme: "code" },
          html: "<pre>code-ish</pre>",
        },
        itemType: "note",
      }),
      "space-1"
    );
    expect(mapped?.kind).toBe("content");
    if (!mapped || mapped.kind !== "content") {
      return;
    }
    expect(mapped.theme).toBe("code");
    expect(mapped.bodyDoc).toBeTruthy();

    const contentJson = buildContentJsonForContentEntity(mapped);
    expect(contentJson).toMatchObject({
      doc: mapped.bodyDoc,
      format: "hgDoc",
    });
  });

  it("legacy note HTML hydrates into hgDoc body content", () => {
    const mapped = canvasItemToEntity(
      baseItem({
        contentJson: {
          format: "html",
          html: "<p>legacy prose should not carry over</p>",
        },
        itemType: "note",
      }),
      "space-1"
    );
    expect(mapped?.kind).toBe("content");
    if (!mapped || mapped.kind !== "content") {
      return;
    }
    expect(mapped.bodyDoc).not.toEqual(EMPTY_HG_DOC);
    expect(JSON.stringify(mapped.bodyDoc)).toContain(
      "legacy prose should not carry over"
    );

    const contentJson = buildContentJsonForContentEntity(mapped);
    expect(contentJson).toMatchObject({ doc: mapped.bodyDoc, format: "hgDoc" });
  });

  it("lore character HTML body wins over stray bodyDoc when serializing PATCH payload", () => {
    const html = '<div data-hg-lore-portrait-root="v11"></div>';
    const strayDoc = {
      content: [
        { content: [{ text: "stale", type: "text" }], type: "paragraph" },
      ],
      type: "doc",
    };
    const entity: CanvasContentEntity = {
      bodyDoc: strayDoc,
      bodyHtml: html,
      height: 400,
      id: "char-1",
      kind: "content",
      loreCard: { kind: "character", variant: "v11" },
      rotation: 0,
      slots: { "space-1": { x: 0, y: 0 } },
      stackId: null,
      stackOrder: null,
      tapeRotation: 0,
      tapeVariant: "clear",
      theme: "default",
      title: "Agent",
      width: 320,
    };
    const contentJson = buildContentJsonForContentEntity(entity);
    expect(contentJson).toMatchObject({ format: "html", html });
    expect(contentJson).not.toHaveProperty("doc");
  });
});
