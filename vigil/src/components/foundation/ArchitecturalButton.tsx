"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Button } from "@/src/components/ui/Button";
import type { ButtonSize as UiButtonSize } from "@/src/components/ui/Button";

type ButtonSize = "icon" | "menu" | "pill";
type ButtonTone = "glass" | "menu" | "focus-light" | "focus-dark";
type ButtonState = "default" | "hover" | "active";

function toUiButtonSize(size: ButtonSize): UiButtonSize {
  if (size === "menu") return "sm";
  return size;
}

export function ArchitecturalButton({
  size,
  tone,
  active = false,
  forceState = "default",
  leadingIcon,
  className,
  children,
  ...buttonProps
}: {
  size: ButtonSize;
  tone: ButtonTone;
  active?: boolean;
  forceState?: ButtonState;
  leadingIcon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      size={toUiButtonSize(size)}
      tone={tone}
      variant="neutral"
      isActive={active}
      forceState={forceState}
      leadingIcon={leadingIcon}
      className={className}
      {...buttonProps}
    >
      {children}
    </Button>
  );
}
