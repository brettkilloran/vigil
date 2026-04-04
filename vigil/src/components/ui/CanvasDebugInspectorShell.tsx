"use client";

import { CaretUp, LinkSimple } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/src/components/ui/Button";

import styles from "./CanvasDebugInspectorShell.module.css";

function readStoredOpen(key: string): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* private mode */
  }
  return null;
}

/**
 * Collapsible chrome aligned with the canvas right tool rail — debug / inspector surfaces only.
 */
export function CanvasDebugInspectorShell({
  storageKey,
  title,
  defaultOpen = false,
  children,
}: {
  storageKey: string;
  /** e.g. `DEBUG // LINKS` */
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => readStoredOpen(storageKey) ?? defaultOpen);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open, storageKey]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div className={styles.anchor} role="region" aria-label={title}>
      {!open ? (
        <div className={styles.collapsedPanel}>
          <Button
            type="button"
            size="icon"
            variant="neutral"
            tone="glass"
            iconOnly
            title="Open link inspector (debug)"
            aria-label="Open link inspector (debug)"
            aria-expanded={false}
            aria-controls={`${storageKey}-panel`}
            onClick={() => setOpen(true)}
          >
            <LinkSimple size={18} weight="bold" aria-hidden />
          </Button>
        </div>
      ) : (
        <div id={`${storageKey}-panel`} className={styles.expandedPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>{title}</span>
            <Button
              type="button"
              size="icon"
              variant="neutral"
              tone="glass"
              iconOnly
              title="Collapse link inspector"
              aria-label="Collapse link inspector"
              onClick={toggle}
            >
              <CaretUp size={16} weight="bold" aria-hidden />
            </Button>
          </div>
          <div className={styles.panelBody}>{children}</div>
        </div>
      )}
    </div>
  );
}
