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
    background: "transparent",
    border: "1px solid var(--sem-border-strong)",
    borderRadius: 6,
    height: 24,
    width: 36,
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
      background: "var(--sys-color-neutral-100)",
      borderRadius: tokenRef,
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
    for (const prefix of TOKEN_PREFIXES) {
      groups[prefix] = rows.filter((row) => row.name.startsWith(prefix));
    }
    return groups;
  }, [rows]);

  return (
    <div
      style={{
        background: "var(--sem-surface-base)",
        color: "var(--sem-text-primary)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        minHeight: "100vh",
        padding: 28,
      }}
    >
      <div style={{ margin: "0 auto", maxWidth: 1100 }}>
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
                  background: "var(--sem-surface-elevated)",
                  border: "1px solid var(--sem-border-subtle)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {sectionRows.map((row, idx) => (
                  <div
                    key={row.name}
                    style={{
                      alignItems: "center",
                      borderTop:
                        idx === 0
                          ? "none"
                          : "1px solid color-mix(in oklch, var(--sem-border-subtle) 70%, transparent)",
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns:
                        "44px minmax(260px, 1fr) minmax(320px, 1fr)",
                      padding: "10px 12px",
                    }}
                  >
                    <div style={swatchStyle(row.name)} />
                    <code
                      style={{
                        color: "var(--sem-text-secondary)",
                        fontSize: 13,
                      }}
                    >
                      {row.name}
                    </code>
                    <code
                      style={{
                        color: "var(--sem-text-primary)",
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
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
  component: TokenCatalog,
  parameters: {
    docs: {
      description: {
        component:
          "Auto-discovers and renders all design-system token variables from `:root` using DS prefixes (`--sys-*`, `--sem-*`, `--cmp-*`, `--vigil-*`, `--theme-*`).",
      },
    },
    layout: "fullscreen",
  },
  title: "Heartgarden/Design System/Tokens/Source of truth",
};

export default meta;
type Story = StoryObj<typeof TokenCatalog>;

export const Catalog: Story = {};
