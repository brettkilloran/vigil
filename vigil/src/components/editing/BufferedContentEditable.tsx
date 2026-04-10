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
  WikiLinkAssistPopover,
  type WikiCandidate,
} from "@/src/components/editing/WikiLinkAssistPopover";
import {
  DEFAULT_SLASH_COMMAND_ITEMS,
  filterSlashCommands,
  type SlashCommandItem,
} from "@/src/lib/default-slash-commands";
import { findOpenSlashTrigger } from "@/src/lib/slash-command-caret";
import {
  findOpenWikiTrigger,
  insertHtmlReplacingRange,
  plainTextToCaret,
  rangeForPlainTextOffsets,
} from "@/src/lib/wiki-link-caret";

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

const ARCH_BLOCK_DRAG_ATTR = "data-arch-drag-handle";

function stripArchDragHandles(html: string): string {
  if (typeof document === "undefined" || !html.includes(ARCH_BLOCK_DRAG_ATTR)) return html;
  const doc = new DOMParser().parseFromString(`<div id="__arch_strip">${html}</div>`, "text/html");
  const wrap = doc.getElementById("__arch_strip");
  if (!wrap) return html;
  wrap.querySelectorAll(`[${ARCH_BLOCK_DRAG_ATTR}]`).forEach((el) => el.remove());
  return wrap.innerHTML;
}

