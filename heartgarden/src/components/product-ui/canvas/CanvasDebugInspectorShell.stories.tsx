"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { CanvasDebugInspectorShell } from "@/src/components/ui/CanvasDebugInspectorShell";

const meta = {
  title: "Heartgarden/Product UI/Canvas/Debug inspector shell",
  component: CanvasDebugInspectorShell,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Collapsible chrome aligned with the canvas tool rail — used by the links debug panel and similar inspectors.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        className="relative min-h-[280px] w-[min(100vw-32px,420px)] rounded-xl border border-[var(--vigil-border)] bg-[var(--sem-bg-canvas,#0c0e14)] p-4"
        style={{ minWidth: 320 }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CanvasDebugInspectorShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  args: {
    storageKey: "sb-canvas-debug-shell-collapsed",
    title: "DEBUG // Links",
    defaultOpen: false,
    children: (
      <p className="text-sm text-[var(--vigil-muted)]">
        Expand the bug button to reveal this body.
      </p>
    ),
  },
};

export const Expanded: Story = {
  args: {
    storageKey: "sb-canvas-debug-shell-expanded",
    title: "DEBUG // Links",
    defaultOpen: true,
    children: (
      <div className="space-y-2 text-sm text-[var(--sem-text-secondary)]">
        <p className="font-medium text-[var(--sem-text-primary)]">Sample inspector</p>
        <p className="text-[var(--vigil-muted)]">
          Uses the same glass panel styling as the live canvas debug rail.
        </p>
      </div>
    ),
  },
};
