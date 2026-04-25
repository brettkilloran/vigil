"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  SlashCommandAssistPopover,
} from "@/src/components/editing/SlashCommandAssistPopover";
import {
  type EditorCommitReason,
  useEditorSession,
} from "@/src/components/editing/useEditorSession";
import {
  DEFAULT_SLASH_COMMAND_ITEMS,
  filterSlashCommands,
  type SlashCommandItem,
} from "@/src/lib/default-slash-commands";
import { findOpenSlashTrigger } from "@/src/lib/slash-command-caret";

import hostStyles from "@/src/components/editing/BufferedContentEditable.module.css";
import { applySpellcheckToNestedEditables } from "@/src/lib/contenteditable-spellcheck";
import { syncCharSkDisplayNameStack } from "@/src/lib/lore-char-sk-display-name";
import { installLoreV11PlaceholderCaretSync } from "@/src/lib/lore-v11-ph-caret";
import {
  consumeLorePlaceholderBeforeInput,
  installLorePlaceholderSelectionGuards,
  placeCaretAfterLorePlaceholderReplace,
  syncLoreV9RedactedPlaceholderState,
} from "@/src/lib/lore-v9-placeholder";
import { sanitizeRichHtmlForEditor } from "@/src/lib/safe-html";
import { useScrollEdgeOverflowAttrs } from "@/src/lib/use-scroll-edge-overflow";

function isCaretAtStartOfHost(host: HTMLElement, range: Range): boolean {
  if (!range.collapsed) return false;
  const probe = document.createRange();
  try {
    probe.setStart(host, 0);
    probe.setEnd(range.startContainer, range.startOffset);
  } catch {
    return false;
  }
  return probe.toString().length === 0;
}

/** Pixels left of the host rect to treat as in-row “gutter” for checklist hit-testing (handles sit in the margin). */
const RICH_EDITOR_LEFT_GUTTER_HIT_PX = 36;

/**
 * True when the pointer is inside the host, or in the left gutter band aligned with the host
 * vertically while still resolving to a row under the host (e.g. `elementFromPoint` hits a
 * task row). Avoids `root.contains(event.target)` missing nodes painted in the gutter.
 */
function pointerInRichEditorHostOrLeftGutter(
  root: HTMLElement,
  clientX: number,
  clientY: number,
  taskItemSelector: string,
): boolean {
  const r = root.getBoundingClientRect();
  const effLeft = r.left - RICH_EDITOR_LEFT_GUTTER_HIT_PX;
  if (clientY < r.top || clientY > r.bottom) return false;
  if (clientX < effLeft || clientX > r.right) return false;
  const hit = root.ownerDocument.elementFromPoint(clientX, clientY);
  if (!hit) return false;
  if (root.contains(hit)) return true;
  const taskItem = hit.closest(taskItemSelector);
  return !!(taskItem && root.contains(taskItem));
}

function isCaretAtEndOfHost(host: HTMLElement, range: Range): boolean {
  if (!range.collapsed || !host.contains(range.startContainer)) return false;
  const end = document.createRange();
  try {
    end.selectNodeContents(host);
    end.collapse(false);
    const fromCaret = document.createRange();
    fromCaret.setStart(range.startContainer, range.startOffset);
    fromCaret.setEnd(end.startContainer, end.startOffset);
    return fromCaret.toString().length === 0;
  } catch {
    return false;
  }
}

function contiguousTaskItemsFrom(taskItem: HTMLElement, taskItemClass: string): HTMLElement[] {
  const sel = `.${taskItemClass}`;
  const parent = taskItem.parentElement;
  if (!parent) return [taskItem];
  let first: HTMLElement = taskItem;
  while (first.previousElementSibling?.matches(sel)) {
    first = first.previousElementSibling as HTMLElement;
  }
  const out: HTMLElement[] = [];
  let el: HTMLElement | null = first;
  while (el && el.matches(sel)) {
    out.push(el);
    el = el.nextElementSibling as HTMLElement | null;
  }
  return out;
}

