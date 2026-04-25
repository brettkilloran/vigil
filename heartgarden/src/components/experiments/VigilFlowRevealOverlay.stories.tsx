"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { VigilFlowRevealOverlay } from "@/src/components/transition-experiment/VigilFlowRevealOverlay";

/**
 * WebGL flow reveal used on the real canvas. Only `scenario="default"` renders; non-default
 * scenarios skip the overlay in the app, so most stories keep `default`.
 */
const meta = {
  args: {
    bootstrapPending: false,
    navActive: true,
    scenario: "default",
    sessionActivated: false,
  },
  component: VigilFlowRevealOverlay,
  decorators: [
    (Story) => (
      <div
        style={{
          background:
            "linear-gradient(160deg, var(--sem-bg-canvas, #0f1218) 0%, #1a1520 100%)",
          minHeight: "100vh",
        }}
      >
        <Story />
        <p
          style={{
            bottom: 24,
            color: "var(--sem-text-muted, rgba(255,255,255,0.45))",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            fontSize: 13,
            left: 24,
            margin: 0,
            pointerEvents: "none",
            position: "fixed",
            zIndex: 1,
          }}
        >
          Sample content behind the overlay (fixed z below the canvas stack).
        </p>
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Prototype transition veil (WebGL). Renders nothing when `scenario` is not `default` or when the user prefers reduced motion.",
      },
    },
    layout: "fullscreen",
  },
  title: "Heartgarden/Experiments/Flow reveal overlay",
} satisfies Meta<typeof VigilFlowRevealOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IdleBeforeActivation: Story = {
  args: {
    bootstrapPending: false,
    navActive: true,
    sessionActivated: false,
  },
};

export const SessionActivatedReveal: Story = {
  args: {
    bootstrapPending: false,
    navActive: true,
    sessionActivated: true,
  },
};

export const BootstrapPending: Story = {
  args: {
    bootstrapPending: true,
    navActive: true,
    sessionActivated: false,
  },
};

export const NonDefaultScenarioSkipsOverlay: Story = {
  args: {
    navActive: true,
    scenario: "corrupt",
    sessionActivated: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Matches app behavior: overlay does not mount for corrupt (or any non-default) scenarios.",
      },
    },
  },
};
