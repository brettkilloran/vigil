"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type EditorCommitReason = "debounce" | "blur" | "enter" | "manual";

type UseEditorSessionOptions = {
  value: string;
  debounceMs?: number;
  normalizeOnCommit?: (value: string) => string;
  onCommit: (value: string, reason: EditorCommitReason) => void;
};

type UseEditorSessionResult = {
  draft: string;
  isEditing: boolean;
  onDraftChange: (next: string) => void;
  beginEditing: () => void;
  commitNow: (reason?: EditorCommitReason) => string;
  cancelEditing: () => string;
};

export function useEditorSession({
  value,
  debounceMs = 350,
  normalizeOnCommit,
  onCommit,
}: UseEditorSessionOptions): UseEditorSessionResult {
  const [draft, setDraft] = useState(value);
  const [isEditing, setIsEditing] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(value);
  const latestDraftRef = useRef(value);
  const latestOnCommitRef = useRef(onCommit);
  const latestNormalizeRef = useRef(normalizeOnCommit);

  useEffect(() => {
    latestOnCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    latestNormalizeRef.current = normalizeOnCommit;
  }, [normalizeOnCommit]);

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    latestValueRef.current = value;
    if (!isEditing) {
      setDraft(value);
      latestDraftRef.current = value;
    }
  }, [isEditing, value]);

  const clearPendingCommit = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const normalizeDraft = useCallback((next: string) => {
    return latestNormalizeRef.current ? latestNormalizeRef.current(next) : next;
  }, []);

  const commitDraft = useCallback(
    (nextDraft: string, reason: EditorCommitReason) => {
      const normalized = normalizeDraft(nextDraft);
      if (normalized !== latestValueRef.current) {
        latestOnCommitRef.current(normalized, reason);
      }
      if (normalized !== latestDraftRef.current) {
        setDraft(normalized);
        latestDraftRef.current = normalized;
      }
      return normalized;
    },
    [normalizeDraft],
  );

  const commitNow = useCallback(
    (reason: EditorCommitReason = "manual") => {
      clearPendingCommit();
      setIsEditing(false);
      return commitDraft(latestDraftRef.current, reason);
    },
    [clearPendingCommit, commitDraft],
  );

  const onDraftChange = useCallback(
    (next: string) => {
      setDraft(next);
      latestDraftRef.current = next;
      clearPendingCommit();
      if (debounceMs <= 0) {
        commitDraft(next, "debounce");
        return;
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        commitDraft(latestDraftRef.current, "debounce");
      }, debounceMs);
    },
    [clearPendingCommit, commitDraft, debounceMs],
  );

  const beginEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  const cancelEditing = useCallback(() => {
    clearPendingCommit();
    setIsEditing(false);
    const resetValue = latestValueRef.current;
    setDraft(resetValue);
    latestDraftRef.current = resetValue;
    return resetValue;
  }, [clearPendingCommit]);

  useEffect(() => {
    return () => {
      clearPendingCommit();
    };
  }, [clearPendingCommit]);

  return {
    draft,
    isEditing,
    onDraftChange,
    beginEditing,
    commitNow,
    cancelEditing,
  };
}
