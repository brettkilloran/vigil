"use client";

import type { InputHTMLAttributes } from "react";

import {
  type EditorCommitReason,
  useEditorSession,
} from "@/src/components/editing/useEditorSession";

type BufferedTextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value: string;
  debounceMs?: number;
  normalizeOnCommit?: (value: string) => string;
  onCommit: (value: string, reason: EditorCommitReason) => void;
};

export function BufferedTextInput({
  value,
  debounceMs,
  normalizeOnCommit,
  onCommit,
  onBlur,
  onFocus,
  onKeyDown,
  ...inputProps
}: BufferedTextInputProps) {
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
  });

  return (
    <input
      {...inputProps}
      value={draft}
      onFocus={(event) => {
        beginEditing();
        onFocus?.(event);
      }}
      onChange={(event) => onDraftChange(event.target.value)}
      onBlur={(event) => {
        commitNow("blur");
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          cancelEditing();
          (event.currentTarget as HTMLInputElement).blur();
          return;
        }
        if (event.key === "Enter") {
          commitNow("enter");
          (event.currentTarget as HTMLInputElement).blur();
          return;
        }
        onKeyDown?.(event);
      }}
    />
  );
}
