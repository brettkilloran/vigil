"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useRef } from "react";

import { Button } from "@/src/components/design-system/primitives/button";

import {
  VigilBootFlowerGarden,
  type VigilBootFlowerGardenHandle,
} from "./vigil-boot-flower-garden";

function FlowerGardenStage() {
  const ref = useRef<VigilBootFlowerGardenHandle>(null);

  return (
    <div
      style={{
        background: "var(--sem-bg-canvas,#050608)",
        minHeight: "100vh",
        position: "relative",
      }}
    >
      <VigilBootFlowerGarden active ref={ref} />
      <div
        style={{
          display: "flex",
          gap: 8,
          left: 16,
          position: "absolute",
          top: 16,
        }}
      >
        <Button
          onClick={() => ref.current?.clearAll()}
          size="sm"
          style={{
            background: "var(--sem-surface-elevated)",
            border: "1px solid var(--sem-border-strong)",
            borderRadius: 8,
            color: "var(--sem-text-primary)",
            padding: "6px 10px",
          }}
          tone="solid"
          variant="default"
        >
          Clear all
        </Button>
      </div>
    </div>
  );
}

const meta = {
  component: VigilBootFlowerGarden,
  parameters: {
    docs: {
      description: {
        component: "Standalone garden renderer used by the boot experience.",
      },
    },
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Flowers/Boot flower garden",
} satisfies Meta<typeof VigilBootFlowerGarden>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  args: {
    active: true,
  },
  render: () => <FlowerGardenStage />,
};
