/** TipTap JSON presets for canvas item types. */

export type JSONDoc = Record<string, unknown>;

export function emptyNoteDoc(): JSONDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [] }],
  };
}

/** Single open task — checklist cards start here (Phase 3). */
export function emptyChecklistDoc(): JSONDoc {
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
                content: [],
              },
            ],
          },
        ],
      },
    ],
  };
}
