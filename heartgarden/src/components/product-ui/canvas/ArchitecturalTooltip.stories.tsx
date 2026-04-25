"use client";

import { CursorClick, Info } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalButton } from "@/src/components/foundation/ArchitecturalButton";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";

const surface = {
  alignItems: "center",
  background: "var(--sem-surface-base)",
  display: "flex",
  justifyContent: "center",
  minHeight: 200,
  padding: 48,
} as const;

const meta: Meta<typeof ArchitecturalTooltip> = {
  argTypes: {
    associateDescription: { control: "boolean" },
    children: { control: false },
    content: { control: "text" },
    delayMs: { control: { max: 2000, min: 0, step: 40, type: "number" } },
    disabled: { control: "boolean" },
    side: { control: "radio", options: ["top", "bottom", "left", "right"] },
  },
  component: ArchitecturalTooltip,
  parameters: {
    docs: {
      description: {
        component:
          "Frosted chrome tooltip aligned with save popover tokens (`--cmp-tooltip-*`, `--ui-glass-*`). Renders in the vigil portal root; use for shell controls instead of the native `title` attribute.",
      },
    },
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Canvas/Tooltip",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalTooltip>;

export const Playground: Story = {
  args: {
    associateDescription: false,
    content: "Short hint — same glass vocabulary as the top save strip.",
    delayMs: 280,
    disabled: false,
    side: "top",
  },
  render: (args) => (
    <div style={surface}>
      <ArchitecturalTooltip {...args}>
        <ArchitecturalButton aria-label="Demo tool" size="icon" tone="glass">
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
        associateDescription
        content="Last successful write to Neon includes debounced note edits. Undo applies to the canvas in memory only — it does not revert the database. Click the control for export and version notes."
        delayMs={300}
        side="bottom"
      >
        <ArchitecturalButton
          aria-label="Save and database status"
          leadingIcon={<Info aria-hidden size={16} weight="bold" />}
          size="menu"
          tone="glass"
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
        alignItems: "center",
        display: "grid",
        gap: 72,
        gridTemplateColumns: "1fr 1fr",
        justifyItems: "center",
        minHeight: 380,
      }}
    >
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <ArchitecturalTooltip
          content={`Preferred side: ${side}`}
          delayMs={200}
          key={side}
          side={side}
        >
          <ArchitecturalButton
            aria-label={`Open ${side} tooltip demo`}
            size="icon"
            tone="glass"
          >
            <span style={{ fontSize: 11, fontWeight: 600 }}>
              {side[0]?.toUpperCase()}
            </span>
          </ArchitecturalButton>
        </ArchitecturalTooltip>
      ))}
    </div>
  ),
};
