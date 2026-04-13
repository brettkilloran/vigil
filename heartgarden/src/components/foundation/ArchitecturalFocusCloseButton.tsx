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
          size="pill"
          tone="focus-discard"
          type="button"
          leadingIcon={<XCircle size={16} />}
          onClick={onDiscard}
        >
          Discard
        </ArchitecturalButton>
        <ArchitecturalButton
          size="pill"
          tone="focus-done"
          type="button"
          leadingIcon={<FloppyDisk size={16} />}
          onClick={onSave}
        >
          Save
        </ArchitecturalButton>
      </div>
    );
  }

  return (
    <ArchitecturalButton
      size="pill"
      tone="focus-done"
      type="button"
      leadingIcon={<CheckCircle size={16} />}
      onClick={onDone}
    >
      Done
    </ArchitecturalButton>
  );
}
