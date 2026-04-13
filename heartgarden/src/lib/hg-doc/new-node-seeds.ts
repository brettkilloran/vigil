import type { JSONContent } from "@tiptap/core";

import { EMPTY_HG_DOC } from "@/src/lib/hg-doc/constants";

/** Fresh default note (single empty paragraph). */
export function newDefaultHgDocSeed(): JSONContent {
  return structuredClone(EMPTY_HG_DOC);
}

/** Fresh checklist card with two starter rows. */
export function newTaskHgDocSeed(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: false },
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Clarify objective and acceptance criteria",
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
                    text: "Break work into two focused steps",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
