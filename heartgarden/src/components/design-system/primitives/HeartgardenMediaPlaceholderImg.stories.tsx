"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { HeartgardenMediaPlaceholderImg } from "@/src/components/ui/HeartgardenMediaPlaceholderImg";

const meta: Meta<typeof HeartgardenMediaPlaceholderImg> = {
  args: {
    alt: "",
    variant: "neutral",
  },
  component: HeartgardenMediaPlaceholderImg,
  decorators: [
    (Story) => (
      <div style={{ background: "var(--sem-surface-base)", padding: 32 }}>
        <Story />
      </div>
    ),
  ],
  title: "Heartgarden/Design System/Primitives/Media placeholder",
};

export default meta;
type Story = StoryObj<typeof HeartgardenMediaPlaceholderImg>;

export const NeutralDefault: Story = {
  args: {
    style: { height: 160, width: 240 },
    variant: "neutral",
  },
};

export const NeutralPortrait: Story = {
  args: {
    style: { height: 168, width: 142 },
    variant: "neutral",
  },
};

export const NeutralCompact: Story = {
  args: {
    style: { height: 140, width: 200 },
    variant: "neutral",
  },
};
