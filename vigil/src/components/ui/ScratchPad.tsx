"use client";

import { useState } from "react";

export function ScratchPad({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[900] w-[min(100vw-2rem,380px)] rounded-xl border border-[var(--vigil-border)] bg-[var(--vigil-btn-bg)] p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-[var(--vigil-label)]">
        <span>Scratch pad</span>
        <button
          type="button"
          className="text-[var(--vigil-muted)] hover:text-[var(--foreground)]"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <textarea
        className="mb-2 h-28 w-full resize-none rounded-lg border border-[var(--vigil-border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)] outline-none"
        placeholder="Quick note…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className="w-full rounded-lg bg-[var(--foreground)] py-2 text-sm text-[var(--background)] dark:bg-neutral-200 dark:text-neutral-900"
        onClick={() => {
          const t = text.trim();
          if (!t) return;
          onSubmit(t);
          setText("");
          onClose();
        }}
      >
        Drop as note
      </button>
    </div>
  );
}
