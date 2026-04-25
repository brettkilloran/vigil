"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { CanvasDebugInspectorShell } from "@/src/components/ui/CanvasDebugInspectorShell";

const meta = {
  component: CanvasDebugInspectorShell,
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
  parameters: {
    docs: {
      description: {
        component:
          "Collapsible chrome aligned with the canvas tool rail — used by the links debug panel and similar inspectors.",
      },
    },
    layout: "centered",
  },
  title: "Heartgarden/Product UI/Canvas/Debug inspector shell",
} satisfies Meta<typeof CanvasDebugInspectorShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  args: {
    children: (
      <p className="text-[var(--vigil-muted)] text-sm">
        Expand the bug button to reveal this body.
      </p>
    ),
    defaultOpen: false,
    storageKey: "sb-canvas-debug-shell-collapsed",
    title: "DEBUG // Links",
  },
};

export const Expanded: Story = {
  args: {
    children: (
      <div className="space-y-2 text-[var(--sem-text-secondary)] text-sm">
        <p className="font-medium text-[var(--sem-text-primary)]">
          Sample inspector
        </p>
        <p className="text-[var(--vigil-muted)]">
          Uses the same glass panel styling as the live canvas debug rail.
        </p>
      </div>
    ),
    defaultOpen: true,
    storageKey: "sb-canvas-debug-shell-expanded",
    title: "DEBUG // Links",
  },
};
