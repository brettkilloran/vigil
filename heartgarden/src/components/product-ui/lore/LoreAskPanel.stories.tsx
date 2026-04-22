"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import { LoreAskPanel } from "@/src/components/ui/LoreAskPanel";

const meta = {
  title: "Heartgarden/Product UI/Lore/Lore ask panel",
  component: LoreAskPanel,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Cmd+K “Ask lore” surface. Submitting the form calls `POST /api/lore/query` in the app; this story only documents layout and empty state.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-[100vh] bg-[var(--sem-bg-canvas,#080a0f)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LoreAskPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    open: true,
    onClose: fn(),
    spaceId: "00000000-0000-4000-8000-000000000099",
    spaceScopedAllowed: true,
    onOpenSource: fn(),
  },
};
