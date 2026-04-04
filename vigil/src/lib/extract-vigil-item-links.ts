const HEARTGARDEN_ITEM_HREF = /^vigil:item:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Walk TipTap/ProseMirror JSON for link marks with href `vigil:item:<uuid>`. */
export function extractVigilItemLinkTargets(doc: unknown): string[] {
  const out = new Set<string>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (Array.isArray(o.marks)) {
      for (const m of o.marks) {
        if (!m || typeof m !== "object") continue;
        const mark = m as Record<string, unknown>;
        if (mark.type !== "link") continue;
        const attrs = mark.attrs as Record<string, unknown> | undefined;
        const href = typeof attrs?.href === "string" ? attrs.href : "";
        const match = HEARTGARDEN_ITEM_HREF.exec(href);
        if (match) out.add(match[1]!.toLowerCase());
      }
    }
    const content = o.content;
    if (Array.isArray(content)) {
      for (const c of content) visit(c);
    }
  };
  visit(doc);
  return [...out];
}
