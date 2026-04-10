"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { HeartgardenMediaPlaceholderImg } from "@/src/components/ui/HeartgardenMediaPlaceholderImg";

const meta: Meta<typeof HeartgardenMediaPlaceholderImg> = {
  title: "Heartgarden/UI/Media placeholder",
  component: HeartgardenMediaPlaceholderImg,
  decorators: [
    (Story) => (
      <div style={{ padding: 32, background: "var(--sem-surface-base)" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    variant: "mediaWell",
    alt: "",
  },
};

export default meta;
type Story = StoryObj<typeof HeartgardenMediaPlaceholderImg>;

export const MediaWell: Story = {
  args: {
    variant: "mediaWell",
    style: { width: 240, height: 160 },
  },
};

export const LoreCredential: Story = {
  args: {
    variant: "loreCredential",
    style: { width: 142, height: 168 },
  },
};

export const Neutral: Story = {
  args: {
    variant: "neutral",
    style: { width: 200, height: 140 },
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <HeartgardenMediaPlaceholderImg variant="mediaWell" alt="" style={{ width: 240, height: 160 }} />
      <HeartgardenMediaPlaceholderImg variant="loreCredential" alt="" style={{ width: 142, height: 168 }} />
      <HeartgardenMediaPlaceholderImg variant="neutral" alt="" style={{ width: 200, height: 140 }} />
    </div>
  ),
};
