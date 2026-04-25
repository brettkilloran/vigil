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
  title: "Heartgarden/Product UI/Flowers/Boot screen",
  component: VigilAppBootScreen,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Pre-canvas gate: ambient flowers (portal host), copy, effects toggle, and optional boot PIN console. Activating runs exit animation in-place; callbacks are mocked here.",
      },
    },
  },
} satisfies Meta<typeof VigilAppBootScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: {
    technicalReady: true,
    onActivate: fn(),
    onExitComplete: fn(),
    flowerPortalContainer: null,
    canvasEffectsEnabled: true,
    onCanvasEffectsEnabledChange: fn(),
    bootGateEnabled: false,
    bootGateStatusReady: true,
  },
  render: () => <BootScreenStage technicalReady />,
};

export const WaitingOnTechnical: Story = {
  args: {
    technicalReady: false,
    onActivate: fn(),
    onExitComplete: fn(),
    flowerPortalContainer: null,
    canvasEffectsEnabled: true,
    onCanvasEffectsEnabledChange: fn(),
    bootGateEnabled: false,
    bootGateStatusReady: true,
  },
  render: () => <BootScreenStage technicalReady={false} />,
};

export const BootPinGate: Story = {
  args: {
    technicalReady: true,
    onActivate: fn(),
    onExitComplete: fn(),
    flowerPortalContainer: null,
    canvasEffectsEnabled: true,
    onCanvasEffectsEnabledChange: fn(),
    bootGateEnabled: true,
    bootGateStatusReady: true,
  },
  render: () => <BootScreenStage bootGateEnabled bootGateStatusReady />,
};
