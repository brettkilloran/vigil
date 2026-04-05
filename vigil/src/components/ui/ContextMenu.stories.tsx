"use client";

import { Copy, Trash } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { useState } from "react";

import {
  ContextMenu,
  type ContextMenuPosition,
} from "@/src/components/ui/ContextMenu";
import { Button } from "@/src/components/ui/Button";

const meta = {
  title: "Heartgarden/UI/Context menu",
  component: ContextMenu,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Fixed-position menu used on the canvas; closes on outside pointer or Escape.",
      },
    },
  },
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [position, setPosition] = useState<ContextMenuPosition>({ x: 48, y: 48 });
    return (
      <div className="min-h-[200px] p-4">
        <p className="mb-3 max-w-md text-sm text-[var(--sem-text-muted)]">
          Pointer-down outside the menu or Escape dismisses it. Reopen from the button.
        </p>
        <Button size="sm" variant="neutral" tone="glass" onClick={() => setPosition({ x: 48, y: 48 })}>
          Show menu
        </Button>
        <ContextMenu
          position={position}
          onClose={() => setPosition(null)}
          items={[
            {
              label: "Copy link",
              icon: <Copy weight="bold" />,
              onSelect: fn(),
            },
            {
              label: "Remove",
              icon: <Trash weight="bold" />,
              onSelect: fn(),
            },
            { label: "Disabled row", onSelect: fn(), disabled: true },
          ]}
        />
      </div>
    );
  },
};
