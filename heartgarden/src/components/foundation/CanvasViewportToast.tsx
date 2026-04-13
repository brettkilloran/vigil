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
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.panel}>
        <p className={styles.text}>Some cards are outside the current view.</p>
        <div className={styles.actions}>
          <Button type="button" size="sm" variant="primary" tone="solid" onClick={onShow}>
            Show
          </Button>
          <Button
            type="button"
            variant="ghost"
            tone="glass"
            size="icon"
            iconOnly
            className={styles.dismiss}
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            ×
          </Button>
        </div>
      </div>
    </div>
  );
}
