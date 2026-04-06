/** Collect `rootId` and every descendant space id using parent pointers (breadth from DB rows). */
export function collectDescendantSpaceIds(
  rootId: string,
  rows: readonly { id: string; parentSpaceId: string | null }[],
): Set<string> {
  const childrenByParent = new Map<string | null, string[]>();
  for (const r of rows) {
    const pid = r.parentSpaceId ?? null;
    const list = childrenByParent.get(pid);
    if (list) list.push(r.id);
    else childrenByParent.set(pid, [r.id]);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    const kids = childrenByParent.get(id);
    if (kids) for (const c of kids) stack.push(c);
  }
  return out;
}
