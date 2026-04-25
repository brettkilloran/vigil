"use client";

import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactElement,
  ReactNode,
} from "react";
import { cloneElement, isValidElement } from "react";

import { cx } from "@/src/lib/cx";

/**
 * - **default** — Standard control (the system default: use for most non-destructive actions).
 * - **primary** — High-emphasis CTA; use sparingly for the single best next step.
 * - **danger** — Destructive action.
 * - **ghost** — Minimal surface (toolbar / secondary in dense rows).
 * - **subtle** — Compacted affordances (e.g. doc gutter, chips).
 */
export type ButtonVariant =
  | "default"
  | "primary"
  | "danger"
  | "ghost"
  | "subtle";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "pill";
export type ButtonTone =
  | "glass"
  | "solid"
  | "menu"
  | "focus-light"
  | "focus-dark"
  | "focus-done"
  | "focus-discard"
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
  /** Opt-in hook for AI bind button typography tweaks. */
  "data-hg-ai-bind"?: boolean | "true" | "false";
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
    "data-active": isActive ? "true" : undefined,
    "data-disabled": disabled ? "true" : undefined,
    "data-force-state": forceState === "default" ? undefined : forceState,
    "data-icon-only": iconOnly ? "true" : undefined,
    "data-loading": isLoading ? "true" : undefined,
    "data-size": size,
    "data-tone": tone,
    "data-variant": variant,
  };
}

export const Button = function Button({
  variant = "default",
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
  ref,
  ...buttonProps
}: ButtonProps & { ref?: RefObject<HTMLButtonElement | null> }) {
  const mergedDisabled = disabled || isLoading;
  const aiBindAttr = buttonProps["data-hg-ai-bind"];
  const isAiBind = aiBindAttr === true || aiBindAttr === "true";

  if (iconOnly && !buttonProps["aria-label"]) {
    throw new Error("Icon-only buttons must include aria-label.");
  }

  if (asChild) {
    if (!isValidElement(children)) {
      throw new Error(
        "Button with asChild must receive exactly one valid element."
      );
    }
    const child = children as ReactElement<
      HTMLAttributes<HTMLElement> & {
        className?: string;
        children?: ReactNode;
      }
    >;
    return cloneElement(child, {
      ...sharedProps({
        className: cx(child.props.className, className),
        disabled: mergedDisabled,
        forceState,
        iconOnly,
        isActive,
        isLoading,
        size,
        tone,
        variant,
      }),
      "aria-busy": isLoading || undefined,
      children: (
        <>
          {leadingIcon}
          {isAiBind ? (
            <span>{child.props.children}</span>
          ) : (
            child.props.children
          )}
          {trailingIcon}
        </>
      ),
    });
  }

  return (
    /* eslint-disable-next-line no-restricted-syntax -- Base shared Button must render the native control. */
    <button
      aria-busy={isLoading || undefined}
      disabled={mergedDisabled}
      ref={ref}
      type="button"
      {...sharedProps({
        className,
        disabled: mergedDisabled,
        forceState,
        iconOnly,
        isActive,
        isLoading,
        size,
        tone,
        variant,
      })}
      {...buttonProps}
    >
      {leadingIcon}
      {isAiBind ? <span>{children}</span> : children}
      {trailingIcon}
    </button>
  );
};
