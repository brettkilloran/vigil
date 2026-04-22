"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import { useRef } from "react";

import { ArchitecturalParentExitThreshold } from "@/src/components/foundation/ArchitecturalParentExitThreshold";

const meta = {
  title: "Heartgarden/Product UI/Canvas/Parent exit threshold",
  component: ArchitecturalParentExitThreshold,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Top-of-viewport drop well for “eject selection to parent space” when navigating nested folders on the canvas.",
      },
    },
  },
} satisfies Meta<typeof ArchitecturalParentExitThreshold>;

export default meta;
type Story = StoryObj<typeof meta>;

function ThresholdStage(props: {
  visible: boolean;
  hovered: boolean;
  interactive: boolean;
  onActivate?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      className="relative min-h-[220px] w-full max-w-xl rounded-xl border border-[var(--vigil-border)] bg-[var(--sem-bg-canvas,#0a0c12)]"
      style={{ margin: "24px auto" }}
    >
      <div className="p-3 text-xs text-[var(--vigil-muted)]">Viewport top — dashed well below</div>
      <ArchitecturalParentExitThreshold
        ref={ref}
        toolbarBottomPx={0}
        visible={props.visible}
        hovered={props.hovered}
        interactive={props.interactive}
        onActivate={props.interactive ? props.onActivate : undefined}
      />
    </div>
  );
}

export const VisibleIdle: Story = {
  args: { toolbarBottomPx: 0, visible: true, hovered: false, interactive: false },
  render: () => <ThresholdStage visible hovered={false} interactive={false} />,
};

export const Hovered: Story = {
  args: { toolbarBottomPx: 0, visible: true, hovered: true, interactive: false },
  render: () => <ThresholdStage visible hovered interactive={false} />,
};

export const Interactive: Story = {
  args: { toolbarBottomPx: 0, visible: true, hovered: true, interactive: true, onActivate: fn() },
  render: () => {
    const onActivate = fn();
    return <ThresholdStage visible hovered interactive onActivate={onActivate} />;
  },
};

export const Hidden: Story = {
  args: { toolbarBottomPx: 0, visible: false, hovered: false, interactive: false },
  render: () => <ThresholdStage visible={false} hovered={false} interactive={false} />,
};
