"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Button } from "@/src/components/ui/Button";
import type { ButtonSize as UiButtonSize } from "@/src/components/ui/Button";

type ButtonSize = "icon" | "menu" | "pill";
export type ArchitecturalButtonTone =
  | "glass"
  | "menu"
  | "focus-light"
  | "focus-dark"
  | "focus-done"
  | "focus-discard"
  | "card-light"
  | "card-dark";

type ButtonTone = ArchitecturalButtonTone;
type ButtonState = "default" | "hover" | "active";

function toUiButtonSize(size: ButtonSize): UiButtonSize {
  if (size === "menu") return "sm";
  return size;
}

export const ArchitecturalButton = forwardRef<
  HTMLButtonElement,
  {
    size: ButtonSize;
    tone: ButtonTone;
    active?: boolean;
    forceState?: ButtonState;
    leadingIcon?: ReactNode;
    iconOnly?: boolean;
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(function ArchitecturalButton(
  {
    size,
    tone,
    active = false,
    forceState = "default",
    leadingIcon,
    iconOnly = false,
    className,
    children,
    ...buttonProps
  },
  ref,
) {
  return (
    <Button
      ref={ref}
      size={toUiButtonSize(size)}
      tone={tone}
      variant="default"
      isActive={active}
      forceState={forceState}
      leadingIcon={leadingIcon}
      iconOnly={iconOnly}
      className={className}
      {...buttonProps}
    >
      {children}
    </Button>
  );
});
