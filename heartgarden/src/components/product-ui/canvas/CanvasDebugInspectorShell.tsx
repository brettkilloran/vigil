"use client";

import { Bug, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
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
 * Collapsible chrome on the canvas mid-left — debug / inspector surfaces only. Panel extends
 * rightward so it stays on-screen (mirrors the old right-rail layout that grew left).
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
    <div
      className={styles.anchor}
      role="region"
      aria-label={title}
      data-hg-chrome="debug-inspector"
    >
      {!open ? (
        <div className={styles.collapsedPanel}>
          <ArchitecturalTooltip content="Open debug link inspector" side="right" delayMs={280}>
            <Button
              type="button"
              size="icon"
              variant="neutral"
              tone="glass"
              iconOnly
              aria-label="Open debug link inspector"
              aria-expanded={false}
              aria-controls={`${storageKey}-panel`}
              onClick={() => setOpen(true)}
            >
              <Bug size={18} weight="bold" aria-hidden />
            </Button>
          </ArchitecturalTooltip>
        </div>
      ) : (
        <div id={`${storageKey}-panel`} className={styles.expandedPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>{title}</span>
            <ArchitecturalTooltip content="Close link inspector" side="bottom" delayMs={280}>
              <Button
                type="button"
                size="icon"
                variant="neutral"
                tone="glass"
                iconOnly
                aria-label="Close link inspector"
                onClick={toggle}
              >
                <X size={18} weight="bold" aria-hidden />
              </Button>
            </ArchitecturalTooltip>
          </div>
          <div className={styles.panelBody}>{children}</div>
        </div>
      )}
    </div>
  );
}
