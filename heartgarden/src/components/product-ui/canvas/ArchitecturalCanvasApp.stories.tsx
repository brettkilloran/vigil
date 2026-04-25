"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalCanvasApp } from "@/src/components/foundation/ArchitecturalCanvasApp";

const meta: Meta<typeof ArchitecturalCanvasApp> = {
  component: ArchitecturalCanvasApp,
  parameters: {
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Canvas/Full canvas",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalCanvasApp>;

export const Default: Story = {
  render: () => <ArchitecturalCanvasApp />,
};

export const CorruptFolderRecovery: Story = {
  render: () => <ArchitecturalCanvasApp scenario="corrupt" />,
};
