"use client";

import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";

import {
  ArchitecturalLoreReviewPanel,
  type VaultReviewDraft,
  type VaultReviewIssue,
} from "@/src/components/foundation/ArchitecturalLoreReviewPanel";

const sampleDraft: VaultReviewDraft = {
  title: "Witness ledger excerpt",
  bodyText:
    "Cross-index of witness names and conflict flags. Tone is in-world but references a mechanic as if canon.",
  excludeItemId: "00000000-0000-4000-8000-000000000001",
  targetLabel: "Welcome to this board",
};

const sampleIssues: VaultReviewIssue[] = [
  {
    summary: "Rules language mixed with fiction",
    severity: "warn",
    details: "Phrases like “roll initiative” read as OOC unless framed as diegetic.",
    handlingHint: "Rephrase or move to GM layer.",
  },
  {
    summary: "Timeline ambiguity",
    severity: "info",
    details: "It is unclear whether the blackout is past or ongoing.",
  },
];

const meta = {
  title: "Heartgarden/Product UI/Lore/Vault review panel",
  component: ArchitecturalLoreReviewPanel,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Focus-mode “vault review” sheet: consistency pass, semantic summary, and tag chips (calls `/api` only when you run analysis in the real app).",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-[100vh] bg-[var(--sem-bg-canvas,#080a0f)] p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArchitecturalLoreReviewPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoDraft: Story = {
  args: {
    open: true,
    onClose: fn(),
    draft: null,
    onRunAnalysis: fn(),
    onAppendTags: async () => true,
    loading: false,
    error: null,
    issues: [],
    suggestedNoteTags: [],
    semanticSummary: null,
  },
};

export const ReadyToAnalyze: Story = {
  args: {
    open: true,
    onClose: fn(),
    draft: sampleDraft,
    onRunAnalysis: fn(),
    onAppendTags: async () => true,
    loading: false,
    error: null,
    issues: [],
    suggestedNoteTags: ["uncertain_canon", "needs_crosslink"],
    semanticSummary: null,
  },
};

export const Analyzing: Story = {
  args: {
    open: true,
    onClose: fn(),
    draft: sampleDraft,
    onRunAnalysis: fn(),
    onAppendTags: async () => true,
    loading: true,
    error: null,
    issues: [],
    suggestedNoteTags: [],
    semanticSummary: null,
  },
};

export const WithResults: Story = {
  args: {
    open: true,
    onClose: fn(),
    draft: sampleDraft,
    onRunAnalysis: fn(),
    onAppendTags: async () => true,
    loading: false,
    error: null,
    issues: sampleIssues,
    suggestedNoteTags: ["flavor_not_crunch", "gm_note_layer"],
    semanticSummary:
      "Reads as a witness roster with light horror tone; strongest through-line is institutional fatigue rather than plot mechanics.",
  },
};

export const AnalysisError: Story = {
  args: {
    open: true,
    onClose: fn(),
    draft: sampleDraft,
    onRunAnalysis: fn(),
    onAppendTags: async () => true,
    loading: false,
    error: "Could not reach the model — check API configuration.",
    issues: [],
    suggestedNoteTags: [],
    semanticSummary: null,
  },
};
