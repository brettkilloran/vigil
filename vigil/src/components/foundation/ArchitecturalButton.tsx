"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";

type ButtonSize = "icon" | "menu" | "pill";
type ButtonTone = "glass" | "menu" | "focus-light" | "focus-dark";
type ButtonState = "default" | "hover" | "active";

function toneClassName(tone: ButtonTone): string {
  if (tone === "menu") return styles.buttonToneMenu;
  if (tone === "focus-light") return styles.buttonToneFocusLight;
  if (tone === "focus-dark") return styles.buttonToneFocusDark;
  return styles.buttonToneGlass;
}

function sizeClassName(size: ButtonSize): string {
  if (size === "menu") return styles.buttonSizeMenu;
  if (size === "pill") return styles.buttonSizePill;
  return styles.buttonSizeIcon;
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
  const classes = [
    styles.buttonRoot,
    sizeClassName(size),
    toneClassName(tone),
    active ? styles.buttonActive : "",
    forceState === "hover" ? styles.buttonStateHover : "",
    forceState === "active" ? styles.buttonStateActive : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={classes} {...buttonProps}>
      {leadingIcon}
      {children}
    </button>
  );
}
