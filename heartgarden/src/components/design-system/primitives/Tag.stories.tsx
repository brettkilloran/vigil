"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { Tag, type TagVariant } from "@/src/components/ui/Tag";

const meta: Meta<typeof Tag> = {
  args: {
    children: "Unreviewed",
    variant: "llmLight",
  },
  argTypes: {
    children: { control: "text" },
    variant: {
      control: "radio",
      description:
        "LLM / ingestion review chips use llmLight (paper), llmCode (dark code card), llmFocusDark (dark focus).",
      options: ["llmLight", "llmCode", "llmFocusDark", "neutral"],
    },
  },
  component: Tag,
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--theme-default-bg)",
          color: "var(--theme-default-text)",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          padding: 20,
        }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Small uppercase chip for status labels. **LLM & ingestion** review states (`llmLight`, `llmCode`, `llmFocusDark`) consume the shared semantic tokens from `app/globals.css`: `--sem-text-llm-accent`, `--sem-text-llm-accent-bright`, `--sem-surface-llm-pending`, `--sem-surface-llm-pending-hover`, `--sem-border-llm-pending`. See also **Heartgarden → UI → Tokens source of truth** for the full catalog.",
      },
    },
  },
  title: "Heartgarden/Design System/Primitives/Tag",
};

export default meta;
type Story = StoryObj<typeof Tag>;

export const Playground: Story = {};

const llmVariants: TagVariant[] = [
  "llmLight",
  "llmCode",
  "llmFocusDark",
  "neutral",
];

export const LlmAndNeutralMatrix: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <p
          style={{
            color: "var(--sem-text-muted)",
            fontSize: 12,
            margin: "0 0 8px",
          }}
        >
          Light paper (default / task canvas, light focus)
        </p>
        <div
          style={{
            background: "var(--theme-default-bg)",
            border: "1px solid var(--sem-border-subtle)",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <Tag variant="llmLight">Unreviewed</Tag>
        </div>
      </div>
      <div>
        <p
          style={{
            color: "var(--sem-text-muted)",
            fontSize: 12,
            margin: "0 0 8px",
          }}
        >
          Code-themed card header
        </p>
        <div
          style={{
            background: "var(--theme-code-bg)",
            border:
              "1px solid color-mix(in oklch, var(--sys-color-white) 8%, transparent)",
            borderRadius: 8,
            color: "var(--theme-code-text)",
            padding: 16,
          }}
        >
          <Tag variant="llmCode">Unreviewed</Tag>
        </div>
      </div>
      <div>
        <p
          style={{
            color: "var(--sem-text-muted)",
            fontSize: 12,
            margin: "0 0 8px",
          }}
        >
          Dark focus sheet (code / lore hybrid)
        </p>
        <div
          style={{
            background:
              "color-mix(in oklch, var(--sys-color-neutral-950) 96%, transparent)",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <Tag variant="llmFocusDark">Unreviewed</Tag>
        </div>
      </div>
      <div>
        <p
          style={{
            color: "var(--sem-text-muted)",
            fontSize: 12,
            margin: "0 0 8px",
          }}
        >
          Neutral (non-LLM labels)
        </p>
        <div
          style={{
            background: "var(--sem-surface-base)",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <Tag variant="neutral">Beta</Tag>
        </div>
      </div>
    </div>
  ),
};

export const VariantLabels: Story = {
  render: () => (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      {llmVariants.map((v) => (
        <Tag key={v} variant={v}>
          {v}
        </Tag>
      ))}
    </div>
  ),
};
