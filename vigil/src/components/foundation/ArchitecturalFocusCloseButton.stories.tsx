"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArchitecturalFocusCloseButton } from "@/src/components/foundation/ArchitecturalFocusCloseButton";

const meta: Meta<typeof ArchitecturalFocusCloseButton> = {
  title: "Architectural Shell/Components/Focus Close Button",
  component: ArchitecturalFocusCloseButton,
  args: {
    dirty: false,
    onDone: () => {},
    onSave: () => {},
    onDiscard: () => {},
  },
  argTypes: {
    dirty: { control: "boolean" },
    onDone: { control: false },
    onSave: { control: false },
    onDiscard: { control: false },
  },
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof ArchitecturalFocusCloseButton>;

export const DoneClean: Story = {
  args: { dirty: false },
};

export const SaveDiscardDirty: Story = {
  args: { dirty: true },
};
