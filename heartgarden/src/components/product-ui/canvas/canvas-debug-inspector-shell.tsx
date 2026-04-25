"use client";

import { Bug, X } from "@phosphor-icons/react";
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { ArchitecturalTooltip } from "@/src/components/foundation/architectural-tooltip";
import { Button } from "@/src/components/ui/button";

import styles from "./CanvasDebugInspectorShell.module.css";

function readStoredOpen(key: string): boolean | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const v = sessionStorage.getItem(key);
    if (v === "1") {
      return true;
    }
    if (v === "0") {
      return false;
    }
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
  const [open, setOpen] = useState(
    () => readStoredOpen(storageKey) ?? defaultOpen
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open, storageKey]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <section
      aria-label={title}
      className={styles.anchor}
      data-hg-chrome="debug-inspector"
    >
      {open ? (
        <div className={styles.expandedPanel} id={`${storageKey}-panel`}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>{title}</span>
            <ArchitecturalTooltip
              content="Close link inspector"
              delayMs={280}
              side="bottom"
            >
              <Button
                aria-label="Close link inspector"
                iconOnly
                onClick={toggle}
                size="icon"
                tone="glass"
                type="button"
                variant="default"
              >
                <X aria-hidden size={18} weight="bold" />
              </Button>
            </ArchitecturalTooltip>
          </div>
          <div className={styles.panelBody}>{children}</div>
        </div>
      ) : (
        <div className={styles.collapsedPanel}>
          <ArchitecturalTooltip
            content="Open debug link inspector"
            delayMs={280}
            side="right"
          >
            <Button
              aria-controls={`${storageKey}-panel`}
              aria-expanded={false}
              aria-label="Open debug link inspector"
              iconOnly
              onClick={() => setOpen(true)}
              size="icon"
              tone="glass"
              type="button"
              variant="default"
            >
              <Bug aria-hidden size={18} weight="bold" />
            </Button>
          </ArchitecturalTooltip>
        </div>
      )}
    </section>
  );
}
