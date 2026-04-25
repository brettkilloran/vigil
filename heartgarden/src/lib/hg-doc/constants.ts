import type { JSONContent } from "@tiptap/core";

export const HG_DOC_FORMAT = "hgDoc" as const;

/** Empty TipTap document. */
export const EMPTY_HG_DOC: JSONContent = {
  content: [{ type: "paragraph" }],
  type: "doc",
};
