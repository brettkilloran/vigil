"use client";

import { CheckCircle, CursorClick, Trash } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, userEvent, within } from "storybook/test";
import gutterStyles from "@/src/components/editing/HgAiPendingEditorGutter.module.css";
import canvasStyles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { Button } from "@/src/components/ui/Button";
import { Tag } from "@/src/components/ui/Tag";

const meta: Meta<typeof Button> = {
  title: "Heartgarden/Design System/Primitives/Button",
  component: Button,
  parameters: {
    docs: {
      description: {
        component:
          'Use **variant="default"** for the standard control (most actions). **primary** is the high-emphasis CTA. **ghost** is for minimal affordances. **subtle** for compact or chip-like use. **danger** is destructive. Token pipeline still uses the `--cmp-button-neutral-*` names under the hood for the default style.',
      },
    },
  },
  args: {
    variant: "default",
    size: "md",
    tone: "glass",
    isActive: false,
    isLoading: false,
    forceState: "default",
    disabled: false,
    children: "Button",
    onClick: () => {},
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["default", "primary", "danger", "ghost", "subtle"],
    },
    size: {
      control: "radio",
      options: ["xs", "sm", "md", "lg", "icon", "pill"],
    },
    tone: {
      control: "radio",
      options: ["glass", "solid", "menu", "focus-light", "focus-dark"],
    },
    forceState: { control: "radio", options: ["default", "hover", "active"] },
    leadingIcon: { control: false },
    trailingIcon: { control: false },
    asChild: { control: false },
    iconOnly: { control: "boolean" },
    onClick: { control: false },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Playground: Story = {};

export const VariantMatrix: Story = {
  render: () => {
    const rows: {
      id: "default" | "primary" | "danger" | "ghost" | "subtle";
      label: string;
      note: string;
    }[] = [
      { id: "default", label: "default", note: "Standard (use most often)" },
      { id: "primary", label: "primary", note: "CTA / high emphasis" },
      { id: "danger", label: "danger", note: "Destructive" },
      { id: "ghost", label: "ghost", note: "Minimal" },
      { id: "subtle", label: "subtle", note: "Compact / chips" },
    ];
    const sizes = ["xs", "sm", "md", "lg"] as const;
    return (
      <div
        style={{
          display: "grid",
          gap: 12,
          padding: 20,
          background: "var(--sem-surface-base)",
        }}
      >
        {rows.map((row) => (
          <div
            key={row.id}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: 200,
                color: "var(--sys-color-neutral-400)",
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                lineHeight: 1.3,
              }}
            >
              <div>{row.label}</div>
              <div style={{ color: "var(--sem-text-muted)", fontSize: 10 }}>
                {row.note}
              </div>
            </div>
            {sizes.map((size) => (
              <Button key={`${row.id}-${size}`} size={size} variant={row.id}>
                {row.label}
              </Button>
            ))}
          </div>
        ))}
      </div>
    );
  },
};

export const StateMatrix: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: 20,
        background: "var(--sem-surface-base)",
        flexWrap: "wrap",
      }}
    >
      <Button>Default</Button>
      <Button forceState="hover">Hover</Button>
      <Button forceState="active">Active</Button>
      <Button isActive>Selected</Button>
      <Button disabled>Disabled</Button>
      <Button isLoading>Loading</Button>
      <Button variant="danger">Danger</Button>
      <Button aria-label="Cursor" iconOnly size="icon" variant="ghost">
        <CursorClick size={16} />
      </Button>
    </div>
  ),
};

export const AsChildLink: Story = {
  render: () => (
    <Button asChild tone="glass" variant="default">
      <a href="https://example.com">Open Link</a>
    </Button>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <div style={{ padding: 20, background: "var(--sem-surface-base)" }}>
      <Button aria-label="Complete action" iconOnly size="icon">
        <CheckCircle size={16} />
      </Button>
    </div>
  ),
};

export const KeyboardFocusVisible: Story = {
  render: () => (
    <div style={{ padding: 20, background: "var(--sem-surface-base)" }}>
      <Button>Focusable</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await expect(
      canvas.getByRole("button", { name: "Focusable" })
    ).toHaveFocus();
  },
};

export const DisabledSuppressesClick: Story = {
  args: {
    disabled: true,
    children: "Disabled Action",
    onClick: () => {
      throw new Error("Disabled button should not be clickable");
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Disabled Action" })
    );
  },
};

export const LoadingSuppressesClick: Story = {
  args: {
    isLoading: true,
    children: "Loading Action",
    trailingIcon: <Trash size={14} />,
    onClick: () => {
      throw new Error("Loading button should not be clickable");
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Loading Action" })
    );
  },
};

function BindButtonRow({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={dark ? "dark" : undefined}
      style={{
        padding: 16,
        borderRadius: 12,
        background: dark
          ? "var(--sys-color-neutral-920)"
          : "var(--sem-surface-base)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Button
          className={gutterStyles.bindBtn}
          data-hg-ai-bind="true"
          size="xs"
          type="button"
          variant="subtle"
        >
          Bind
        </Button>
        <Button
          className={gutterStyles.bindBtn}
          data-hg-ai-bind="true"
          forceState="hover"
          size="xs"
          type="button"
          variant="subtle"
        >
          Bind
        </Button>
        <Button
          className={gutterStyles.bindBtn}
          data-hg-ai-bind="true"
          forceState="active"
          size="xs"
          type="button"
          variant="subtle"
        >
          Bind
        </Button>
        <Button
          className={gutterStyles.bindBtn}
          data-hg-ai-bind="true"
          disabled
          size="xs"
          type="button"
          variant="subtle"
        >
          Bind
        </Button>
      </div>
    </div>
  );
}

export const AiBindGutterStates: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 12 }}>
      <BindButtonRow />
      <BindButtonRow dark />
    </div>
  ),
};

export const AiBindFocusReviewBar: Story = {
  render: () => (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: "var(--sem-surface-base)",
        }}
      >
        <div className={canvasStyles.focusAiReviewBar}>
          <Tag variant="llmLight">Unreviewed</Tag>
          <Button
            className={canvasStyles.nodeBtn}
            data-hg-ai-bind="true"
            size="xs"
            type="button"
            variant="subtle"
          >
            Bind all
          </Button>
          <span className={canvasStyles.focusAiReviewHint}>
            Bind removes pending highlights; Save applies body edits like any
            other change.
          </span>
        </div>
      </div>

      <div
        className={`${canvasStyles.focusEditorDark} dark`}
        style={{
          padding: 16,
          borderRadius: 12,
          background: "var(--sys-color-neutral-900)",
        }}
      >
        <div className={canvasStyles.focusAiReviewBar}>
          <Tag variant="llmFocusDark">Unreviewed</Tag>
          <Button
            className={canvasStyles.nodeBtn}
            data-hg-ai-bind="true"
            forceState="hover"
            size="xs"
            type="button"
            variant="subtle"
          >
            Bind all
          </Button>
          <span className={canvasStyles.focusAiReviewHint}>
            Bind removes pending highlights; Save applies body edits like any
            other change.
          </span>
        </div>
      </div>
    </div>
  ),
};
