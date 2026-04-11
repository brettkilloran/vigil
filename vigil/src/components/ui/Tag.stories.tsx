"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { Tag, type TagVariant } from "@/src/components/ui/Tag";

const meta: Meta<typeof Tag> = {
  title: "Heartgarden/UI/Tag",
  component: Tag,
  args: {
    variant: "llmLight",
    children: "Unreviewed",
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["llmLight", "llmCode", "llmFocusDark", "neutral"],
      description:
        "LLM / ingestion review chips use llmLight (paper), llmCode (dark code card), llmFocusDark (dark focus).",
    },
    children: { control: "text" },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Small uppercase chip for status labels. **LLM & ingestion** review states (`llmLight`, `llmCode`, `llmFocusDark`) consume the shared semantic tokens from `app/globals.css`: `--sem-text-llm-accent`, `--sem-text-llm-accent-bright`, `--sem-surface-llm-pending`, `--sem-surface-llm-pending-hover`, `--sem-border-llm-pending`. See also **Heartgarden → UI → Tokens source of truth** for the full catalog.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--theme-default-bg)",
          color: "var(--theme-default-text)",
          padding: 20,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Tag>;

export const Playground: Story = {};

const llmVariants: TagVariant[] = ["llmLight", "llmCode", "llmFocusDark", "neutral"];

export const LlmAndNeutralMatrix: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p style={{ fontSize: 12, color: "var(--sem-text-muted)", margin: "0 0 8px" }}>
          Light paper (default / task canvas, light focus)
        </p>
        <div
          style={{
            padding: 16,
            background: "var(--theme-default-bg)",
            borderRadius: 8,
            border: "1px solid var(--sem-border-subtle)",
          }}
        >
          <Tag variant="llmLight">Unreviewed</Tag>
        </div>
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--sem-text-muted)", margin: "0 0 8px" }}>
          Code-themed card header
        </p>
        <div
          style={{
            padding: 16,
            background: "var(--theme-code-bg)",
            color: "var(--theme-code-text)",
            borderRadius: 8,
            border: "1px solid color-mix(in oklch, var(--sys-color-white) 8%, transparent)",
          }}
        >
          <Tag variant="llmCode">Unreviewed</Tag>
        </div>
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--sem-text-muted)", margin: "0 0 8px" }}>
          Dark focus sheet (code / lore hybrid)
        </p>
        <div
          style={{
            padding: 16,
            background: "color-mix(in oklch, var(--sys-color-neutral-950) 96%, transparent)",
            borderRadius: 8,
          }}
        >
          <Tag variant="llmFocusDark">Unreviewed</Tag>
        </div>
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--sem-text-muted)", margin: "0 0 8px" }}>
          Neutral (non-LLM labels)
        </p>
        <div style={{ padding: 16, background: "var(--sem-surface-base)", borderRadius: 8 }}>
          <Tag variant="neutral">Beta</Tag>
        </div>
      </div>
    </div>
  ),
};

export const VariantLabels: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {llmVariants.map((v) => (
        <Tag key={v} variant={v}>
          {v}
        </Tag>
      ))}
    </div>
  ),
};
