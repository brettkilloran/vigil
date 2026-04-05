"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalCanvasApp } from "@/src/components/foundation/ArchitecturalCanvasApp";

const meta: Meta<typeof ArchitecturalCanvasApp> = {
  title: "Heartgarden/Architectural Shell/Full canvas",
  component: ArchitecturalCanvasApp,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof ArchitecturalCanvasApp>;

export const Default: Story = {
  render: () => <ArchitecturalCanvasApp />,
};

export const NestedFolders: Story = {
  render: () => <ArchitecturalCanvasApp scenario="nested" />,
};

export const CorruptFolderRecovery: Story = {
  render: () => <ArchitecturalCanvasApp scenario="corrupt" />,
};

