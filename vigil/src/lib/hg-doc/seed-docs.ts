import type { Extensions, JSONContent } from "@tiptap/core";
import { generateJSON } from "@tiptap/html";

import { getHgDocExtensions } from "@/src/lib/hg-doc/extensions";
import { newTaskHgDocSeed } from "@/src/lib/hg-doc/new-node-seeds";

const ext = getHgDocExtensions({ withPlaceholder: false }) as Extensions;

/** Demo “Welcome” card — generated once from HTML for readable seed source. */
export const DEMO_ROOT_WELCOME_DOC: JSONContent = generateJSON(
  `<h1>Start here</h1><p>Heartgarden is a canvas for notes, tasks, images, and nested spaces. Drag cards, open folders to move inward, and use the trail at the top to climb back out.</p><blockquote><p>Everything saves to the workspace you are signed into. Pinch or scroll to zoom; drag the background to pan.</p></blockquote><p>Open the <strong>Research folder</strong> on the right when you are ready—the cards inside are different from what you see out here, so nothing is duplicated for the sake of a demo.</p>`,
  ext,
);

/** Demo task card — structured checklist in hgDoc. */
export function demoRootTaskDoc(): JSONContent {
  const base = newTaskHgDocSeed();
  const list = base.content?.[0];
  if (list?.type !== "taskList" || !list.content) return base;
  const items: JSONContent[] = [
    list.content[0]!,
    list.content[1]!,
    {
      type: "taskItem",
      attrs: { checked: false },
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Open the Research folder and read the cards one level down",
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
              text: "Use search (keyboard shortcut in the status bar) when the board grows",
            },
          ],
        },
      ],
    },
  ];
  return { type: "doc", content: [{ type: "taskList", content: items }] };
}

export const DEMO_RESEARCH_DOSSIER_DOC: JSONContent = generateJSON(
  "<p><strong>Curated inputs</strong> for the demo workspace—articles, interview notes, and exports you would normally link from a real project.</p><p>In practice you might tag these, link cards together, or move them into a shared folder for review.</p>",
  ext,
);
