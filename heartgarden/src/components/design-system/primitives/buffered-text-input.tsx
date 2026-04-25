"use client";

import type { InputHTMLAttributes } from "react";

import {
  type EditorCommitReason,
  useEditorSession,
} from "@/src/components/editing/use-editor-session";

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
  const { draft, beginEditing, commitNow, cancelEditing, onDraftChange } =
    useEditorSession({
      debounceMs,
      normalizeOnCommit,
      onCommit,
      value,
    });

  return (
    <input
      {...inputProps}
      onBlur={(event) => {
        commitNow("blur");
        onBlur?.(event);
      }}
      onChange={(event) => onDraftChange(event.target.value)}
      onFocus={(event) => {
        beginEditing();
        onFocus?.(event);
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
      value={draft}
    />
  );
}
