"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";

import { cx } from "@/src/lib/cx";

export type ButtonVariant = "neutral" | "primary" | "danger" | "ghost" | "subtle";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "pill";
export type ButtonTone =
  | "glass"
  | "solid"
  | "menu"
  | "focus-light"
  | "focus-dark"
  | "card-light"
  | "card-dark";
export type ButtonVisualState = "default" | "hover" | "active";

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ButtonTone;
  isActive?: boolean;
  isLoading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  iconOnly?: boolean;
  asChild?: boolean;
  /** Storybook/debug only. */
  forceState?: ButtonVisualState;
} & ButtonHTMLAttributes<HTMLButtonElement>;

function sharedProps({
  className,
  variant,
  size,
  tone,
  isActive,
  isLoading,
  iconOnly,
  forceState,
  disabled,
}: Pick<
  ButtonProps,
  | "className"
  | "variant"
  | "size"
  | "tone"
  | "isActive"
  | "isLoading"
  | "iconOnly"
  | "forceState"
  | "disabled"
>) {
  return {
    className: cx("vigil-btn", className),
    "data-variant": variant,
    "data-size": size,
    "data-tone": tone,
    "data-active": isActive ? "true" : undefined,
    "data-loading": isLoading ? "true" : undefined,
    "data-icon-only": iconOnly ? "true" : undefined,
    "data-force-state": forceState !== "default" ? forceState : undefined,
    "data-disabled": disabled ? "true" : undefined,
  };
}

export function Button({
  variant = "neutral",
  size = "md",
  tone = "glass",
  isActive = false,
  isLoading = false,
  leadingIcon,
  trailingIcon,
  iconOnly = false,
  asChild = false,
  forceState = "default",
  className,
  children,
  disabled,
  ...buttonProps
}: ButtonProps) {
  const mergedDisabled = disabled || isLoading;

  if (iconOnly && !buttonProps["aria-label"]) {
    throw new Error("Icon-only buttons must include aria-label.");
  }

  if (asChild) {
    if (!isValidElement(children)) {
      throw new Error("Button with asChild must receive exactly one valid element.");
    }
    const child = children as ReactElement<
      HTMLAttributes<HTMLElement> & { className?: string; children?: ReactNode }
    >;
    return cloneElement(child, {
      ...sharedProps({
        className: cx(child.props.className, className),
        variant,
        size,
        tone,
        isActive,
        isLoading,
        iconOnly,
        forceState,
        disabled: mergedDisabled,
      }),
      "aria-busy": isLoading || undefined,
      children: (
        <>
          {leadingIcon}
          {child.props.children}
          {trailingIcon}
        </>
      ),
    });
  }

  return (
    <button
      type="button"
      disabled={mergedDisabled}
      aria-busy={isLoading || undefined}
      {...sharedProps({
        className,
        variant,
        size,
        tone,
        isActive,
        isLoading,
        iconOnly,
        forceState,
        disabled: mergedDisabled,
      })}
      {...buttonProps}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
