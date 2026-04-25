"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { useState } from "react";
import { fn } from "storybook/test";

import { VigilAppBootScreen } from "./VigilAppBootScreen";

const mockActivate = fn();
const mockExitComplete = fn();
const mockEffectsChange = fn();

function BootScreenStage(props: {
  bootGateEnabled?: boolean;
  bootGateStatusReady?: boolean;
  technicalReady?: boolean;
}) {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  return (
    <div
      className="relative min-h-[100vh] w-full overflow-hidden bg-[var(--sem-bg-canvas,#050608)]"
      data-storybook-boot-root
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        data-storybook-flower-portal-host
        ref={(el) => {
          setPortalHost((prev) => (prev === el ? prev : el));
        }}
      />
      {portalHost ? (
        <VigilAppBootScreen
          bootGateEnabled={props.bootGateEnabled ?? false}
          bootGateStatusReady={props.bootGateStatusReady ?? true}
          canvasEffectsEnabled
          flowerPortalContainer={portalHost}
          onActivate={mockActivate}
          onCanvasEffectsEnabledChange={mockEffectsChange}
          onExitComplete={mockExitComplete}
          technicalReady={props.technicalReady ?? true}
        />
      ) : null}
    </div>
  );
}

const meta = {
  component: VigilAppBootScreen,
  parameters: {
    docs: {
      description: {
        component:
          "Pre-canvas gate: ambient flowers (portal host), copy, effects toggle, and optional boot PIN console. Activating runs exit animation in-place; callbacks are mocked here.",
      },
    },
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Flowers/Boot screen",
} satisfies Meta<typeof VigilAppBootScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: {
    bootGateEnabled: false,
    bootGateStatusReady: true,
    canvasEffectsEnabled: true,
    flowerPortalContainer: null,
    onActivate: fn(),
    onCanvasEffectsEnabledChange: fn(),
    onExitComplete: fn(),
    technicalReady: true,
  },
  render: () => <BootScreenStage technicalReady />,
};

export const WaitingOnTechnical: Story = {
  args: {
    bootGateEnabled: false,
    bootGateStatusReady: true,
    canvasEffectsEnabled: true,
    flowerPortalContainer: null,
    onActivate: fn(),
    onCanvasEffectsEnabledChange: fn(),
    onExitComplete: fn(),
    technicalReady: false,
  },
  render: () => <BootScreenStage technicalReady={false} />,
};

export const BootPinGate: Story = {
  args: {
    bootGateEnabled: true,
    bootGateStatusReady: true,
    canvasEffectsEnabled: true,
    flowerPortalContainer: null,
    onActivate: fn(),
    onCanvasEffectsEnabledChange: fn(),
    onExitComplete: fn(),
    technicalReady: true,
  },
  render: () => <BootScreenStage bootGateEnabled bootGateStatusReady />,
};
