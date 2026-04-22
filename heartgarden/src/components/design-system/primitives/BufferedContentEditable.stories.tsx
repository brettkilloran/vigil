"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { useState } from "react";

import { BufferedContentEditable } from "@/src/components/editing/BufferedContentEditable";

const meta = {
  title: "Heartgarden/Design System/Primitives/Buffered content editable",
  component: BufferedContentEditable,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Rich inline body editing with the same commit/cancel semantics as `BufferedTextInput`, used inside canvas nodes.",
      },
    },
  },
} satisfies Meta<typeof BufferedContentEditable>;

export default meta;
type Story = StoryObj<typeof meta>;

const logBodyCommit = fn();

export const PlainText: Story = {
  args: {
    value: "Edit this line. Blur commits; Escape cancels.",
    plainText: true,
    onCommit: fn(),
  },
  render: () => {
    const [value, setValue] = useState("Edit this line. Blur commits; Escape cancels.");
    return (
      <div className="w-[min(100vw-32px,420px)] space-y-2">
        <BufferedContentEditable
          plainText
          className="min-h-[88px] rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-elevated)] px-3 py-2 text-sm leading-relaxed text-[var(--sem-text-primary)] outline-none focus:ring-2 focus:ring-[var(--sem-accent-primary)]"
          value={value}
          onCommit={(next) => {
            logBodyCommit(next);
            setValue(next);
          }}
        />
        <p className="text-xs text-[var(--vigil-muted)]">Mirrors node body editing behavior without TipTap HTML.</p>
      </div>
    );
  },
};
