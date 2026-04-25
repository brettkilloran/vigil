"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useRef } from "react";
import { fn } from "storybook/test";

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
      <div className="p-3 text-[var(--vigil-muted)] text-xs">
        Viewport top — dashed well below
      </div>
      <ArchitecturalParentExitThreshold
        hovered={props.hovered}
        interactive={props.interactive}
        onActivate={props.interactive ? props.onActivate : undefined}
        ref={ref}
        toolbarBottomPx={0}
        visible={props.visible}
      />
    </div>
  );
}

export const VisibleIdle: Story = {
  args: {
    toolbarBottomPx: 0,
    visible: true,
    hovered: false,
    interactive: false,
  },
  render: () => <ThresholdStage hovered={false} interactive={false} visible />,
};

export const Hovered: Story = {
  args: {
    toolbarBottomPx: 0,
    visible: true,
    hovered: true,
    interactive: false,
  },
  render: () => <ThresholdStage hovered interactive={false} visible />,
};

export const Interactive: Story = {
  args: {
    toolbarBottomPx: 0,
    visible: true,
    hovered: true,
    interactive: true,
    onActivate: fn(),
  },
  render: () => {
    const onActivate = fn();
    return (
      <ThresholdStage hovered interactive onActivate={onActivate} visible />
    );
  },
};

export const Hidden: Story = {
  args: {
    toolbarBottomPx: 0,
    visible: false,
    hovered: false,
    interactive: false,
  },
  render: () => (
    <ThresholdStage hovered={false} interactive={false} visible={false} />
  ),
};
