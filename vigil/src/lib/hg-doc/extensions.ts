import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import type { ResolvedPos } from "@tiptap/pm/model";

import { hgDocLowlight } from "@/src/lib/hg-doc/hg-doc-lowlight";

function activeTaskItemText($from: ResolvedPos): string {
  for (let depth = $from.depth; depth >= 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === "taskItem") {
      return node.textContent?.trim() ?? "";
    }
  }
  return "";
}

/**
 * Shared TipTap extension list for hgDoc editors and `@tiptap/html` generateHTML.
 * Keep this single-sourced so persisted HTML snapshots match the live editor.
 */
export function getHgDocExtensions(options?: {
  placeholder?: string | null;
  /** When false, omit placeholder extension (e.g. SSR html generation). */
  withPlaceholder?: boolean;
}) {
  const withPlaceholder = options?.withPlaceholder !== false;
  const placeholder = options?.placeholder ?? "Write here, or type / for blocks…";

  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3] },
      horizontalRule: false,
      bulletList: { HTMLAttributes: { "data-hg-list": "bullet" } },
      orderedList: { HTMLAttributes: { "data-hg-list": "ordered" } },
      blockquote: { HTMLAttributes: { "data-hg-callout": "true" } },
      link: {
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto", "vigil"],
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          class: "hgProseLink",
        },
      },
      dropcursor: { width: 2, class: "hgDropcursor" },
    }),
    HorizontalRule.extend({
      addKeyboardShortcuts() {
        return {
          "Mod-Alt--": () => this.editor.commands.setHorizontalRule(),
        };
      },
    }),
    Image.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          alt: { default: null },
          title: { default: null },
        };
      },
    }).configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: {
        class: "hgProseImage",
        "data-hg-image-block": "true",
      },
    }),
    TaskList.configure({
      HTMLAttributes: {
        "data-hg-task-list": "true",
      },
    }),
    CodeBlockLowlight.configure({
      lowlight: hgDocLowlight,
      defaultLanguage: "typescript",
      HTMLAttributes: {
        class: "hgCodeBlock",
      },
    }),
    TaskItem.extend({
      addKeyboardShortcuts() {
        return {
          Enter: () => {
            const { $from, empty } = this.editor.state.selection;
            if (!empty) return false;
            if (!this.editor.isActive("taskItem")) return false;
            const text = activeTaskItemText($from);
            if (text.length === 0) {
              return this.editor.commands.liftListItem("taskItem");
            }
            return this.editor.commands.splitListItem("taskItem");
          },
          Backspace: () => {
            const { $from, empty } = this.editor.state.selection;
            if (!empty) return false;
            if (!this.editor.isActive("taskItem")) return false;
            if ($from.parentOffset !== 0) return false;
            const text = activeTaskItemText($from);
            if (text.length === 0) {
              return this.editor.commands.liftListItem("taskItem");
            }
            return false;
          },
        };
      },
    }).configure({
      nested: false,
      HTMLAttributes: {
        "data-hg-task-item": "true",
      },
    }),
    ...(withPlaceholder && placeholder
      ? [
          Placeholder.configure({
            placeholder,
            emptyEditorClass: "hgProseIsEmpty",
            showOnlyWhenEditable: true,
          }),
        ]
      : []),
  ];
}
