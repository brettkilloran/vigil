"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { HeartgardenMediaPlaceholderImg } from "@/src/components/ui/HeartgardenMediaPlaceholderImg";

const meta: Meta<typeof HeartgardenMediaPlaceholderImg> = {
  title: "Heartgarden/Design System/Primitives/Media placeholder",
  component: HeartgardenMediaPlaceholderImg,
  decorators: [
    (Story) => (
      <div style={{ padding: 32, background: "var(--sem-surface-base)" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    variant: "neutral",
    alt: "",
  },
};

export default meta;
type Story = StoryObj<typeof HeartgardenMediaPlaceholderImg>;

export const NeutralDefault: Story = {
  args: {
    variant: "neutral",
    style: { width: 240, height: 160 },
  },
};

export const NeutralPortrait: Story = {
  args: {
    variant: "neutral",
    style: { width: 142, height: 168 },
  },
};

export const NeutralCompact: Story = {
  args: {
    variant: "neutral",
    style: { width: 200, height: 140 },
  },
};
