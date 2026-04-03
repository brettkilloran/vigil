"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, NotebookPen, X } from "lucide-react";
import { useState } from "react";

import {
  VIGIL_GLASS_PANEL,
  VIGIL_ICON_GHOST_BTN,
} from "@/src/lib/vigil-ui-classes";

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

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="scratch-pad"
          role="dialog"
          aria-label="Scratch pad"
          initial={{ x: 28, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 28, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className={`fixed bottom-4 right-4 z-[900] w-[min(100vw-2rem,380px)] p-3.5 shadow-xl ${VIGIL_GLASS_PANEL}`}
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight text-[var(--vigil-label)]">
              <NotebookPen
                className="size-4 shrink-0 text-[var(--vigil-muted)] opacity-90"
                aria-hidden
              />
              <span className="truncate">Scratch pad</span>
            </div>
            <button
              type="button"
              className={VIGIL_ICON_GHOST_BTN}
              aria-label="Close scratch pad"
              onClick={onClose}
            >
              <X className="size-4" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
          <textarea
            className="mb-2.5 h-28 w-full resize-none rounded-lg border border-[var(--vigil-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--vigil-snap)]/35"
            placeholder="Quick note…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--foreground)] py-2.5 text-sm font-medium text-[var(--background)] transition-opacity disabled:opacity-40 dark:bg-neutral-200 dark:text-neutral-900"
            disabled={!text.trim()}
            onClick={() => {
              const t = text.trim();
              if (!t) return;
              onSubmit(t);
              setText("");
              onClose();
            }}
          >
            <CornerDownLeft className="size-4 shrink-0 opacity-90" aria-hidden />
            Drop as note
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