function ensureDocumentBlockDragHandles(
  root: HTMLElement,
  cfg: { handleClass: string; taskItemClass: string },
) {
  /* Avoid `hr` / generic `ul|ol` — void or `li`-only content models cannot host a handle as first child. */
  const blockish =
    "p,h1,h2,h3,blockquote,pre,div[data-arch-checklist='true'],ul[data-arch-checklist='true']";
  for (const child of [...root.children]) {
    const isTask = child instanceof HTMLElement && child.classList.contains(cfg.taskItemClass);
    const isBlock =
      isTask || (child instanceof HTMLElement && child.matches(blockish));
    if (!isBlock) continue;
    if (child.querySelector(`:scope > [${ARCH_BLOCK_DRAG_ATTR}]`)) continue;
    const h = document.createElement("span");
    h.className = cfg.handleClass;
    h.setAttribute(ARCH_BLOCK_DRAG_ATTR, "true");
    h.setAttribute("contenteditable", "false");
    h.setAttribute("draggable", "true");
    h.setAttribute("role", "button");
    h.setAttribute("aria-label", "Drag to reorder");
    child.insertBefore(h, child.firstChild);
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

/** Horizontal split between “insert before this block” vs “after” — biased so gaps feel less twitchy. */
function archBlockDropInsertBeforeY(rect: DOMRect): number {
  const biasPx = Math.min(18, Math.max(8, rect.height * 0.14));
  return rect.top + rect.height * 0.5 + biasPx;
}

function findArchBlockDropInsertBefore(
  root: HTMLElement,
  clientY: number,
  dragging: Element | null,
): Element | null {
  const kids = [...root.children].filter((c) => c !== dragging);
  for (const c of kids) {
    const r = c.getBoundingClientRect();
    if (clientY < archBlockDropInsertBeforeY(r)) return c;
  }
  return null;
}

function dropIndicatorTopRelative(
  wrap: HTMLElement,
  root: HTMLElement,
  clientY: number,
  dragging: Element | null,
): number {
  const wr = wrap.getBoundingClientRect();
  const insertBefore = findArchBlockDropInsertBefore(root, clientY, dragging);
  if (insertBefore) {
    const r = insertBefore.getBoundingClientRect();
    return r.top - wr.top - 3;
  }
  const kids = [...root.children].filter((c) => c !== dragging);
  const last = kids[kids.length - 1];
  if (last) {
    const r = last.getBoundingClientRect();
    return r.bottom - wr.top + 3;
  }
  return 12;
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

/** Enables Paper-style drag handles on top-level blocks (stripped before commit). */
export type DocumentBlockDragConfig = {
  handleClass: string;
  taskItemClass: string;
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
  /** Drag handles on direct block children + reorder via native DnD. */
  documentBlockDrag?: DocumentBlockDragConfig | null;
  /** `/` slash menu — same commands as the format dock (`runFormat` in shell). */
  richDocCommand?: (command: string, value?: string) => void;
  slashCommandItems?: SlashCommandItem[] | null;
  /** Shown when the document body is empty (Paper-style hint). */
  emptyPlaceholder?: string | null;
};

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
  wikiLinkAssist,
  checklistDeletion,
  documentBlockDrag,
  richDocCommand,
  slashCommandItems = null,
  emptyPlaceholder = null,
}: BufferedContentEditableProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const draggedArchBlockRef = useRef<Element | null>(null);
  const pastePlainNextRef = useRef(false);
  const composingRef = useRef(false);
  const slashPlainRangeRef = useRef<{ start: number; end: number } | null>(null);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashAnchor, setSlashAnchor] = useState<DOMRect | null>(null);
  const [slashCandidates, setSlashCandidates] = useState<SlashCommandItem[]>([]);
  const [slashIndex, setSlashIndex] = useState(0);
  const [dropLineY, setDropLineY] = useState<number | null>(null);

  const resolvedSlashItems = slashCommandItems ?? DEFAULT_SLASH_COMMAND_ITEMS;

  const mergedNormalizeOnCommit = useCallback(
    (html: string) => {
      /* Strip ephemeral drag handles on every commit — canvas no longer injects them, focus/gallery do. */
      const stripped = stripArchDragHandles(html);
      return normalizeOnCommit ? normalizeOnCommit(stripped) : stripped;
    },
    [normalizeOnCommit],
  );

  const {
    draft,
    beginEditing,
    commitNow,
    cancelEditing,
    onDraftChange,
  } = useEditorSession({
    value,
    debounceMs,
    normalizeOnCommit: mergedNormalizeOnCommit,
    onCommit,
    onDraftDirtyChange,
  });

  const [wikiOpen, setWikiOpen] = useState(false);
  const [wikiAnchor, setWikiAnchor] = useState<DOMRect | null>(null);
  const [wikiCandidates, setWikiCandidates] = useState<WikiCandidate[]>([]);
  const [wikiIndex, setWikiIndex] = useState(0);
  const wikiPlainRangeRef = useRef<{ start: number; end: number } | null>(null);
  const remoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteAbortRef = useRef<AbortController | null>(null);

  const closeWiki = useCallback(() => {
    setWikiOpen(false);
    setWikiAnchor(null);
    setWikiCandidates([]);
    setWikiIndex(0);
    wikiPlainRangeRef.current = null;
    if (remoteTimerRef.current) {
      clearTimeout(remoteTimerRef.current);
      remoteTimerRef.current = null;
    }
    remoteAbortRef.current?.abort();
    remoteAbortRef.current = null;
  }, []);

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
      closeSlash();
      return;
    }
    const plain = plainTextToCaret(el);
    if (findOpenWikiTrigger(plain)) {
      closeSlash();
      return;
    }
    const slash = findOpenSlashTrigger(plain);
    if (!slash) {
      closeSlash();
      return;
    }
    const caretPlain = plain.length;
    slashPlainRangeRef.current = { start: slash.startPlainOffset, end: caretPlain };
    const filtered = filterSlashCommands(resolvedSlashItems, slash.query);
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
  }, [closeSlash, plainText, resolvedSlashItems, richDocCommand]);

  const refreshWikiAssist = useCallback(() => {
    const cfg = wikiLinkAssist;
    const el = ref.current;
    if (!cfg?.enabled || plainText || !el) {
      closeWiki();
      return;
    }

    const plain = plainTextToCaret(el);
    const trig = findOpenWikiTrigger(plain);
    if (!trig) {
      closeWiki();
      return;
    }
    closeSlash();

    const caretPlain = plain.length;
    wikiPlainRangeRef.current = { start: trig.startPlainOffset, end: caretPlain };

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.width >= 0 && r.height >= 0) {
        setWikiAnchor(r);
      }
    }

    const q = trig.query.trim().toLowerCase();
    const local = cfg
      .getLocalItems()
      .filter((it) => it.id !== cfg.excludeEntityId)
      .filter((it) => {
        if (!q) return true;
        return it.title.toLowerCase().includes(q) || it.id.toLowerCase().includes(q);
      })
      .slice(0, 12);

    setWikiCandidates(local);
    setWikiIndex(0);
    setWikiOpen(local.length > 0 || !!cfg.fetchRemoteSuggest);

    if (cfg.fetchRemoteSuggest && trig.query.length >= 2) {
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
      remoteAbortRef.current?.abort();
      const ac = new AbortController();
      remoteAbortRef.current = ac;
      remoteTimerRef.current = setTimeout(() => {
        void (async () => {
          try {
            const remote = await cfg.fetchRemoteSuggest!(trig.query, ac.signal);
            if (ac.signal.aborted) return;
            const merged = new Map<string, WikiCandidate>();
            local.forEach((c) => merged.set(c.id, c));
            remote
              .filter((c) => c.id !== cfg.excludeEntityId)
              .forEach((c) => merged.set(c.id, c));
            const list = [...merged.values()].slice(0, 16);
            setWikiCandidates(list);
            setWikiIndex((i) => Math.min(i, Math.max(0, list.length - 1)));
            setWikiOpen(list.length > 0);
          } catch {
            /* aborted or network */
          }
        })();
      }, 220);
    }
  }, [closeSlash, closeWiki, plainText, wikiLinkAssist]);

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
      el.innerHTML = draft;
      applySpellcheckToNestedEditables(el, spellCheck);
      if (documentBlockDrag) ensureDocumentBlockDragHandles(el, documentBlockDrag);
      syncCharSkDisplayNameStack(el);
      syncLoreV9RedactedPlaceholderState(el);
    }
  }, [draft, plainText, documentBlockDrag, spellCheck]);

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

  useEffect(() => {
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
    return plainText ? el.innerText : el.innerHTML;
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

  const applyWikiPick = useCallback(
    (c: WikiCandidate) => {
      const el = ref.current;
      const rangePlain = wikiPlainRangeRef.current;
      if (!el || !rangePlain) {
        closeWiki();
        return;
      }
      const r = rangeForPlainTextOffsets(el, rangePlain.start, rangePlain.end);
      if (!r) {
        closeWiki();
        return;
      }
      const title = (c.title || "Untitled").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = `<a href="vigil:item:${c.id}">${title}</a>`;
      insertHtmlReplacingRange(r, html);
      closeWiki();
      onDraftChange(readElementValue());
    },
    [closeWiki, onDraftChange, readElementValue],
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
        refreshWikiAssist();
        refreshSlashAssist();
      });
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [refreshSlashAssist, refreshWikiAssist]);

  return (
    <>
      <div
        ref={wrapRef}
        className={hostStyles.richEditorHost}
        data-hg-rich-editor-host="true"
        onDragOver={(event) => {
          if (!documentBlockDrag || plainText || !editable || !draggedArchBlockRef.current) {
            setDropLineY(null);
            return;
          }
          const root = ref.current;
          const wrap = wrapRef.current;
          if (!root || !wrap) return;
          /* Host / margins / chrome: must still preventDefault or the cursor flips to “not allowed”. */
          if (!wrap.contains(event.target as Node)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDropLineY(
            dropIndicatorTopRelative(wrap, root, event.clientY, draggedArchBlockRef.current),
          );
        }}
        onDragLeave={(event) => {
          if (!documentBlockDrag || plainText) return;
          const wrap = wrapRef.current;
          const rel = event.relatedTarget as Node | null;
          if (wrap && rel && !wrap.contains(rel)) {
            setDropLineY(null);
          }
        }}
        onDrop={(event) => {
          setDropLineY(null);
          if (!documentBlockDrag || plainText || !editable) return;
          const root = ref.current;
          const wrap = wrapRef.current;
          if (!wrap?.contains(event.target as Node)) return;
          const dragEl = draggedArchBlockRef.current;
          if (!root || !dragEl || !root.contains(dragEl)) {
            draggedArchBlockRef.current = null;
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          const insertBefore = findArchBlockDropInsertBefore(root, event.clientY, dragEl);
          if (insertBefore) root.insertBefore(dragEl, insertBefore);
          else root.appendChild(dragEl);
          draggedArchBlockRef.current = null;
          ensureDocumentBlockDragHandles(root, documentBlockDrag);
          onDraftChange(readElementValue());
        }}
      >
        {dropLineY !== null ? (
          <div className={hostStyles.dropIndicator} style={{ top: dropLineY }} aria-hidden />
        ) : null}
        <div
        ref={ref}
        className={`${hostStyles.richEditorHostInner} ${className ?? ""}`.trim()}
        data-hg-rich-editor-inner="true"
        contentEditable={editable}
        suppressContentEditableWarning
        spellCheck={spellCheck}
        data-arch-doc-empty={docEmpty ? "true" : undefined}
        data-placeholder={docEmpty ? emptyPlaceholder ?? undefined : undefined}
        onFocus={() => {
          beginEditing();
          if (documentBlockDrag && ref.current && !plainText) {
            ensureDocumentBlockDragHandles(ref.current, documentBlockDrag);
          }
        }}
        onBlur={() => {
          closeWiki();
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
            refreshWikiAssist();
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
            if (documentBlockDrag && ref.current && !plainText) {
              ensureDocumentBlockDragHandles(ref.current, documentBlockDrag);
            }
            refreshWikiAssist();
            refreshSlashAssist();
          });
        }}
        onInput={() => {
          const next = readElementValue();
          onDraftChange(next);
          syncLoreV9RedactedPlaceholderState(ref.current);
          requestAnimationFrame(() => {
            if (documentBlockDrag && ref.current && !plainText) {
              ensureDocumentBlockDragHandles(ref.current, documentBlockDrag);
            }
            refreshWikiAssist();
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
              refreshWikiAssist();
              refreshSlashAssist();
            });
          }
        }}
        onDragStartCapture={(event) => {
          if (!documentBlockDrag || plainText || !editable) return;
          const t = event.target as HTMLElement | null;
          if (!t) return;
          const handle = t.closest(`[${ARCH_BLOCK_DRAG_ATTR}]`) as HTMLElement | null;
          if (!handle) return;
          const block = handle.parentElement;
          const root = ref.current;
          if (!block || !root || block.parentElement !== root) return;
          event.stopPropagation();
          draggedArchBlockRef.current = block;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", "heartgarden-arch-block");
        }}
        onDragEndCapture={() => {
          draggedArchBlockRef.current = null;
          setDropLineY(null);
        }}
        onPointerDownCapture={(event) => {
          if (!checklistDeletion || plainText || !editable || event.button !== 0) return;
          const root = ref.current;
          if (!root || !root.contains(event.target as Node)) return;
          const t = event.target as HTMLElement;
          if (t.closest(`[${ARCH_BLOCK_DRAG_ATTR}]`)) return;
          const taskItemSel = `.${checklistDeletion.taskItem}`;
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

          if (wikiOpen && wikiCandidates.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setWikiIndex((i) => (i + 1 >= wikiCandidates.length ? 0 : i + 1));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setWikiIndex((i) => (i - 1 < 0 ? wikiCandidates.length - 1 : i - 1));
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              const pick = wikiCandidates[wikiIndex];
              if (pick) applyWikiPick(pick);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              closeWiki();
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
                          if (documentBlockDrag) ensureDocumentBlockDragHandles(r, documentBlockDrag);
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
                      if (documentBlockDrag) ensureDocumentBlockDragHandles(root, documentBlockDrag);
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
            }
          }

          if (event.key === "Escape") {
            const reset = cancelEditing();
            if (ref.current) {
              if (plainText) ref.current.innerText = reset;
              else {
                ref.current.innerHTML = reset;
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
      </div>
      <SlashCommandAssistPopover
        open={slashOpen && slashCandidates.length > 0}
        anchorRect={slashAnchor}
        candidates={slashCandidates}
        activeIndex={slashIndex}
        onPick={applySlashPick}
        onClose={closeSlash}
      />
      <WikiLinkAssistPopover
        open={wikiOpen && wikiCandidates.length > 0}
        anchorRect={wikiAnchor}
        candidates={wikiCandidates}
        activeIndex={wikiIndex}
        onPick={applyWikiPick}
        onClose={closeWiki}
      />
    </>
  );
}
