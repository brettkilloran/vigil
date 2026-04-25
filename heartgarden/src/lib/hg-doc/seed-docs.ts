import type { Extensions, JSONContent } from "@tiptap/core";
import { generateJSON } from "@tiptap/html";

import { getHgDocExtensions } from "@/src/lib/hg-doc/extensions";
import { newTaskHgDocSeed } from "@/src/lib/hg-doc/new-node-seeds";

const ext = getHgDocExtensions({ withPlaceholder: false }) as Extensions;

/** Demo welcome card — onboarding copy for local/demo bootstrap (no campaign lore assumed). */
export const DEMO_ROOT_WELCOME_DOC: JSONContent = generateJSON(
  "<h1>Your table at a glance</h1><p><strong>Heartgarden</strong> is a pinboard canvas: each <strong>card</strong> is a note, checklist, code snippet, or image. You do not need to know anything about a specific game world to explore this demo — the names are placeholders.</p><p><strong>Move around:</strong> drag the empty background to pan; scroll or pinch to zoom.</p><p><strong>Canvas thread:</strong> the colored line from this card toward the <strong>sample stack</strong> (top sheet) is a real pin thread — same kind you can draw between cards with the connect tool.</p><p><strong>Trail / breadcrumbs:</strong> when you open a folder, a path appears at the top of the canvas — use it to step back out without losing context.</p><p><strong>Search:</strong> open the command palette with <strong>Ctrl+K</strong> on Windows/Linux or <strong>⌘K</strong> on Mac (the status bar shows the same hint) to jump to cards and actions as the board grows.</p><blockquote><p>In a connected workspace, your edits save to the account you signed in with. This screen is a <strong>local demo</strong> so you can try the UI safely.</p></blockquote><p><strong>Next:</strong> open the <strong>Demo subspace folder</strong> below. The cards inside are only in that space — nothing repeats from out here on purpose.</p>",
  ext
);

/** Demo task card — structured checklist in hgDoc. */
export function demoRootTaskDoc(): JSONContent {
  const base = newTaskHgDocSeed();
  const list = base.content?.[0];
  if (list?.type !== "taskList" || !list.content) {
    return base;
  }
  const items: JSONContent[] = [
    {
      type: "taskItem",
      attrs: { checked: false },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Pan and zoom once so you see the welcome card, stack, checklist, image, and folder",
            },
          ],
        },
      ],
    },
    {
      type: "taskItem",
      attrs: { checked: false },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Select a card and skim the title bar (open focus if you want a larger editor)",
            },
          ],
        },
      ],
    },
    {
      type: "taskItem",
      attrs: { checked: false },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Open Demo subspace folder — a small space with specimen lore cards",
            },
          ],
        },
      ],
    },
    {
      type: "taskItem",
      attrs: { checked: false },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Use search from the status bar when you want to jump to text across many cards",
            },
          ],
        },
      ],
    },
  ];
  return { type: "doc", content: [{ type: "taskList", content: items }] };
}

export const DEMO_RESEARCH_DOSSIER_DOC: JSONContent = generateJSON(
  "<p><strong>You are inside the demo folder.</strong> This sample space stays small on purpose (a few items only).</p><p>Folders are <strong>spaces</strong>: double-click to enter, use the trail to leave. The <strong>stack on the home board</strong> is only out there — nothing is duplicated here.</p><p>Three specimen cards tie together here: <strong>Morgan Vale</strong> (warder), the <strong>Ratcatchers</strong> faction roster, and <strong>Arbiter Station Lagrange 1</strong>. Pin threads on the board link them so you can see relationship lines at a glance.</p><p>Try renaming titles or dragging items — the demo is disposable scaffolding, not your lore bible.</p>",
  ext
);

export const DEMO_ARCHIVE_NOTE_DOC: JSONContent = generateJSON(
  "<p><strong>Three levels deep.</strong> Breadcrumbs still show <em>where</em> you are; click a segment to jump up without hunting for the back of the stack.</p><p>This note only exists in this inner folder — outer layers do not duplicate it — so you can tell which space you are in at a glance.</p><p>When you are done exploring, climb the trail to the main board and keep adding your own cards.</p>",
  ext
);

/** Second demo card in the Archive subspace (dummy inventory-style blurbs). */
export const DEMO_ARCHIVE_EXTRA_DOC: JSONContent = generateJSON(
  "<p><strong>Dummy “vault” row.</strong> In a real campaign you might track odd loot, letters, or puzzle clues here.</p><ul><li>Sealed envelope — unknown addressee</li><li>Sketch of a door marked with the same symbol as your hook card</li><li>Unused: tear-off props you can rename anytime</li></ul>",
  ext
);

/** Three-card stack on the home canvas: bottom → middle → top (higher stack order draws on top). */
export const DEMO_STACK_HOME_BOTTOM_DOC: JSONContent = generateJSON(
  "<p><strong>Back of the stack.</strong> Several cards can share one footprint; the pile fans open when you interact with the top card.</p>",
  ext
);
export const DEMO_STACK_HOME_MIDDLE_DOC: JSONContent = generateJSON(
  "<p><strong>Middle sheet.</strong> Reorder cards in the stack modal when you need a different card on top for dragging or focus.</p>",
  ext
);
export const DEMO_STACK_HOME_TOP_DOC: JSONContent = generateJSON(
  "<p><strong>Top card.</strong> Click the stack (select tool) to open the fan and pull a specific sheet forward, or drag the whole pile by its front card.</p>",
  ext
);
