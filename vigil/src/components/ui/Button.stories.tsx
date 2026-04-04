"use client";

import { CheckCircle, CursorClick, Trash } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";

import { Button } from "@/src/components/ui/Button";

const meta: Meta<typeof Button> = {
  title: "Design System/Button",
  component: Button,
  args: {
    variant: "neutral",
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
      options: ["neutral", "primary", "danger", "ghost", "subtle"],
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
    const variants = ["neutral", "primary", "danger", "ghost", "subtle"] as const;
    const sizes = ["xs", "sm", "md", "lg"] as const;
    return (
      <div style={{ display: "grid", gap: 12, padding: 20, background: "var(--sem-surface-base)" }}>
        {variants.map((variant) => (
          <div key={variant} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ width: 70, color: "var(--sys-color-neutral-400)", fontFamily: "monospace", fontSize: 11 }}>
              {variant}
            </span>
            {sizes.map((size) => (
              <Button key={`${variant}-${size}`} variant={variant} size={size}>
                {variant}
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
    <div style={{ display: "flex", gap: 10, padding: 20, background: "var(--sem-surface-base)", flexWrap: "wrap" }}>
      <Button>Default</Button>
      <Button forceState="hover">Hover</Button>
      <Button forceState="active">Active</Button>
      <Button isActive>Selected</Button>
      <Button disabled>Disabled</Button>
      <Button isLoading>Loading</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="ghost" size="icon" iconOnly aria-label="Cursor">
        <CursorClick size={16} />
      </Button>
    </div>
  ),
};

export const AsChildLink: Story = {
  render: () => (
    <Button asChild variant="neutral" tone="glass">
      <a href="https://example.com">Open Link</a>
    </Button>
  ),
};

export const IconOnly: Story = {
  render: () => (
    <div style={{ padding: 20, background: "var(--sem-surface-base)" }}>
      <Button size="icon" iconOnly aria-label="Complete action">
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
    await expect(canvas.getByRole("button", { name: "Focusable" })).toHaveFocus();
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
    await userEvent.click(canvas.getByRole("button", { name: "Disabled Action" }));
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
    await userEvent.click(canvas.getByRole("button", { name: "Loading Action" }));
  },
};
