"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import {
  ArchitecturalLoreReviewPanel,
  type VaultReviewDraft,
  type VaultReviewIssue,
} from "@/src/components/foundation/ArchitecturalLoreReviewPanel";

const sampleDraft: VaultReviewDraft = {
  bodyText:
    "Cross-index of witness names and conflict flags. Tone is in-world but references a mechanic as if canon.",
  excludeItemId: "00000000-0000-4000-8000-000000000001",
  targetLabel: "Welcome to this board",
  title: "Witness ledger excerpt",
};

const sampleIssues: VaultReviewIssue[] = [
  {
    details:
      "Phrases like “roll initiative” read as OOC unless framed as diegetic.",
    handlingHint: "Rephrase or move to GM layer.",
    severity: "warn",
    summary: "Rules language mixed with fiction",
  },
  {
    details: "It is unclear whether the blackout is past or ongoing.",
    severity: "info",
    summary: "Timeline ambiguity",
  },
];

const meta = {
  component: ArchitecturalLoreReviewPanel,
  decorators: [
    (Story) => (
      <div className="min-h-[100vh] bg-[var(--sem-bg-canvas,#080a0f)] p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Focus-mode “vault review” sheet: consistency pass, semantic summary, and tag chips (calls `/api` only when you run analysis in the real app).",
      },
    },
    layout: "fullscreen",
  },
  title: "Heartgarden/Product UI/Lore/Vault review panel",
} satisfies Meta<typeof ArchitecturalLoreReviewPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoDraft: Story = {
  args: {
    draft: null,
    error: null,
    issues: [],
    loading: false,
    onAppendTags: async () => true,
    onClose: fn(),
    onRunAnalysis: fn(),
    open: true,
    semanticSummary: null,
    suggestedNoteTags: [],
  },
};

export const ReadyToAnalyze: Story = {
  args: {
    draft: sampleDraft,
    error: null,
    issues: [],
    loading: false,
    onAppendTags: async () => true,
    onClose: fn(),
    onRunAnalysis: fn(),
    open: true,
    semanticSummary: null,
    suggestedNoteTags: ["uncertain_canon", "needs_crosslink"],
  },
};

export const Analyzing: Story = {
  args: {
    draft: sampleDraft,
    error: null,
    issues: [],
    loading: true,
    onAppendTags: async () => true,
    onClose: fn(),
    onRunAnalysis: fn(),
    open: true,
    semanticSummary: null,
    suggestedNoteTags: [],
  },
};

export const WithResults: Story = {
  args: {
    draft: sampleDraft,
    error: null,
    issues: sampleIssues,
    loading: false,
    onAppendTags: async () => true,
    onClose: fn(),
    onRunAnalysis: fn(),
    open: true,
    semanticSummary:
      "Reads as a witness roster with light horror tone; strongest through-line is institutional fatigue rather than plot mechanics.",
    suggestedNoteTags: ["flavor_not_crunch", "gm_note_layer"],
  },
};

export const AnalysisError: Story = {
  args: {
    draft: sampleDraft,
    error: "Could not reach the model — check API configuration.",
    issues: [],
    loading: false,
    onAppendTags: async () => true,
    onClose: fn(),
    onRunAnalysis: fn(),
    open: true,
    semanticSummary: null,
    suggestedNoteTags: [],
  },
};
