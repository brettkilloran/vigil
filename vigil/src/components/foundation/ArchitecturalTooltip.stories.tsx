"use client";

import { CursorClick, Info } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";

const surface = {
  minHeight: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 48,
  background: "var(--sem-surface-base)",
} as const;

const meta: Meta<typeof ArchitecturalTooltip> = {
  title: "Heartgarden/Design System/Tooltip",
  component: ArchitecturalTooltip,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Frosted chrome tooltip aligned with save popover tokens (`--cmp-tooltip-*`, `--ui-glass-*`). Renders in the vigil portal root; use for shell controls instead of the native `title` attribute.",
      },
    },
  },
  argTypes: {
    content: { control: "text" },
    side: { control: "radio", options: ["top", "bottom", "left", "right"] },
    delayMs: { control: { type: "number", min: 0, max: 2000, step: 40 } },
    disabled: { control: "boolean" },
    associateDescription: { control: "boolean" },
    children: { control: false },
  },
};

export default meta;
type Story = StoryObj<typeof ArchitecturalTooltip>;

export const Playground: Story = {
  args: {
    content: "Short hint — same glass vocabulary as the top save strip.",
    side: "top",
    delayMs: 280,
    disabled: false,
    associateDescription: false,
  },
  render: (args) => (
    <div style={surface}>
      <ArchitecturalTooltip {...args}>
        <ArchitecturalButton size="icon" tone="glass" aria-label="Demo tool">
          <CursorClick size={18} />
        </ArchitecturalButton>
      </ArchitecturalTooltip>
    </div>
  ),
};

export const LongHelpText: Story = {
  render: () => (
    <div style={surface}>
      <ArchitecturalTooltip
        side="bottom"
        delayMs={300}
        associateDescription
        content="Last successful write to Neon includes debounced note edits. Undo applies to the canvas in memory only — it does not revert the database. Click the control for export and version notes."
      >
        <ArchitecturalButton
          size="menu"
          tone="glass"
          leadingIcon={<Info size={16} weight="bold" aria-hidden />}
          aria-label="Save and database status"
        >
          Sync status
        </ArchitecturalButton>
      </ArchitecturalTooltip>
    </div>
  ),
};

export const PlacementGrid: Story = {
  render: () => (
    <div
      style={{
        ...surface,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 72,
        minHeight: 380,
        alignItems: "center",
        justifyItems: "center",
      }}
    >
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <ArchitecturalTooltip key={side} content={`Preferred side: ${side}`} side={side} delayMs={200}>
          <ArchitecturalButton size="icon" tone="glass" aria-label={`Open ${side} tooltip demo`}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{side[0]!.toUpperCase()}</span>
          </ArchitecturalButton>
        </ArchitecturalTooltip>
      ))}
    </div>
  ),
};
