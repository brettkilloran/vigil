export interface SlashCommandItem {
  command: string;
  hint?: string;
  id: string;
  keywords?: string[];
  label: string;
  value?: string;
}

/** Default `/` menu — commands match `ArchitecturalCanvasApp` `runFormat`. */
export const DEFAULT_SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    id: "h1",
    label: "Large heading",
    hint: "H1",
    command: "formatBlock",
    value: "h1",
    keywords: ["h1", "heading", "title", "large"],
  },
  {
    id: "h2",
    label: "Medium heading",
    hint: "H2",
    command: "formatBlock",
    value: "h2",
    keywords: ["h2", "medium", "subtitle"],
  },
  {
    id: "h3",
    label: "Small heading",
    hint: "H3",
    command: "formatBlock",
    value: "h3",
    keywords: ["h3", "small"],
  },
  {
    id: "body",
    label: "Body text",
    hint: "¶",
    command: "formatBlock",
    value: "p",
    keywords: ["body", "paragraph", "text", "p"],
  },
  {
    id: "quote",
    label: "Quote",
    hint: "“ ”",
    command: "formatBlock",
    value: "blockquote",
    keywords: ["quote", "blockquote", "citation"],
  },
  {
    id: "divider",
    label: "Divider",
    hint: "—",
    command: "insertHorizontalRule",
    keywords: ["divider", "hr", "line", "rule", "separator"],
  },
  {
    id: "checklist",
    label: "Checklist",
    hint: "☐",
    command: "arch:checklist",
    keywords: ["checklist", "task", "todo", "checkbox"],
  },
  {
    id: "bullets",
    label: "Bulleted list",
    hint: "•",
    command: "insertUnorderedList",
    keywords: ["bullet", "list", "ul"],
  },
  {
    id: "numbers",
    label: "Numbered list",
    hint: "1.",
    command: "insertOrderedList",
    keywords: ["number", "ordered", "ol"],
  },
  {
    id: "image",
    label: "Image",
    hint: "🖼",
    command: "arch:insertImage",
    keywords: ["image", "img", "photo", "picture", "upload"],
  },
];

export function filterSlashCommands(
  items: SlashCommandItem[],
  query: string
): SlashCommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return items;
  }
  return items.filter((it) => {
    const hay = [it.label, it.id, ...(it.keywords ?? [])]
      .join(" ")
      .toLowerCase();
    return hay.includes(q) || it.id.startsWith(q);
  });
}
