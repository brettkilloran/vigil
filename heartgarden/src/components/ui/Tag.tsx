"use client";

import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/src/lib/cx";

import styles from "@/src/components/ui/Tag.module.css";

export type TagVariant = "llmLight" | "llmCode" | "llmFocusDark" | "neutral";

const variantClass: Record<TagVariant, string> = {
  llmLight: styles.llmLight,
  llmCode: styles.llmCode,
  llmFocusDark: styles.llmFocusDark,
  neutral: styles.neutral,
};

export type TagProps = {
  variant?: TagVariant;
  children: ReactNode;
} & HTMLAttributes<HTMLSpanElement>;

/**
 * Compact label chip. LLM / ingestion review states use `llmLight` | `llmCode` | `llmFocusDark`
 * (see `app/globals.css` `--sem-*-llm-*` tokens).
 */
export function Tag({ variant = "llmLight", className, children, ...rest }: TagProps) {
  return (
    <span className={cx(styles.tag, variantClass[variant], className)} {...rest}>
      {children}
    </span>
  );
}
