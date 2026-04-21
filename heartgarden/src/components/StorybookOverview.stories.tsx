import type { Meta, StoryObj } from "@storybook/nextjs";

import { HEARTGARDEN_BRAND_MARK_EMOJI } from "@/src/lib/brand-mark";

const meta = {
  title: "Heartgarden/Overview",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Entry point for Storybook. heartgarden: app directory in git is `heartgarden/` (see docs/NAMING.md); component source is `src/components/`. Global tokens come from `app/globals.css`.",
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
        <strong>UI catalog:</strong>{" "}
        <span style={{ color: "var(--sem-text-secondary)" }}>
          Heartgarden → UI — tokens (including LLM / ingestion <code style={{ fontSize: "0.88em" }}>--sem-*-llm-*</code>),
          shared controls (e.g. Tag, Button), canvas chrome (tool rail, minimap, viewport toast, remote
          presence cursors, link-graph overlay), lore-specific canvas plates (character v11, faction
          Archive-091, location ORDO v7), and full-canvas integration (sorted by name).
        </span>
      </p>
      <p style={{ marginBottom: 0 }}>
        <strong>Experiments:</strong>{" "}
        <span style={{ color: "var(--sem-text-secondary)" }}>
          Heartgarden → Experiments — prototypes (e.g. transition WebGL) not yet wired into the main shell.
        </span>
      </p>
      <p
        style={{
          marginTop: 16,
          marginBottom: 0,
          color: "var(--sem-text-muted)",
          fontSize: "0.92rem",
        }}
      >
        A few surfaces are API-heavy and are not duplicated here: for example the link-graph modal loads{" "}
        <code style={{ fontSize: "0.85em" }}>/api/spaces/…/graph</code>, and the command palette’s remote
        suggestions call <code style={{ fontSize: "0.85em" }}>/api/search/suggest</code> after two
        characters. Use a running Next app to exercise those paths.
      </p>
    </div>
  ),
};
