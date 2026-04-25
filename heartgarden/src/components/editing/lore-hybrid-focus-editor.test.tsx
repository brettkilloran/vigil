// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoreHybridFocusEditor } from "@/src/components/editing/lore-hybrid-focus-editor";
import { HEARTGARDEN_MEDIA_PLACEHOLDER_SRC } from "@/src/lib/heartgarden-media-placeholder";
import {
  buildCharacterFocusDocumentHtml,
  type CharacterFocusParts,
} from "@/src/lib/lore-character-focus-document-html";

vi.mock("@/src/components/editing/heartgarden-doc-editor", () => ({
  HeartgardenDocEditor: () => <div data-hg-mock-notes="true" />,
}));

const baseParts: CharacterFocusParts = {
  affiliation: "",
  displayName: "",
  nationality: "",
  notesHtml: "<p><br></p>",
  portraitAlt: "",
  portraitClass: "p",
  portraitIsPlaceholder: true,
  portraitSrc: HEARTGARDEN_MEDIA_PLACEHOLDER_SRC,
  portraitUploadClass: "vigil-btn",
  portraitUploadLabel: "",
  role: "",
};

describe("LoreHybridFocusEditor character identity", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  async function waitForIdentityFields(): Promise<void> {
    for (let i = 0; i < 30; i++) {
      if (container.querySelector('[data-hg-character-focus-field="name"]')) {
        return;
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });
    }
    throw new Error("identity fields did not mount");
  }

  it("attaches identity listeners after shell mounts and emits onChangeFocusHtml on field input", async () => {
    const initialHtml = buildCharacterFocusDocumentHtml(baseParts);
    const onChangeFocusHtml = vi.fn();

    act(() => {
      root.render(
        <LoreHybridFocusEditor
          focusDocumentKey="node-a"
          focusHtml={initialHtml}
          onChangeFocusHtml={onChangeFocusHtml}
          variant="character"
        />
      );
    });

    await waitForIdentityFields();

    const nameField = container.querySelector<HTMLElement>(
      '[data-hg-character-focus-field="name"]'
    );
    expect(nameField).toBeTruthy();
    nameField!.textContent = "Ada";

    act(() => {
      nameField?.dispatchEvent(
        new InputEvent("input", { bubbles: true, cancelable: true })
      );
    });

    expect(onChangeFocusHtml).toHaveBeenCalled();
    const last = onChangeFocusHtml.mock.calls.at(-1)?.[0] as string;
    expect(last).toContain("Ada");
    expect(last).not.toBe(initialHtml);
  });

  it("handles input when event target is a Text node inside a field", async () => {
    const initialHtml = buildCharacterFocusDocumentHtml(baseParts);
    const onChangeFocusHtml = vi.fn();

    act(() => {
      root.render(
        <LoreHybridFocusEditor
          focusDocumentKey="node-b"
          focusHtml={initialHtml}
          onChangeFocusHtml={onChangeFocusHtml}
          variant="character"
        />
      );
    });

    await waitForIdentityFields();

    const nameField = container.querySelector<HTMLElement>(
      '[data-hg-character-focus-field="name"]'
    );
    expect(nameField).toBeTruthy();
    const text = document.createTextNode("Bob");
    nameField?.appendChild(text);

    act(() => {
      const ev = new InputEvent("input", {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(ev, "target", { enumerable: true, value: text });
      nameField?.dispatchEvent(ev);
    });

    expect(onChangeFocusHtml).toHaveBeenCalled();
    const last = onChangeFocusHtml.mock.calls.at(-1)?.[0] as string;
    expect(last).toContain("Bob");
  });
});
