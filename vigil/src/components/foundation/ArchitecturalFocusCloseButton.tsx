"use client";

import { CheckCircle } from "@phosphor-icons/react";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

export function ArchitecturalFocusCloseButton({
  label = "Done",
  variant = "light",
  disabled = false,
  showIcon = true,
  forceState = "default",
  onClick,
}: {
  label?: string;
  variant?: "light" | "dark";
  disabled?: boolean;
  showIcon?: boolean;
  forceState?: "default" | "hover" | "active";
  onClick?: () => void;
}) {
  const stateClass =
    forceState === "hover"
      ? styles.focusCloseStateHover
      : forceState === "active"
        ? styles.focusCloseStateActive
        : "";

  return (
    <button
      type="button"
      className={`${styles.focusClose} ${
        variant === "dark" ? styles.focusCloseDark : styles.focusCloseLight
      } ${stateClass}`.trim()}
      disabled={disabled}
      onClick={onClick}
    >
      {showIcon ? <CheckCircle size={16} /> : null}
      {label}
    </button>
  );
}
