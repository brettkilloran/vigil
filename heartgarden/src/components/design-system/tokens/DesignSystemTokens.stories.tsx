"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

interface TokenRow {
  name: string;
  value: string;
}

const TOKEN_PREFIXES = [
  "--sys-",
  "--sem-",
  "--cmp-",
  "--vigil-",
  "--theme-",
] as const;

function readRootTokens(): TokenRow[] {
  if (typeof window === "undefined") {
    return [];
  }
  const style = getComputedStyle(document.documentElement);
  const rows: TokenRow[] = [];

  for (let i = 0; i < style.length; i += 1) {
    const name = style.item(i);
    if (!name) {
      continue;
    }
    if (!TOKEN_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      continue;
    }
    const value = style.getPropertyValue(name).trim();
    if (!value) {
      continue;
    }
    rows.push({ name, value });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

function titleForPrefix(prefix: string): string {
  if (prefix === "--sys-") {
    return "Primitive Tokens";
  }
  if (prefix === "--sem-") {
    return "Semantic Tokens";
  }
  if (prefix === "--cmp-") {
    return "Component Tokens";
  }
  if (prefix === "--vigil-") {
    return "Compatibility Tokens";
  }
  return "Theme Tokens";
}

function swatchStyle(name: string): CSSProperties {
  const tokenRef = `var(${name})`;
  const common: CSSProperties = {
    width: 36,
    height: 24,
    borderRadius: 6,
    border: "1px solid var(--sem-border-strong)",
    background: "transparent",
  };

  if (name.includes("shadow")) {
    return {
      ...common,
      background: "var(--sys-color-neutral-100)",
      boxShadow: tokenRef,
    };
  }

  if (name.includes("radius")) {
    return {
      ...common,
      borderRadius: tokenRef,
      background: "var(--sys-color-neutral-100)",
    };
  }

  const looksColorLike =
    name.includes("color") ||
    name.includes("bg") ||
    name.includes("surface") ||
    name.includes("text") ||
    name.includes("border") ||
    name.includes("focus") ||
    name.includes("accent") ||
    name.includes("snap") ||
    name.includes("foreground") ||
    name.includes("background") ||
    name.includes("canvas") ||
    name.includes("llm");

  if (looksColorLike) {
    return {
      ...common,
      background: tokenRef,
    };
  }

  return common;
}

function TokenCatalog() {
  const [rows] = useState<TokenRow[]>(() => readRootTokens());

  const grouped = useMemo(() => {
    const groups: Record<string, TokenRow[]> = {};
    TOKEN_PREFIXES.forEach((prefix) => {
      groups[prefix] = rows.filter((row) => row.name.startsWith(prefix));
    });
    return groups;
  }, [rows]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--sem-surface-base)",
        color: "var(--sem-text-primary)",
        padding: 28,
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          Design System Token Source of Truth
        </h1>
        <p style={{ color: "var(--sem-text-muted)", marginBottom: 24 }}>
          Live catalog from <code>:root</code> CSS variables. This page
          auto-updates when token definitions change.
        </p>

        {TOKEN_PREFIXES.map((prefix) => {
          const sectionRows = grouped[prefix] ?? [];
          if (sectionRows.length === 0) {
            return null;
          }

          return (
            <section key={prefix} style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>
                {titleForPrefix(prefix)}
              </h2>
              <div
                style={{
                  border: "1px solid var(--sem-border-subtle)",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "var(--sem-surface-elevated)",
                }}
              >
                {sectionRows.map((row, idx) => (
                  <div
                    key={row.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "44px minmax(260px, 1fr) minmax(320px, 1fr)",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderTop:
                        idx === 0
                          ? "none"
                          : "1px solid color-mix(in oklch, var(--sem-border-subtle) 70%, transparent)",
                    }}
                  >
                    <div style={swatchStyle(row.name)} />
                    <code
                      style={{
                        fontSize: 13,
                        color: "var(--sem-text-secondary)",
                      }}
                    >
                      {row.name}
                    </code>
                    <code
                      style={{
                        fontSize: 13,
                        color: "var(--sem-text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={row.value}
                    >
                      {row.value}
                    </code>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const meta: Meta<typeof TokenCatalog> = {
  title: "Heartgarden/Design System/Tokens/Source of truth",
  component: TokenCatalog,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Auto-discovers and renders all design-system token variables from `:root` using DS prefixes (`--sys-*`, `--sem-*`, `--cmp-*`, `--vigil-*`, `--theme-*`).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TokenCatalog>;

export const Catalog: Story = {};
