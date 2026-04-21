"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { useState } from "react";

import { BufferedTextInput } from "@/src/components/editing/BufferedTextInput";

const meta = {
  title: "Heartgarden/UI/Buffered text input",
  component: BufferedTextInput,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Title-style input: local draft while editing; commits on blur or Enter; Escape cancels to last committed value (`useEditorSession`).",
      },
    },
  },
} satisfies Meta<typeof BufferedTextInput>;

export default meta;
type Story = StoryObj<typeof meta>;

const logTextCommit = fn();

export const Default: Story = {
  args: {
    value: "Double-click to rename",
    onCommit: fn(),
  },
  render: () => {
    const [value, setValue] = useState("Double-click to rename");
    return (
      <div className="w-[min(100vw-32px,360px)] space-y-2">
        <label className="block text-xs font-medium text-[var(--sem-text-muted)]">Committed value</label>
        <BufferedTextInput
          className="w-full rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-elevated)] px-3 py-2 text-sm text-[var(--sem-text-primary)] outline-none focus:ring-2 focus:ring-[var(--sem-accent-primary)]"
          value={value}
          onCommit={(next) => {
            logTextCommit(next);
            setValue(next);
          }}
        />
        <p className="text-xs text-[var(--vigil-muted)]">Blur or Enter commits; Esc reverts.</p>
      </div>
    );
  },
};
