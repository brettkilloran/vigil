"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalFocusCloseButton } from "@/src/components/foundation/architectural-focus-close-button";

const meta: Meta<typeof ArchitecturalFocusCloseButton> = {
  args: {
    dirty: false,
    onDiscard: () => {
      /* noop */
    },
    onDone: () => {
      /* noop */
    },
    onSave: () => {
      /* noop */
    },
  },
  argTypes: {
    dirty: { control: "boolean" },
    onDiscard: { control: false },
    onDone: { control: false },
    onSave: { control: false },
  },
  component: ArchitecturalFocusCloseButton,
  parameters: {
    layout: "centered",
  },
  title: "Heartgarden/Product UI/Canvas/Focus close button",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalFocusCloseButton>;

export const DoneClean: Story = {
  args: { dirty: false },
};

export const SaveDiscardDirty: Story = {
  args: { dirty: true },
};
