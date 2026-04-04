"use client";

import { CheckCircle, CursorClick, Note } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";

const meta: Meta<typeof ArchitecturalButton> = {
  title: "Heartgarden/Architectural Shell/Primitives/Button",
  component: ArchitecturalButton,
  args: {
    size: "icon",
    tone: "glass",
    active: false,
    forceState: "default",
    disabled: false,
    children: "Label",
    onClick: () => {},
  },
  argTypes: {
    size: { control: "radio", options: ["icon", "menu", "pill"] },
    tone: {
      control: "radio",
      options: ["glass", "menu", "focus-light", "focus-dark"],
    },
    active: { control: "boolean" },
    forceState: { control: "radio", options: ["default", "hover", "active"] },
    disabled: { control: "boolean" },
    leadingIcon: { control: false },
    onClick: { control: false },
  },
};

export default meta;
type Story = StoryObj<typeof ArchitecturalButton>;

export const IconGlass: Story = {
  args: {
    size: "icon",
    tone: "glass",
    children: <CursorClick size={18} />,
  },
  decorators: [
    (Story) => (
      <div style={{ background: "var(--sem-surface-base)", padding: 20 }}>
        <Story />
      </div>
    ),
  ],
};

export const MenuAction: Story = {
  args: {
    size: "menu",
    tone: "menu",
    leadingIcon: <Note size={16} />,
    children: "Note",
  },
  decorators: [
    (Story) => (
      <div style={{ background: "var(--sem-surface-base)", padding: 20 }}>
        <Story />
      </div>
    ),
  ],
};

export const FocusPill: Story = {
  args: {
    size: "pill",
    tone: "focus-light",
    leadingIcon: <CheckCircle size={16} />,
    children: "Done",
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 20, background: "var(--sys-color-neutral-100)" }}>
        <Story />
      </div>
    ),
  ],
};

export const IconActive: Story = {
  args: {
    size: "icon",
    tone: "glass",
    active: true,
    children: <CursorClick size={18} />,
  },
  decorators: IconGlass.decorators,
};

export const IconDisabled: Story = {
  args: {
    size: "icon",
    tone: "glass",
    disabled: true,
    children: <CursorClick size={18} />,
  },
  decorators: IconGlass.decorators,
};

export const MenuHover: Story = {
  args: {
    size: "menu",
    tone: "menu",
    leadingIcon: <Note size={16} />,
    children: "Note",
    forceState: "hover",
  },
  decorators: MenuAction.decorators,
};

export const FocusDark: Story = {
  args: {
    size: "pill",
    tone: "focus-dark",
    leadingIcon: <CheckCircle size={16} />,
    children: "Done",
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 20, background: "var(--sys-color-neutral-900)" }}>
        <Story />
      </div>
    ),
  ],
};

export const StateMatrix: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 10, padding: 20, background: "var(--sem-surface-base)", flexWrap: "wrap" }}>
      <ArchitecturalButton size="icon" tone="glass">
        <CursorClick size={18} />
      </ArchitecturalButton>
      <ArchitecturalButton size="icon" tone="glass" forceState="hover">
        <CursorClick size={18} />
      </ArchitecturalButton>
      <ArchitecturalButton size="icon" tone="glass" forceState="active">
        <CursorClick size={18} />
      </ArchitecturalButton>
      <ArchitecturalButton size="icon" tone="glass" active>
        <CursorClick size={18} />
      </ArchitecturalButton>
      <ArchitecturalButton size="icon" tone="glass" disabled>
        <CursorClick size={18} />
      </ArchitecturalButton>
    </div>
  ),
};

