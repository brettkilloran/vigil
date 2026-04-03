"use client";

import { useEffect, useRef } from "react";

import {
  type EditorCommitReason,
  useEditorSession,
} from "@/src/components/editing/useEditorSession";

type BufferedContentEditableProps = {
  value: string;
  editable?: boolean;
  spellCheck?: boolean;
  className?: string;
  debounceMs?: number;
  plainText?: boolean;
  normalizeOnCommit?: (value: string) => string;
  onCommit: (value: string, reason: EditorCommitReason) => void;
  onEscape?: () => void;
  onEnter?: () => void;
  dataAttribute?: string;
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
  onEscape,
  onEnter,
  dataAttribute,
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
  });

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

  const readElementValue = () => {
    const el = ref.current;
    if (!el) return "";
    return plainText ? el.innerText : el.innerHTML;
  };

  return (
    <div
      ref={ref}
      className={className}
      contentEditable={editable}
      suppressContentEditableWarning
      spellCheck={spellCheck}
      onFocus={() => beginEditing()}
      onBlur={() => commitNow("blur")}
      onInput={() => onDraftChange(readElementValue())}
      onKeyDown={(event) => {
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
  );
}
