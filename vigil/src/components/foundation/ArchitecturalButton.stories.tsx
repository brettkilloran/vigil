"use client";

import { CheckCircle, CursorClick, Note } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";

const meta: Meta<typeof ArchitecturalButton> = {
  title: "Architectural Shell/Primitives/Button",
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
      <div style={{ background: "#0a0a0c", padding: 20 }}>
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
      <div style={{ background: "#0a0a0c", padding: 20 }}>
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
      <div style={{ padding: 20, background: "#f8f8f8" }}>
        <Story />
      </div>
    ),
  ],
};
