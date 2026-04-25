import { expect, test } from "@playwright/test";

import { prepDemoSession } from "./fixtures/bootstrap";

test.describe("connection pin anchoring", () => {
  test.beforeEach(async ({ page }) => {
    await prepDemoSession(page);
    await page.goto("/");
    await expect(page.getByText("波途画電")).toBeVisible({ timeout: 30_000 });
  });

  test("anchors drawn string pins to source and target cards", async ({
    page,
  }) => {
    const nodes = page.locator("[data-node-id]");
    await expect(nodes).toHaveCount(5);

    const source = nodes.nth(0);
    const target = nodes.nth(1);
    await expect(source).toHaveAttribute("data-node-id");
    await expect(target).toHaveAttribute("data-node-id");
    const sourceId = await source.evaluate((el) =>
      el.getAttribute("data-node-id")
    );
    const targetId = await target.evaluate((el) =>
      el.getAttribute("data-node-id")
    );
    expect(sourceId).toBeTruthy();
    expect(targetId).toBeTruthy();

    await page.getByRole("button", { name: "Draw" }).click();
    await source.click();
    await target.click();

    await expect
      .poll(async () => page.locator("svg[aria-hidden] circle").count())
      .toBeGreaterThanOrEqual(2);

    const attached = await page.evaluate(
      ({ sourceNodeId, targetNodeId }) => {
        const sourceEl = document.querySelector<HTMLElement>(
          `[data-node-id="${sourceNodeId}"]`
        );
        const targetEl = document.querySelector<HTMLElement>(
          `[data-node-id="${targetNodeId}"]`
        );
        const svg = document.querySelector<SVGSVGElement>("svg[aria-hidden]");
        if (!(sourceEl && targetEl && svg)) {
          return null;
        }

        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const pad = 24;
        const circles = [...svg.querySelectorAll("circle")];

        const points = circles
          .map((circle) => {
            const cx = Number(circle.getAttribute("cx"));
            const cy = Number(circle.getAttribute("cy"));
            if (!(Number.isFinite(cx) && Number.isFinite(cy))) {
              return null;
            }
            const pt = svg.createSVGPoint();
            pt.x = cx;
            pt.y = cy;
            const matrix = svg.getScreenCTM();
            if (!matrix) {
              return null;
            }
            const screen = pt.matrixTransform(matrix);
            return { x: screen.x, y: screen.y };
          })
          .filter((p): p is { x: number; y: number } => !!p);

        const inRect = (point: { x: number; y: number }, rect: DOMRect) =>
          point.x >= rect.left - pad &&
          point.x <= rect.right + pad &&
          point.y >= rect.top - pad &&
          point.y <= rect.bottom + pad;

        return {
          pointCount: points.length,
          sourceAttached: points.some((point) => inRect(point, sourceRect)),
          targetAttached: points.some((point) => inRect(point, targetRect)),
        };
      },
      { sourceNodeId: sourceId!, targetNodeId: targetId! }
    );

    expect(attached).not.toBeNull();
    expect(attached?.pointCount).toBeGreaterThanOrEqual(2);
    expect(attached?.sourceAttached).toBe(true);
    expect(attached?.targetAttached).toBe(true);
  });
});
