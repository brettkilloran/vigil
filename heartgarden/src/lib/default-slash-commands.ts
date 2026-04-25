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
    command: "formatBlock",
    hint: "H1",
    id: "h1",
    keywords: ["h1", "heading", "title", "large"],
    label: "Large heading",
    value: "h1",
  },
  {
    command: "formatBlock",
    hint: "H2",
    id: "h2",
    keywords: ["h2", "medium", "subtitle"],
    label: "Medium heading",
    value: "h2",
  },
  {
    command: "formatBlock",
    hint: "H3",
    id: "h3",
    keywords: ["h3", "small"],
    label: "Small heading",
    value: "h3",
  },
  {
    command: "formatBlock",
    hint: "¶",
    id: "body",
    keywords: ["body", "paragraph", "text", "p"],
    label: "Body text",
    value: "p",
  },
  {
    command: "formatBlock",
    hint: "“ ”",
    id: "quote",
    keywords: ["quote", "blockquote", "citation"],
    label: "Quote",
    value: "blockquote",
  },
  {
    command: "insertHorizontalRule",
    hint: "—",
    id: "divider",
    keywords: ["divider", "hr", "line", "rule", "separator"],
    label: "Divider",
  },
  {
    command: "arch:checklist",
    hint: "☐",
    id: "checklist",
    keywords: ["checklist", "task", "todo", "checkbox"],
    label: "Checklist",
  },
  {
    command: "insertUnorderedList",
    hint: "•",
    id: "bullets",
    keywords: ["bullet", "list", "ul"],
    label: "Bulleted list",
  },
  {
    command: "insertOrderedList",
    hint: "1.",
    id: "numbers",
    keywords: ["number", "ordered", "ol"],
    label: "Numbered list",
  },
  {
    command: "arch:insertImage",
    hint: "🖼",
    id: "image",
    keywords: ["image", "img", "photo", "picture", "upload"],
    label: "Image",
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
