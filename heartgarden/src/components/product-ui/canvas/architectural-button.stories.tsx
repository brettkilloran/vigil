"use client";

import { CheckCircle, CursorClick, Note } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalButton } from "@/src/components/foundation/architectural-button";

const meta: Meta<typeof ArchitecturalButton> = {
  args: {
    active: false,
    children: "Label",
    disabled: false,
    forceState: "default",
    onClick: () => {
      /* noop */
    },
    size: "icon",
    tone: "glass",
  },
  argTypes: {
    active: { control: "boolean" },
    disabled: { control: "boolean" },
    forceState: { control: "radio", options: ["default", "hover", "active"] },
    leadingIcon: { control: false },
    onClick: { control: false },
    size: { control: "radio", options: ["icon", "menu", "pill"] },
    tone: {
      control: "radio",
      options: ["glass", "menu", "focus-light", "focus-dark"],
    },
  },
  component: ArchitecturalButton,
  title: "Heartgarden/Product UI/Canvas/Shell button",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalButton>;

export const IconGlass: Story = {
  args: {
    children: <CursorClick size={18} />,
    size: "icon",
    tone: "glass",
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
    children: "Note",
    leadingIcon: <Note size={16} />,
    size: "menu",
    tone: "menu",
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
    children: "Done",
    leadingIcon: <CheckCircle size={16} />,
    size: "pill",
    tone: "focus-light",
  },
  decorators: [
    (Story) => (
      <div style={{ background: "var(--sys-color-neutral-100)", padding: 20 }}>
        <Story />
      </div>
    ),
  ],
};

export const IconActive: Story = {
  args: {
    active: true,
    children: <CursorClick size={18} />,
    size: "icon",
    tone: "glass",
  },
  decorators: IconGlass.decorators,
};

export const IconDisabled: Story = {
  args: {
    children: <CursorClick size={18} />,
    disabled: true,
    size: "icon",
    tone: "glass",
  },
  decorators: IconGlass.decorators,
};

export const MenuHover: Story = {
  args: {
    children: "Note",
    forceState: "hover",
    leadingIcon: <Note size={16} />,
    size: "menu",
    tone: "menu",
  },
  decorators: MenuAction.decorators,
};

export const FocusDark: Story = {
  args: {
    children: "Done",
    leadingIcon: <CheckCircle size={16} />,
    size: "pill",
    tone: "focus-dark",
  },
  decorators: [
    (Story) => (
      <div style={{ background: "var(--sys-color-neutral-900)", padding: 20 }}>
        <Story />
      </div>
    ),
  ],
};

export const StateMatrix: Story = {
  render: () => (
    <div
      style={{
        background: "var(--sem-surface-base)",
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        padding: 20,
      }}
    >
      <ArchitecturalButton size="icon" tone="glass">
        <CursorClick size={18} />
      </ArchitecturalButton>
      <ArchitecturalButton forceState="hover" size="icon" tone="glass">
        <CursorClick size={18} />
      </ArchitecturalButton>
      <ArchitecturalButton forceState="active" size="icon" tone="glass">
        <CursorClick size={18} />
      </ArchitecturalButton>
      <ArchitecturalButton active size="icon" tone="glass">
        <CursorClick size={18} />
      </ArchitecturalButton>
      <ArchitecturalButton disabled size="icon" tone="glass">
        <CursorClick size={18} />
      </ArchitecturalButton>
    </div>
  ),
};
