"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  type EditorCommitReason,
  useEditorSession,
} from "@/src/components/editing/useEditorSession";
import {
  WikiLinkAssistPopover,
  type WikiCandidate,
} from "@/src/components/editing/WikiLinkAssistPopover";
import {
  findOpenWikiTrigger,
  insertHtmlReplacingRange,
  plainTextToCaret,
  rangeForPlainTextOffsets,
} from "@/src/lib/wiki-link-caret";

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
}: BufferedContentEditableProps) {
  const ref = useRef<HTMLDivElement | null>(null);
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
  }, [closeWiki, plainText, wikiLinkAssist]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = plainText ? el.innerText : el.innerHTML;
    if (current === draft) return;
    if (document.activeElement === el) return;
    if (plainText) {
      el.innerText = draft;
    } else {
      el.innerHTML = draft;
    }
  }, [draft, plainText]);

  const readElementValue = useCallback(() => {
    const el = ref.current;
    if (!el) return "";
    return plainText ? el.innerText : el.innerHTML;
  }, [plainText]);

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

  return (
    <>
      <div
        ref={ref}
        className={className}
        contentEditable={editable}
        suppressContentEditableWarning
        spellCheck={spellCheck}
        onFocus={() => beginEditing()}
        onBlur={() => {
          closeWiki();
          commitNow("blur");
        }}
        onInput={() => {
          const next = readElementValue();
          onDraftChange(next);
          requestAnimationFrame(() => refreshWikiAssist());
        }}
        onPointerDownCapture={(event) => {
          if (!checklistDeletion || plainText || !editable || event.button !== 0) return;
          const root = ref.current;
          if (!root || !root.contains(event.target as Node)) return;
          const t = event.target as HTMLElement;
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
              else ref.current.innerHTML = reset;
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
