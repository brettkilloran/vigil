import type { Meta, StoryObj } from "@storybook/nextjs";

import { HEARTGARDEN_BRAND_MARK_EMOJI } from "@/src/lib/brand-mark";

const meta = {
  title: "Heartgarden/Overview",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Entry point for Storybook. heartgarden: app directory in git is `vigil/` (see docs/NAMING.md); component source is `src/components/`. Global tokens come from `app/globals.css`.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AboutThisStorybook: Story = {
  render: () => (
    <div
      style={{
        maxWidth: 520,
        textAlign: "left",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "var(--sem-text-primary)",
        lineHeight: 1.55,
      }}
    >
      <h1 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: 12 }}>
        {HEARTGARDEN_BRAND_MARK_EMOJI} heartgarden · Storybook
      </h1>
      <p style={{ color: "var(--sem-text-muted)", marginBottom: 16 }}>
        This Storybook documents UI used by the heartgarden canvas app: design tokens, shell
        primitives, and shared components. It is not a second product — it mirrors what ships in the
        Next app.
      </p>
      <p style={{ marginBottom: 8 }}>
        <strong>Tokens:</strong>{" "}
        <span style={{ color: "var(--sem-text-secondary)" }}>
          Heartgarden → Design System → Tokens Source of Truth
        </span>
      </p>
      <p style={{ marginBottom: 0 }}>
        <strong>Canvas shell:</strong>{" "}
        <span style={{ color: "var(--sem-text-secondary)" }}>
          Heartgarden → Architectural Shell → …
        </span>
      </p>
    </div>
  ),
};
