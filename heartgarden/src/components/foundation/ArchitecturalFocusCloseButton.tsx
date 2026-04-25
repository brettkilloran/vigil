"use client";

import { CheckCircle, FloppyDisk, XCircle } from "@phosphor-icons/react";

import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";
import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

export function ArchitecturalFocusCloseButton({
  dirty,
  onDone,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  onDone: () => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  if (dirty) {
    return (
      <div className={styles.focusHeaderActions}>
        <ArchitecturalButton
          leadingIcon={<XCircle size={16} />}
          onClick={onDiscard}
          size="pill"
          tone="focus-discard"
          type="button"
        >
          Discard
        </ArchitecturalButton>
        <ArchitecturalButton
          leadingIcon={<FloppyDisk size={16} />}
          onClick={onSave}
          size="pill"
          tone="focus-done"
          type="button"
        >
          Save
        </ArchitecturalButton>
      </div>
    );
  }

  return (
    <ArchitecturalButton
      leadingIcon={<CheckCircle size={16} />}
      onClick={onDone}
      size="pill"
      tone="focus-done"
      type="button"
    >
      Done
    </ArchitecturalButton>
  );
}
