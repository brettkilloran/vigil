"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArchitecturalFocusCloseButton } from "@/src/components/foundation/ArchitecturalFocusCloseButton";

const meta: Meta<typeof ArchitecturalFocusCloseButton> = {
  title: "Architectural Shell/Components/Focus Close Button",
  component: ArchitecturalFocusCloseButton,
  args: {
    label: "Done",
    variant: "light",
    disabled: false,
    showIcon: true,
    forceState: "default",
    onClick: () => {},
  },
  argTypes: {
    label: { control: "text" },
    variant: { control: "radio", options: ["light", "dark"] },
    disabled: { control: "boolean" },
    showIcon: { control: "boolean" },
    forceState: { control: "radio", options: ["default", "hover", "active"] },
    onClick: { control: false },
  },
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof ArchitecturalFocusCloseButton>;

export const LightDefault: Story = {};

export const LightHover: Story = {
  args: { forceState: "hover" },
};

export const LightActive: Story = {
  args: { forceState: "active" },
};

export const DarkDefault: Story = {
  args: { variant: "dark" },
  decorators: [
    (Story) => (
      <div style={{ padding: 18, background: "#121217", borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
};

export const Disabled: Story = {
  args: { disabled: true },
};
