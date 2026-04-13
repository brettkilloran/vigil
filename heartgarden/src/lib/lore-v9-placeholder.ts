import { syncLoreV11MarkerTilts } from "@/src/lib/lore-v11-marker-tilt";
import { syncLoreV11PhCaretOffsetsInHost } from "@/src/lib/lore-v11-ph-caret";

/** Move caret to the end of replaced placeholder content (browser often leaves it at offset 0). */
export function placeCaretAfterLorePlaceholderReplace(field: HTMLElement): void {
  field.focus({ preventScroll: true });
  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();
  const isNotes = field.matches?.('[class*="charSkNotesBody"]') === true;

  if (isNotes) {
    const paragraphs = field.querySelectorAll("p");
    const last =
      paragraphs.length > 0
        ? paragraphs[paragraphs.length - 1]!
        : (() => {
            const p = document.createElement("p");
            field.appendChild(p);
            return p;
          })();
    const tn = last.firstChild;
    if (tn && tn.nodeType === Node.TEXT_NODE) {
      const len = tn.textContent?.length ?? 0;
      range.setStart(tn, len);
      range.collapse(true);
    } else {
      range.setStart(last, 0);
      range.collapse(true);
    }
  } else {
    range.selectNodeContents(field);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

/** Default v9 inline field copy — classified / unfilled affordance. */
export const LORE_V9_REDACTED_SENTINEL = "REDACTED";

/** Default header line (catalog-style id); keeps muted styling like REDACTED until edited. */
export const LORE_V9_HEADER_META_PLACEHOLDER = "CLGN-ID";

/** Same sentinel / empty / header rules as `syncLoreV9RedactedPlaceholderState`, for one field (empty includes `<br>`-only inline bodies — `textContent` trims to ""). */
export function isLoreFieldPlaceholderContent(el: HTMLElement): boolean {
  const raw = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
  const isHeaderMeta = el.matches?.('[class*="charSkHeaderMeta"]') === true;
  return (
    raw === "" ||
    raw === LORE_V9_REDACTED_SENTINEL ||
    (isHeaderMeta && raw === LORE_V9_HEADER_META_PLACEHOLDER)
  );
}

/** Sentinel / header placeholder must behave as one atomic unit — no collapsed caret inside the word. */
function placeholderExpectedPlain(field: HTMLElement): string {
  return field.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function selectionFullyCoversPlaceholder(field: HTMLElement, sel: Selection): boolean {
  const exp = placeholderExpectedPlain(field);
  if (exp.length === 0) return false;
  if (sel.rangeCount === 0) return false;
  const r = sel.getRangeAt(0);
  if (r.collapsed) return false;
  const picked = sel.toString().replace(/\s+/g, " ").trim();
  return picked === exp;
}

/**
 * Select the entire placeholder copy (REDACTED sentinel, CLGN-ID, empty field, or notes’ first block) so the browser never
 * leaves a collapsed caret between letters — matches real placeholder semantics.
 */
export function selectLoreRedactedPlaceholderAtomically(field: HTMLElement): void {
  if (!isLoreFieldPlaceholderContent(field)) return;
  if (placeholderExpectedPlain(field).length === 0) return;
  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();
  const isNotes = field.matches?.('[class*="charSkNotesBody"]') === true;

  if (isNotes) {
    const p = field.querySelector("p");
    const tn = p?.firstChild;
    if (tn?.nodeType === Node.TEXT_NODE) {
      const len = tn.textContent?.length ?? 0;
      range.setStart(tn, 0);
      range.setEnd(tn, len);
    } else {
      range.selectNodeContents(field);
    }
  } else if (field.childNodes.length === 1 && field.firstChild?.nodeType === Node.TEXT_NODE) {
    const tn = field.firstChild as Text;
    range.setStart(tn, 0);
    range.setEnd(tn, tn.length);
  } else {
    range.selectNodeContents(field);
  }

  field.focus({ preventScroll: true });
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Keeps lore placeholder fields non-editable “inside” the sentinel: full selection on focus and
 * whenever the selection would collapse or partially select within placeholder text.
 */
export function installLorePlaceholderSelectionGuards(host: HTMLElement): () => void {
  let composing = false;

  const onCompositionStart = () => {
    composing = true;
  };
  const onCompositionEnd = () => {
    composing = false;
  };

  const onFocusIn = (e: FocusEvent) => {
    const field = (e.target as HTMLElement | null)?.closest?.(
      "[data-hg-lore-placeholder='true']",
    ) as HTMLElement | null;
    if (!field || !host.contains(field)) return;
    if (!isLoreFieldPlaceholderContent(field)) return;
    if (placeholderExpectedPlain(field).length === 0) return;
    queueMicrotask(() => {
      if (document.activeElement !== field) return;
      const sel = window.getSelection();
      if (sel && selectionFullyCoversPlaceholder(field, sel)) return;
      selectLoreRedactedPlaceholderAtomically(field);
    });
  };

  const onSelectionChange = () => {
    if (composing) return;
    const ae = document.activeElement;
    if (!ae || !(ae instanceof HTMLElement) || !host.contains(ae)) return;
    if (ae.getAttribute("data-hg-lore-placeholder") !== "true") return;
    if (!isLoreFieldPlaceholderContent(ae)) return;
    if (placeholderExpectedPlain(ae).length === 0) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (selectionFullyCoversPlaceholder(ae, sel)) return;
    selectLoreRedactedPlaceholderAtomically(ae);
  };

  host.addEventListener("focusin", onFocusIn, true);
  host.addEventListener("compositionstart", onCompositionStart, true);
  host.addEventListener("compositionend", onCompositionEnd, true);
  document.addEventListener("selectionchange", onSelectionChange);

  return () => {
    host.removeEventListener("focusin", onFocusIn, true);
    host.removeEventListener("compositionstart", onCompositionStart, true);
    host.removeEventListener("compositionend", onCompositionEnd, true);
    document.removeEventListener("selectionchange", onSelectionChange);
  };
}

/**
 * Toggle `data-hg-lore-placeholder` on `[data-hg-lore-field]` nodes under `host`
 * when text is empty or still the sentinel.
 * Optional `data-hg-lore-ph` (v11 character seed): succinct placeholder caption via CSS only — not indexed as body text.
 */
export function syncLoreV9RedactedPlaceholderState(host: HTMLElement | null): void {
  if (!host) return;
  const shell = host.matches?.('[class*="charSkShell"]')
    ? host
    : host.querySelector<HTMLElement>('[class*="charSkShell"]');
  if (!shell) return;
  for (const el of shell.querySelectorAll<HTMLElement>("[data-hg-lore-field]")) {
    if (isLoreFieldPlaceholderContent(el)) {
      el.setAttribute("data-hg-lore-placeholder", "true");
    } else {
      el.removeAttribute("data-hg-lore-placeholder");
    }
  }
  syncLoreV11MarkerTilts(host);
  syncLoreV11PhCaretOffsetsInHost(host);
}

/**
 * First printable input while the sentinel (or header placeholder) is showing: replace the whole field,
 * like a native placeholder. Call from `beforeinput` (capture) on the editor host.
 */
export function consumeLorePlaceholderBeforeInput(field: HTMLElement, event: InputEvent): boolean {
  if (field.getAttribute("data-hg-lore-placeholder") !== "true") return false;
  if (!isLoreFieldPlaceholderContent(field)) return false;

  const it = event.inputType;
  let text: string | null = null;
  if (
    it === "insertText" ||
    it === "insertCompositionText" ||
    it === "insertReplacementText"
  ) {
    text = event.data ?? null;
  } else if (it === "insertFromPaste") {
    text =
      event.dataTransfer?.getData("text/plain") ??
      (event as InputEvent & { clipboardData?: DataTransfer }).clipboardData?.getData("text/plain") ??
      null;
    if (text) text = text.replace(/\r\n/g, "\n");
  } else {
    return false;
  }

  if (text == null) return false;
  if (it !== "insertFromPaste" && text === "") return false;

  event.preventDefault();

  const isNotes = field.matches?.('[class*="charSkNotesBody"]') === true;

  if (isNotes) {
    const normalized = text.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    field.textContent = "";
    for (const line of lines) {
      const p = document.createElement("p");
      p.textContent = line;
      field.appendChild(p);
    }
    if (field.childNodes.length === 0) {
      field.appendChild(document.createElement("p"));
    }
  } else {
    field.textContent = text;
  }

  field.removeAttribute("data-hg-lore-placeholder");
  placeCaretAfterLorePlaceholderReplace(field);
  return true;
}
