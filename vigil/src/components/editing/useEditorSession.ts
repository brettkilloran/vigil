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
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const draft = isEditing ? editDraft : value;

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
    latestValueRef.current = value;
    if (!isEditing) {
      latestDraftRef.current = value;
    }
  }, [value, isEditing]);

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
        latestDraftRef.current = normalized;
        if (isEditing) {
          setEditDraft(normalized);
        }
      }
      return normalized;
    },
    [normalizeDraft, isEditing],
  );

  const commitNow = useCallback(
    (reason: EditorCommitReason = "manual") => {
      clearPendingCommit();
      const out = commitDraft(latestDraftRef.current, reason);
      setIsEditing(false);
      return out;
    },
    [clearPendingCommit, commitDraft],
  );

  const onDraftChange = useCallback(
    (next: string) => {
      setEditDraft(next);
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
    const v = latestValueRef.current;
    setEditDraft(v);
    latestDraftRef.current = v;
    setIsEditing(true);
  }, []);

  const cancelEditing = useCallback(() => {
    clearPendingCommit();
    setIsEditing(false);
    const resetValue = latestValueRef.current;
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