function isDocHtmlVisuallyEmpty(html: string): boolean {
  if (!html.trim()) return true;
  const t = html.replace(/\s|\u00a0/g, "").toLowerCase();
  return (
    t === "" ||
    t === "<br>" ||
    t === "<br/>" ||
    t === "<div><br></div>" ||
    t === "<div><br/></div>" ||
    t === "<p><br></p>" ||
    t === "<p></p>" ||
    t === "<div></div>"
  );
}

/** True when caret is inside a nested contenteditable (e.g. checklist line), not the root host. */
function caretIsInsideNestedEditable(root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const n: Node | null = sel.anchorNode;
  if (!n || !root.contains(n)) return false;
  let el: HTMLElement | null =
    n.nodeType === Node.TEXT_NODE ? n.parentElement : (n as HTMLElement);
  while (el && el !== root) {
    if (el.isContentEditable) return true;
    el = el.parentElement;
  }
  return false;
}

function currentNestedEditableAtCaret(root: HTMLElement): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const n: Node | null = sel.anchorNode;
  if (!n || !root.contains(n)) return null;
  let el: HTMLElement | null =
    n.nodeType === Node.TEXT_NODE ? n.parentElement : (n as HTMLElement);
  while (el && el !== root) {
    if (el.isContentEditable) return el;
    el = el.parentElement;
  }
  return null;
}

function nestedEditableAllowsSlashCommands(editable: HTMLElement): boolean {
  return (
    editable.matches('[data-hg-character-focus-notes="true"]') ||
    editable.matches('[data-hg-lore-location-focus-notes="true"]') ||
    editable.matches('[class*="charSkNotesBody"]') ||
    editable.matches('[class*="char3dNotesBody"]')
  );
}

function focusBlockBoundary(
  root: HTMLElement,
  block: Element,
  atStart: boolean,
  taskItemSel: string,
  taskTextSel: string,
) {
  if (!root.contains(block)) return;
  if (block.matches(taskItemSel)) {
    const tt = block.querySelector(taskTextSel) as HTMLElement | null;
    if (tt) {
      tt.focus({ preventScroll: true });
      if (atStart) placeCaretAtStart(tt);
      else placeCaretAtEnd(tt);
    }
    return;
  }
  if (block.matches("p,h1,h2,h3,blockquote,pre")) {
    root.focus({ preventScroll: true });
    const el = block as HTMLElement;
    if (atStart) placeCaretAtStart(el);
    else placeCaretAtEnd(el);
  }
}

function placeCaretAtEnd(el: HTMLElement) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function placeCaretAtStart(el: HTMLElement) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.setStart(el, 0);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function taskTextIsVisuallyEmpty(el: HTMLElement): boolean {
  const t = el.innerText.replace(/\u00a0/g, " ").replace(/\uFEFF/g, "");
  return t.replace(/\s+/g, "").length === 0;
}

function blockTextIsVisuallyEmpty(el: HTMLElement): boolean {
  const t = el.innerText.replace(/\u00a0/g, " ").replace(/\uFEFF/g, "");
  return t.replace(/\s+/g, "").length === 0;
}

function listItemIsVisuallyEmpty(el: HTMLElement): boolean {
  const t = el.innerText.replace(/\u00a0/g, " ").replace(/\uFEFF/g, "");
  return t.replace(/\s+/g, "").length === 0;
}

