import type { JSONContent } from "@tiptap/core";

import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";

/** Fresh default note (single empty paragraph). */
export function newDefaultHgDocSeed(): JSONContent {
  return structuredClone(EMPTY_HG_DOC);
}

/** Fresh checklist card with two starter rows. */
export function newTaskHgDocSeed(): JSONContent {
  return {
    content: [
      {
        content: [
          {
            attrs: { checked: false },
            content: [
              {
                content: [
                  {
                    text: "Clarify objective and acceptance criteria",
                    type: "text",
                  },
                ],
                type: "paragraph",
              },
            ],
            type: "taskItem",
          },
          {
            attrs: { checked: false },
            content: [
              {
                content: [
                  {
                    text: "Break work into two focused steps",
                    type: "text",
                  },
                ],
                type: "paragraph",
              },
            ],
            type: "taskItem",
          },
        ],
        type: "taskList",
      },
    ],
    type: "doc",
  };
}
