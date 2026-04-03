"use client";

import { CheckCircle } from "@phosphor-icons/react";

import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";

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
  return (
    <ArchitecturalButton
      size="pill"
      tone={variant === "dark" ? "focus-dark" : "focus-light"}
      forceState={forceState}
      disabled={disabled}
      onClick={onClick}
      leadingIcon={showIcon ? <CheckCircle size={16} /> : undefined}
    >
      {label}
    </ArchitecturalButton>
  );
}
