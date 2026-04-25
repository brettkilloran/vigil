import type { Meta, StoryObj } from "@storybook/nextjs";

import { HEARTGARDEN_BRAND_MARK_EMOJI } from "@/src/lib/brand-mark";

const meta = {
  /** Stable id so bookmarks / deep links keep working after `title` path changes. */
  id: "heartgarden-overview",
  parameters: {
    docs: {
      description: {
        component:
          "Entry point for Storybook. heartgarden: app directory in git is `heartgarden/` (see docs/NAMING.md); component source is `src/components/`. Global tokens come from `app/globals.css`.",
      },
    },
    layout: "centered",
  },
  title: "Heartgarden/Design System/Overview",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const AboutThisStorybook: Story = {
  render: () => (
    <div
      style={{
        color: "var(--sem-text-primary)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        lineHeight: 1.55,
        maxWidth: 520,
        textAlign: "left",
      }}
    >
      <h1 style={{ fontSize: "1.35rem", fontWeight: 700, marginBottom: 12 }}>
        {HEARTGARDEN_BRAND_MARK_EMOJI} heartgarden · Storybook
      </h1>
      <p style={{ color: "var(--sem-text-muted)", marginBottom: 16 }}>
        This Storybook documents UI used by the heartgarden canvas app: design
        tokens, shell primitives, and shared components. It is not a second
        product — it mirrors what ships in the Next app.
      </p>
      <p style={{ marginBottom: 8 }}>
        <strong>Design System:</strong>{" "}
        <span style={{ color: "var(--sem-text-secondary)" }}>
          Heartgarden → Design System — overview, tokens (including LLM /
          ingestion <code style={{ fontSize: "0.88em" }}>--sem-*-llm-*</code>),
          and shared primitives (Button, Tag, inputs, and foundational
          controls).
        </span>
      </p>
      <p style={{ marginBottom: 8 }}>
        <strong>Product UI:</strong>{" "}
        <span style={{ color: "var(--sem-text-secondary)" }}>
          Heartgarden → Product UI — canvas shell/chrome surfaces, lore-focused
          plates and review panels, and flower-specific boot interactions.
        </span>
      </p>
      <p style={{ marginBottom: 0 }}>
        <strong>Experiments:</strong>{" "}
        <span style={{ color: "var(--sem-text-secondary)" }}>
          Heartgarden → Experiments — prototypes (e.g. transition WebGL) not yet
          wired into the main shell.
        </span>
      </p>
      <p
        style={{
          color: "var(--sem-text-muted)",
          fontSize: "0.92rem",
          marginBottom: 0,
          marginTop: 16,
        }}
      >
        A few surfaces are API-heavy and are not duplicated here: for example
        the link-graph modal loads{" "}
        <code style={{ fontSize: "0.85em" }}>/api/spaces/…/graph</code>, and the
        command palette’s remote suggestions call{" "}
        <code style={{ fontSize: "0.85em" }}>/api/search/suggest</code> after
        two characters. Use a running Next app to exercise those paths.
      </p>
    </div>
  ),
};
