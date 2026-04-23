"use client";

import { useRef } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";

import { Button } from "@/src/components/design-system/primitives/Button";
import { VigilBootFlowerGarden, type VigilBootFlowerGardenHandle } from "./VigilBootFlowerGarden";

function FlowerGardenStage() {
  const ref = useRef<VigilBootFlowerGardenHandle>(null);

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "var(--sem-bg-canvas,#050608)" }}>
      <VigilBootFlowerGarden ref={ref} active />
      <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 8 }}>
        <Button
          variant="default"
          tone="solid"
          size="sm"
          onClick={() => ref.current?.clearAll()}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--sem-border-strong)",
            background: "var(--sem-surface-elevated)",
            color: "var(--sem-text-primary)",
          }}
        >
          Clear all
        </Button>
      </div>
    </div>
  );
}

const meta = {
  title: "Heartgarden/Product UI/Flowers/Boot flower garden",
  component: VigilBootFlowerGarden,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Standalone garden renderer used by the boot experience.",
      },
    },
  },
} satisfies Meta<typeof VigilBootFlowerGarden>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  args: {
    active: true,
  },
  render: () => <FlowerGardenStage />,
};

