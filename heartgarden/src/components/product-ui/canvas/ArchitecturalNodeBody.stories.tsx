"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { ArchitecturalNodeBody } from "@/src/components/foundation/ArchitecturalNodeCard";

const meta: Meta<typeof ArchitecturalNodeBody> = {
  args: {
    documentVariant: "html",
    editable: true,
    html: "<h1>The ring does not forgive nostalgia.</h1><p>Body content with rich text html.</p>",
    nodeId: "story-node",
    onCommitPayload: () => {},
    spellCheck: false,
  },
  argTypes: {
    editable: { control: "boolean" },
    html: { control: "text" },
    onCommitPayload: { control: false },
    spellCheck: { control: "boolean" },
  },
  component: ArchitecturalNodeBody,
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--theme-default-bg)",
          color: "var(--theme-default-text)",
          minHeight: 220,
          width: 360,
        }}
      >
        <Story />
      </div>
    ),
  ],
  title: "Heartgarden/Product UI/Canvas/Node body",
};

export default meta;
type Story = StoryObj<typeof ArchitecturalNodeBody>;

export const Default: Story = {};
