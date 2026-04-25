"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { fn } from "storybook/test";

import { BufferedContentEditable } from "@/src/components/editing/buffered-content-editable";

const meta = {
  component: BufferedContentEditable,
  parameters: {
    docs: {
      description: {
        component:
          "Rich inline body editing with the same commit/cancel semantics as `BufferedTextInput`, used inside canvas nodes.",
      },
    },
    layout: "centered",
  },
  title: "Heartgarden/Design System/Primitives/Buffered content editable",
} satisfies Meta<typeof BufferedContentEditable>;

export default meta;
type Story = StoryObj<typeof meta>;

const logBodyCommit = fn();

export const PlainText: Story = {
  args: {
    onCommit: fn(),
    plainText: true,
    value: "Edit this line. Blur commits; Escape cancels.",
  },
  render: () => {
    const [value, setValue] = useState(
      "Edit this line. Blur commits; Escape cancels."
    );
    return (
      <div className="w-[min(100vw-32px,420px)] space-y-2">
        <BufferedContentEditable
          className="min-h-[88px] rounded-lg border border-[var(--vigil-border)] bg-[var(--vigil-elevated)] px-3 py-2 text-[var(--sem-text-primary)] text-sm leading-relaxed outline-none focus:ring-2 focus:ring-[var(--sem-accent-primary)]"
          onCommit={(next) => {
            logBodyCommit(next);
            setValue(next);
          }}
          plainText
          value={value}
        />
        <p className="text-[var(--vigil-muted)] text-xs">
          Mirrors node body editing behavior without TipTap HTML.
        </p>
      </div>
    );
  },
};
