"use client";

import { Button } from "@/src/components/ui/Button";

import styles from "./CanvasViewportToast.module.css";

export function CanvasViewportToast({
  onShow,
  onDismiss,
}: {
  onShow: () => void;
  onDismiss: () => void;
}) {
  return (
    <div aria-live="polite" className={styles.wrap} role="status">
      <div className={styles.panel}>
        <p className={styles.text}>Some cards are outside the current view.</p>
        <div className={styles.actions}>
          <Button
            onClick={onShow}
            size="sm"
            tone="solid"
            type="button"
            variant="primary"
          >
            Show
          </Button>
          <Button
            aria-label="Dismiss"
            className={styles.dismiss}
            iconOnly
            onClick={onDismiss}
            size="icon"
            tone="glass"
            type="button"
            variant="ghost"
          >
            ×
          </Button>
        </div>
      </div>
    </div>
  );
}
