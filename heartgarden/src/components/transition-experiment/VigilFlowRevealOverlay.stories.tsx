"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { VigilFlowRevealOverlay } from "./VigilFlowRevealOverlay";

/**
 * WebGL flow reveal used on the real canvas. Only `scenario="default"` renders; non-default
 * scenarios skip the overlay in the app, so most stories keep `default`.
 */
const meta = {
  title: "Heartgarden/Experiments/Flow reveal overlay",
  component: VigilFlowRevealOverlay,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Prototype transition veil (WebGL). Renders nothing when `scenario` is not `default` or when the user prefers reduced motion.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          minHeight: "100vh",
          background:
            "linear-gradient(160deg, var(--sem-bg-canvas, #0f1218) 0%, #1a1520 100%)",
        }}
      >
        <Story />
        <p
          style={{
            position: "fixed",
            bottom: 24,
            left: 24,
            margin: 0,
            fontSize: 13,
            color: "var(--sem-text-muted, rgba(255,255,255,0.45))",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          Sample content behind the overlay (fixed z below the canvas stack).
        </p>
      </div>
    ),
  ],
  args: {
    scenario: "default",
    sessionActivated: false,
    navActive: true,
    bootstrapPending: false,
  },
} satisfies Meta<typeof VigilFlowRevealOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IdleBeforeActivation: Story = {
  args: {
    sessionActivated: false,
    navActive: true,
    bootstrapPending: false,
  },
};

export const SessionActivatedReveal: Story = {
  args: {
    sessionActivated: true,
    navActive: true,
    bootstrapPending: false,
  },
};

export const BootstrapPending: Story = {
  args: {
    sessionActivated: false,
    navActive: true,
    bootstrapPending: true,
  },
};

export const NonDefaultScenarioSkipsOverlay: Story = {
  args: {
    scenario: "corrupt",
    sessionActivated: true,
    navActive: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Matches app behavior: overlay does not mount for corrupt (or any non-default) scenarios.",
      },
    },
  },
};
