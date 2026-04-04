/** Mouse event target may be a Text node; `closest` only exists on Element. */
export function pointerEventTargetElement(target: EventTarget | null): Element | null {
  if (!target || !(target instanceof Node)) return null;
  if (target.nodeType === Node.TEXT_NODE) return target.parentElement;
  return target instanceof Element ? target : null;
}