/** Place caret in `taskText`, preferring a hit-test at the click point when it falls inside the text. */
function placeCaretInTaskTextFromPoint(taskText: HTMLElement, clientX: number, clientY: number) {
  const sel = window.getSelection();
  if (!sel) return;
  let range: Range | null = null;
  const doc = taskText.ownerDocument;
  if (typeof doc.caretRangeFromPoint === "function") {
    try {
      range = doc.caretRangeFromPoint(clientX, clientY);
    } catch {
      range = null;
    }
  } else if ("caretPositionFromPoint" in doc && typeof (doc as unknown as { caretPositionFromPoint: (x: number, y: number) => { offsetNode: Node; offset: number } | null }).caretPositionFromPoint === "function") {
    const pos = (
      doc as unknown as {
        caretPositionFromPoint(x: number, y: number): { offsetNode: Node; offset: number } | null;
      }
    ).caretPositionFromPoint(clientX, clientY);
    if (pos?.offsetNode) {
      range = doc.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  if (range && taskText.contains(range.startContainer)) {
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }
  placeCaretAtEnd(taskText);
}

type WikiCandidate = { id: string; title: string };

/** Plain text from start of `root` up to the caret (collapsed selection). */
function plainTextToCaret(root: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const anchor = sel.anchorNode;
  if (!anchor || !root.contains(anchor)) return "";
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(anchor, sel.anchorOffset);
  return range.toString();
}

/** Build a Range covering plain-text offsets `[start, end)` within `root` text nodes. */
function rangeForPlainTextOffsets(
  root: HTMLElement,
  start: number,
  end: number,
): Range | null {
  if (start < 0 || end < start) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startOffset = 0;
  let endOffset = 0;
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    const len = n.data.length;
    const nextSeen = seen + len;
    if (!startNode && start >= seen && start <= nextSeen) {
      startNode = n;
      startOffset = start - seen;
    }
    if (!endNode && end >= seen && end <= nextSeen) {
      endNode = n;
      endOffset = end - seen;
    }
    seen = nextSeen;
    if (startNode && endNode) break;
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, Math.max(0, Math.min(startNode.length, startOffset)));
  range.setEnd(endNode, Math.max(0, Math.min(endNode.length, endOffset)));
  return range;
}

export type WikiLinkAssistConfig = {
  enabled: boolean;
  getLocalItems: () => WikiCandidate[];
  fetchRemoteSuggest?: (q: string, signal: AbortSignal) => Promise<WikiCandidate[]>;
  excludeEntityId?: string;
};

export type ChecklistDeletionClassNames = {
  taskItem: string;
  taskText: string;
  taskCheckbox: string;
};

type BufferedContentEditableProps = {
  value: string;
  editable?: boolean;
  spellCheck?: boolean;
  className?: string;
  debounceMs?: number;
  plainText?: boolean;
  normalizeOnCommit?: (value: string) => string;
  onCommit: (value: string, reason: EditorCommitReason) => void;
  onDraftDirtyChange?: (dirty: boolean) => void;
  onEscape?: () => void;
  onEnter?: () => void;
  dataAttribute?: string;
  wikiLinkAssist?: WikiLinkAssistConfig | null;
  /**
   * When set: (1) Backspace at the start of an empty checklist text cell removes the whole task row.
   * (2) Pointer hits on the row outside the text cell (e.g. beside the checkbox) move the caret into the text.
   */
  checklistDeletion?: ChecklistDeletionClassNames | null;
  /** `/` slash menu — same commands as the format dock (`runFormat` in shell). */
  richDocCommand?: (command: string, value?: string) => void;
  /** Shown when the document body is empty (Paper-style hint). */
  emptyPlaceholder?: string | null;
};

/**
 * Legacy rich-text editor surface.
 *
 * Cutover policy:
 * - Default/task/code note bodies and media gallery notes use `HeartgardenDocEditor` (`hgDoc`).
 * - Keep this component for lore hybrid **canvas** shells (full HTML plate), folder title
 *   (`plainText`), and any remaining HTML-only surfaces — see `docs/EDITOR_SURFACE_CUTOVER.md`.
 */
export function BufferedContentEditable({
  value,
  editable = true,
  spellCheck = false,
  className,
  debounceMs,
  plainText = false,
  normalizeOnCommit,
  onCommit,
  onDraftDirtyChange,
  onEscape,
  onEnter,
  dataAttribute,
  wikiLinkAssist: _wikiLinkAssist,
  checklistDeletion,
  richDocCommand,
  emptyPlaceholder = null,
}: BufferedContentEditableProps) {
  void _wikiLinkAssist;
  const ref = useRef<HTMLDivElement | null>(null);
  useScrollEdgeOverflowAttrs(ref);
  const pastePlainNextRef = useRef(false);
  const composingRef = useRef(false);
  const slashPlainRangeRef = useRef<{ start: number; end: number } | null>(null);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashAnchor, setSlashAnchor] = useState<DOMRect | null>(null);
  const [slashCandidates, setSlashCandidates] = useState<SlashCommandItem[]>([]);
  const [slashIndex, setSlashIndex] = useState(0);

  const {
    draft,
    beginEditing,
    commitNow,
    cancelEditing,
    onDraftChange,
  } = useEditorSession({
    value,
    debounceMs,
    normalizeOnCommit,
    onCommit,
    onDraftDirtyChange,
  });

  const closeSlash = useCallback(() => {
    setSlashOpen(false);
    setSlashAnchor(null);
    setSlashCandidates([]);
    setSlashIndex(0);
    slashPlainRangeRef.current = null;
  }, []);

  const refreshSlashAssist = useCallback(() => {
    const el = ref.current;
    if (!richDocCommand || plainText || !el || composingRef.current) {
      closeSlash();
      return;
    }
    if (caretIsInsideNestedEditable(el)) {
      const nested = currentNestedEditableAtCaret(el);
      if (!nested || !nestedEditableAllowsSlashCommands(nested)) {
        closeSlash();
        return;
      }
    }
    const plain = plainTextToCaret(el);
    const slash = findOpenSlashTrigger(plain);
    if (!slash) {
      closeSlash();
      return;
    }
    const caretPlain = plain.length;
    slashPlainRangeRef.current = { start: slash.startPlainOffset, end: caretPlain };
    const filtered = filterSlashCommands(DEFAULT_SLASH_COMMAND_ITEMS, slash.query);
    if (filtered.length === 0) {
      closeSlash();
      return;
    }
    setSlashCandidates(filtered);
    setSlashIndex(0);
    setSlashOpen(true);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width >= 0 && rect.height >= 0) {
        setSlashAnchor(rect);
      }
    }
  }, [closeSlash, plainText, richDocCommand]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = plainText ? el.innerText : el.innerHTML;
    if (current === draft) return;
    /* Nested lore fields (`data-hg-lore-field`) focus the inner node, not this host — still “editing”. */
    if (el.contains(document.activeElement)) return;
    if (plainText) {
      el.innerText = draft;
    } else {
      el.innerHTML = sanitizeRichHtmlForEditor(draft);
      applySpellcheckToNestedEditables(el, spellCheck);
      syncCharSkDisplayNameStack(el);
      syncLoreV9RedactedPlaceholderState(el);
    }
  }, [draft, plainText, spellCheck]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || plainText) return;
    applySpellcheckToNestedEditables(el, spellCheck);
    /* Don’t rewrite display-name markup while the user is typing inside the host — preserves caret. */
    if (!el.contains(document.activeElement)) {
      syncCharSkDisplayNameStack(el);
    }
    syncLoreV9RedactedPlaceholderState(el);
  }, [draft, plainText, spellCheck]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || plainText) return;
    const removeGuards = installLorePlaceholderSelectionGuards(el);
    const removePhCaret = installLoreV11PlaceholderCaretSync(el);
    return () => {
      removeGuards();
      removePhCaret();
    };
  }, [plainText]);

  useEffect(() => {
    const el = ref.current;
    if (!el || plainText) return;
    const onFocusOut = (e: FocusEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.(
        '[class*="charSkDisplayName"][data-hg-lore-field]',
      );
      if (!t || !el.contains(t)) return;
      queueMicrotask(() => {
        syncCharSkDisplayNameStack(el);
        syncLoreV9RedactedPlaceholderState(el);
      });
    };
    el.addEventListener("focusout", onFocusOut);
    return () => el.removeEventListener("focusout", onFocusOut);
  }, [plainText]);

  const readElementValue = useCallback(() => {
    const el = ref.current;
    if (!el) return "";
    return plainText ? el.innerText : sanitizeRichHtmlForEditor(el.innerHTML);
  }, [plainText]);

  const applySlashPick = useCallback(
    (item: SlashCommandItem) => {
      const el = ref.current;
      const rangePlain = slashPlainRangeRef.current;
      if (!el || !rangePlain || !richDocCommand) {
        closeSlash();
        return;
      }
      const r = rangeForPlainTextOffsets(el, rangePlain.start, rangePlain.end);
      if (!r) {
        closeSlash();
        return;
      }
      r.deleteContents();
      closeSlash();
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(r);
      }
      requestAnimationFrame(() => {
        richDocCommand(item.command, item.value);
        onDraftChange(readElementValue());
      });
    },
    [closeSlash, onDraftChange, readElementValue, richDocCommand],
  );


  const docEmpty =
    !plainText && !!editable && !!emptyPlaceholder && isDocHtmlVisuallyEmpty(draft);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "v" || e.key === "V")) {
        pastePlainNextRef.current = true;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    const onSel = () => {
      const el = ref.current;
      if (!el) return;
      const ae = document.activeElement;
      if (ae !== el && !el.contains(ae)) return;
      requestAnimationFrame(() => {
        refreshSlashAssist();
      });
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [refreshSlashAssist]);

  return (
    <>
      <div
        ref={ref}
        className={`${hostStyles.richEditorHost} ${hostStyles.richEditorHostInner} ${className ?? ""}`.trim()}
        data-hg-rich-editor-host="true"
        data-hg-rich-editor-inner="true"
        contentEditable={editable}
        suppressContentEditableWarning
        spellCheck={spellCheck}
        data-arch-doc-empty={docEmpty ? "true" : undefined}
        data-placeholder={docEmpty ? emptyPlaceholder ?? undefined : undefined}
        onFocus={() => {
          beginEditing();
        }}
        onBlur={() => {
          closeSlash();
          syncCharSkDisplayNameStack(ref.current);
          syncLoreV9RedactedPlaceholderState(ref.current);
          commitNow("blur");
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          requestAnimationFrame(() => {
            refreshSlashAssist();
          });
        }}
        onBeforeInputCapture={(e) => {
          if (plainText || !editable) return;
          const field = (e.target as HTMLElement | null)?.closest?.(
            "[data-hg-lore-field]",
          ) as HTMLElement | null;
          if (!field) return;
          const native = e.nativeEvent as InputEvent;
          if (!consumeLorePlaceholderBeforeInput(field, native)) return;
          const next = readElementValue();
          onDraftChange(next);
          syncLoreV9RedactedPlaceholderState(ref.current);
          syncCharSkDisplayNameStack(ref.current);
          /* Stack sync can touch display-name HTML after first character — restore caret after layout. */
          queueMicrotask(() => {
            if (field.isConnected) placeCaretAfterLorePlaceholderReplace(field);
          });
          requestAnimationFrame(() => {
            refreshSlashAssist();
          });
        }}
        onInput={() => {
          const next = readElementValue();
          onDraftChange(next);
          syncLoreV9RedactedPlaceholderState(ref.current);
          requestAnimationFrame(() => {
            refreshSlashAssist();
          });
        }}
        onPaste={(event) => {
          if (!plainText && pastePlainNextRef.current) {
            event.preventDefault();
            pastePlainNextRef.current = false;
            const text = event.clipboardData?.getData("text/plain") ?? "";
            document.execCommand("insertText", false, text);
            onDraftChange(readElementValue());
            requestAnimationFrame(() => {
              refreshSlashAssist();
            });
          }
        }}
        onPointerDownCapture={(event) => {
          if (!checklistDeletion || plainText || !editable || event.button !== 0) return;
          const root = ref.current;
          const taskItemSel = `.${checklistDeletion.taskItem}`;
          if (
            !root ||
            !pointerInRichEditorHostOrLeftGutter(root, event.clientX, event.clientY, taskItemSel)
          ) {
            return;
          }
          const t = event.target as HTMLElement;
          const taskTextSel = `.${checklistDeletion.taskText}`;
          const taskCheckboxSel = `.${checklistDeletion.taskCheckbox}`;
          const taskItem = t.closest(taskItemSel) as HTMLElement | null;
          if (!taskItem || !root.contains(taskItem)) return;
          if (t.closest(taskTextSel)) return;
          if (t.closest(taskCheckboxSel)) return;
          const taskText = taskItem.querySelector(taskTextSel) as HTMLElement | null;
          if (!taskText) return;
          event.preventDefault();
          beginEditing();
          taskText.focus({ preventScroll: true });
          placeCaretInTaskTextFromPoint(taskText, event.clientX, event.clientY);
        }}
        onKeyDown={(event) => {
          if (slashOpen && slashCandidates.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setSlashIndex((i) => (i + 1 >= slashCandidates.length ? 0 : i + 1));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setSlashIndex((i) => (i - 1 < 0 ? slashCandidates.length - 1 : i - 1));
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              const pick = slashCandidates[slashIndex];
              if (pick) applySlashPick(pick);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              closeSlash();
              return;
            }
          }

          if (checklistDeletion && !plainText && !event.defaultPrevented) {
            const root = ref.current;
            const sel = window.getSelection();
            if (root && sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              let anchor: Node | null = range.startContainer;
              if (anchor.nodeType === Node.TEXT_NODE) anchor = anchor.parentElement;
              const anchorEl = anchor instanceof Element ? anchor : null;
              const taskTextSel = `.${checklistDeletion.taskText}`;
              const taskItemSel = `.${checklistDeletion.taskItem}`;
              const taskText = anchorEl?.closest(taskTextSel) as HTMLElement | null;
              if (taskText && root.contains(taskText)) {
                const taskItem = taskText.closest(taskItemSel) as HTMLElement | null;
                if (taskItem && root.contains(taskItem)) {
                  if (event.key === "Enter" && event.shiftKey && !event.altKey) {
                    event.preventDefault();
                    document.execCommand("insertLineBreak");
                    onDraftChange(readElementValue());
                    return;
                  }

                  if (event.key === "Enter" && !event.shiftKey && !event.altKey) {
                    if (taskTextIsVisuallyEmpty(taskText)) {
                      event.preventDefault();
                      const following = taskItem.nextElementSibling;
                      const prevItem = taskItem.previousElementSibling as HTMLElement | null;
                      const nextItem = taskItem.nextElementSibling as HTMLElement | null;
                      taskItem.remove();
                      onDraftChange(readElementValue());
                      requestAnimationFrame(() => {
                        const r = ref.current;
                        if (!r?.isConnected) return;
                        const prevText =
                          prevItem?.matches(taskItemSel) === true
                            ? (prevItem.querySelector(taskTextSel) as HTMLElement | null)
                            : null;
                        const nextText =
                          !prevText && nextItem?.matches(taskItemSel) === true
                            ? (nextItem.querySelector(taskTextSel) as HTMLElement | null)
                            : null;
                        if (prevText) placeCaretAtEnd(prevText);
                        else if (nextText) placeCaretAtStart(nextText);
                        else {
                          const p = document.createElement("p");
                          p.appendChild(document.createElement("br"));
                          if (following && r.contains(following)) r.insertBefore(p, following);
                          else r.appendChild(p);
                          r.focus({ preventScroll: true });
                          placeCaretAtStart(p);
                        }
                      });
                      return;
                    }
                    if (isCaretAtEndOfHost(taskText, range)) {
                      event.preventDefault();
                      const group = contiguousTaskItemsFrom(taskItem, checklistDeletion.taskItem);
                      const last = group[group.length - 1]!;
                      const p = document.createElement("p");
                      p.appendChild(document.createElement("br"));
                      last.insertAdjacentElement("afterend", p);
                      root.focus({ preventScroll: true });
                      placeCaretAtStart(p);
                      onDraftChange(readElementValue());
                      return;
                    }
                    event.preventDefault();
                    document.execCommand("insertLineBreak");
                    onDraftChange(readElementValue());
                    return;
                  }

                  if (
                    event.key === "ArrowDown" &&
                    sel.isCollapsed &&
                    isCaretAtEndOfHost(taskText, range)
                  ) {
                    const next = taskItem.nextElementSibling;
                    if (
                      next &&
                      (next.matches(taskItemSel) || next.matches("p,h1,h2,h3,blockquote,pre"))
                    ) {
                      event.preventDefault();
                      focusBlockBoundary(root, next, true, taskItemSel, taskTextSel);
                      onDraftChange(readElementValue());
                      return;
                    }
                  }

                  if (
                    event.key === "ArrowUp" &&
                    sel.isCollapsed &&
                    isCaretAtStartOfHost(taskText, range)
                  ) {
                    const prev = taskItem.previousElementSibling;
                    if (
                      prev &&
                      (prev.matches(taskItemSel) || prev.matches("p,h1,h2,h3,blockquote,pre"))
                    ) {
                      event.preventDefault();
                      focusBlockBoundary(root, prev, false, taskItemSel, taskTextSel);
                      onDraftChange(readElementValue());
                      return;
                    }
                  }
                }
              }
            }
          }

          if (
            checklistDeletion &&
            !plainText &&
            event.key === "Backspace" &&
            !event.defaultPrevented
          ) {
            const root = ref.current;
            const sel = window.getSelection();
            if (root && sel && sel.isCollapsed && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              let anchor: Node | null = range.startContainer;
              if (anchor.nodeType === Node.TEXT_NODE) anchor = anchor.parentElement;
              const anchorEl = anchor instanceof Element ? anchor : null;
              const taskTextSel = `.${checklistDeletion.taskText}`;
              const taskItemSel = `.${checklistDeletion.taskItem}`;
              const taskText = anchorEl?.closest(taskTextSel) as HTMLElement | null;
              if (
                taskText &&
                root.contains(taskText) &&
                isCaretAtStartOfHost(taskText, range) &&
                taskTextIsVisuallyEmpty(taskText)
              ) {
                const taskItem = taskText.closest(taskItemSel) as HTMLElement | null;
                if (taskItem && root.contains(taskItem)) {
                  event.preventDefault();
                  const prevItem = taskItem.previousElementSibling as HTMLElement | null;
                  const nextItem = taskItem.nextElementSibling as HTMLElement | null;
                  taskItem.remove();
                  const nextHtml = readElementValue();
                  onDraftChange(nextHtml);
                  requestAnimationFrame(() => {
                    const r = ref.current;
                    if (!r?.isConnected) return;
                    const prevText =
                      prevItem?.matches(taskItemSel) === true
                        ? (prevItem.querySelector(taskTextSel) as HTMLElement | null)
                        : null;
                    const nextText =
                      !prevText && nextItem?.matches(taskItemSel) === true
                        ? (nextItem.querySelector(taskTextSel) as HTMLElement | null)
                        : null;
                    if (prevText) placeCaretAtEnd(prevText);
                    else if (nextText) placeCaretAtStart(nextText);
                  });
                  return;
                }
              }

              const listItem = anchorEl?.closest("li") as HTMLElement | null;
              if (
                listItem &&
                root.contains(listItem) &&
                isCaretAtStartOfHost(listItem, range) &&
                listItemIsVisuallyEmpty(listItem)
              ) {
                const list = listItem.closest("ul,ol") as HTMLElement | null;
                if (list && root.contains(list)) {
                  event.preventDefault();
                  const prevLi = listItem.previousElementSibling as HTMLElement | null;
                  const nextLi = listItem.nextElementSibling as HTMLElement | null;
                  const listNext = list.nextElementSibling as HTMLElement | null;
                  listItem.remove();
                  if (!list.querySelector("li")) {
                    list.remove();
                  }
                  onDraftChange(readElementValue());
                  requestAnimationFrame(() => {
                    const r = ref.current;
                    if (!r?.isConnected) return;
                    if (prevLi && prevLi.matches("li")) {
                      r.focus({ preventScroll: true });
                      placeCaretAtEnd(prevLi);
                      return;
                    }
                    if (nextLi && nextLi.matches("li")) {
                      r.focus({ preventScroll: true });
                      placeCaretAtStart(nextLi);
                      return;
                    }
                    if (listNext && listNext.matches("p,h1,h2,h3,blockquote,pre")) {
                      r.focus({ preventScroll: true });
                      placeCaretAtStart(listNext);
                      return;
                    }
                    const p = document.createElement("p");
                    p.appendChild(document.createElement("br"));
                    if (listNext && r.contains(listNext)) r.insertBefore(p, listNext);
                    else r.appendChild(p);
                    r.focus({ preventScroll: true });
                    placeCaretAtStart(p);
                  });
                  return;
                }
              }

              const block = anchorEl?.closest("p,h1,h2,h3,blockquote,pre") as HTMLElement | null;
              if (
                block &&
                root.contains(block) &&
                isCaretAtStartOfHost(block, range) &&
                blockTextIsVisuallyEmpty(block)
              ) {
                event.preventDefault();
                const taskTextSel = `.${checklistDeletion.taskText}`;
                const taskItemSel = `.${checklistDeletion.taskItem}`;
                const prev = block.previousElementSibling as HTMLElement | null;
                const next = block.nextElementSibling as HTMLElement | null;
                block.remove();
                onDraftChange(readElementValue());
                requestAnimationFrame(() => {
                  const r = ref.current;
                  if (!r?.isConnected) return;
                  const prevTaskText =
                    prev?.matches(taskItemSel) === true
                      ? (prev.querySelector(taskTextSel) as HTMLElement | null)
                      : null;
                  const nextTaskText =
                    !prevTaskText && next?.matches(taskItemSel) === true
                      ? (next.querySelector(taskTextSel) as HTMLElement | null)
                      : null;
                  if (prevTaskText) {
                    placeCaretAtEnd(prevTaskText);
                    return;
                  }
                  if (nextTaskText) {
                    placeCaretAtStart(nextTaskText);
                    return;
                  }
                  if (prev && prev.matches("p,h1,h2,h3,blockquote,pre")) {
                    r.focus({ preventScroll: true });
                    placeCaretAtEnd(prev);
                    return;
                  }
                  if (next && next.matches("p,h1,h2,h3,blockquote,pre")) {
                    r.focus({ preventScroll: true });
                    placeCaretAtStart(next);
                    return;
                  }
                  const p = document.createElement("p");
                  p.appendChild(document.createElement("br"));
                  r.appendChild(p);
                  r.focus({ preventScroll: true });
                  placeCaretAtStart(p);
                });
                return;
              }
            }
          }

          if (event.key === "Escape") {
            const reset = cancelEditing();
            if (ref.current) {
              if (plainText) ref.current.innerText = reset;
              else {
                ref.current.innerHTML = sanitizeRichHtmlForEditor(reset);
                syncCharSkDisplayNameStack(ref.current);
                syncLoreV9RedactedPlaceholderState(ref.current);
              }
              ref.current.blur();
            }
            onEscape?.();
          }
          if (event.key === "Enter" && plainText) {
            event.preventDefault();
            commitNow("enter");
            ref.current?.blur();
            onEnter?.();
          }
        }}
        {...(dataAttribute ? { [dataAttribute]: "true" } : {})}
      />
      <SlashCommandAssistPopover
        open={slashOpen && slashCandidates.length > 0}
        anchorRect={slashAnchor}
        candidates={slashCandidates}
        activeIndex={slashIndex}
        onPick={applySlashPick}
        onClose={closeSlash}
      />
    </>
  );
}
