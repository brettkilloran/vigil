"use client";

import { Copy, Trash } from "@phosphor-icons/react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { fn } from "storybook/test";

import { Button } from "@/src/components/ui/Button";
import {
  ContextMenu,
  type ContextMenuPosition,
} from "@/src/components/ui/ContextMenu";

const meta = {
  component: ContextMenu,
  parameters: {
    docs: {
      description: {
        component:
          "Fixed-position menu used on the canvas; closes on outside pointer or Escape.",
      },
    },
    layout: "fullscreen",
  },
  title: "Heartgarden/Design System/Primitives/Context menu",
} satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [],
    onClose: fn(),
    position: { x: 48, y: 48 },
  },
  render: () => {
    const [position, setPosition] = useState<ContextMenuPosition>({
      x: 48,
      y: 48,
    });
    return (
      <div className="min-h-[200px] p-4">
        <p className="mb-3 max-w-md text-[var(--sem-text-muted)] text-sm">
          Pointer-down outside the menu or Escape dismisses it. Reopen from the
          button.
        </p>
        <Button
          onClick={() => setPosition({ x: 48, y: 48 })}
          size="sm"
          tone="glass"
          variant="default"
        >
          Show menu
        </Button>
        <ContextMenu
          items={[
            {
              icon: <Copy className="size-[18px]" weight="bold" />,
              label: "Copy link",
              onSelect: fn(),
            },
            {
              icon: <Trash className="size-[18px]" weight="bold" />,
              label: "Remove",
              onSelect: fn(),
            },
            { disabled: true, label: "Disabled row", onSelect: fn() },
          ]}
          onClose={() => setPosition(null)}
          position={position}
        />
      </div>
    );
  },
};
