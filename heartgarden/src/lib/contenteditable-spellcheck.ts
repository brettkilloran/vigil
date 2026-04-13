/**
 * Nested `contenteditable` regions do not inherit spellcheck from an outer host in most browsers.
 * Call after injecting HTML so lore inline fields (names, factions, etc.) skip native squiggles.
 */
export function applySpellcheckToNestedEditables(host: HTMLElement, enabled: boolean): void {
  host.spellcheck = enabled;
  for (const node of host.querySelectorAll<HTMLElement>('[contenteditable="true"]')) {
    node.spellcheck = enabled;
  }
}
