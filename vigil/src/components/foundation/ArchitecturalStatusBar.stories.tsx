"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalStatusBar } from "@/src/components/foundation/ArchitecturalStatusBar";

const meta: Meta<typeof ArchitecturalStatusBar> = {
  title: "Heartgarden/Architectural Shell/Components/Status Bar",
  component: ArchitecturalStatusBar,
  args: {
    envLabel: "波途画電",
    showPulse: true,
    syncBootstrapPending: false,
    onExportGraphJson: () => {
      console.info("Export graph JSON");
    },
    exportGraphPaletteHint: "⌘K → Export graph JSON",
  },
  argTypes: {
    envLabel: { control: "text" },
    showPulse: { control: "boolean" },
    syncBootstrapPending: { control: "boolean" },
  },
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          background: "var(--sem-surface-base)",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ArchitecturalStatusBar>;

export const Default: Story = {};

export const NoPulse: Story = {
  args: {
    showPulse: false,
  },
};

