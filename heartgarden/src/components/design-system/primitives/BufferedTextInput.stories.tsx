"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { fn } from "storybook/test";

import { BufferedTextInput } from "@/src/components/editing/BufferedTextInput";

const meta = {
  component: BufferedTextInput,
  parameters: {
    docs: {
      description: {
        component:
          "Title-style input: local draft while editing; commits on blur or Enter; Escape cancels to last committed value (`useEditorSession`).",
      },
    },
    layout: "centered",
  },
  title: "Heartgarden/Design System/Primitives/Buffered text input",
} satisfies Meta<typeof BufferedTextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

const logTextCommit = fn();

export const Default: Story = {
  args: {
    onCommit: fn(),
    value: "Double-click to rename",
  },
  render: () => {
    const [value, setValue] = useState("Double-click to rename");
    return (
      <div className="w-[min(100vw-32px,360px)] space-y-2">
        <label className="block font-medium text-[var(--sem-text-muted)] text-xs">
          Committed value
        </label>
        <BufferedTextInput
          className="w-full rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-elevated)] px-3 py-2 text-[var(--sem-text-primary)] text-sm outline-none focus:ring-2 focus:ring-[var(--sem-accent-primary)]"
          onCommit={(next) => {
            logTextCommit(next);
            setValue(next);
          }}
          value={value}
        />
        <p className="text-[var(--vigil-muted)] text-xs">
          Blur or Enter commits; Esc reverts.
        </p>
      </div>
    );
  },
};
