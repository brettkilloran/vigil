import type { HgStructuredBody } from "@/src/lib/hg-doc/structured-body";

export interface StructuredBodyEvalFixture {
  expect: {
    minH1: number;
    minH2: number;
    minH3: number;
  };
  input: HgStructuredBody;
  name: string;
  title: string;
}

export const STRUCTURED_BODY_EVAL_FIXTURES: StructuredBodyEvalFixture[] = [
  {
    name: "short-single-topic",
    title: "Scout Notes",
    input: {
      blocks: [
        {
          kind: "paragraph",
          text: "Two scouts reported quiet waters near Vanphimwell.",
        },
        { kind: "paragraph", text: "No hostile movement detected at dawn." },
      ],
    },
    expect: { minH1: 1, minH2: 0, minH3: 0 },
  },
  {
    name: "medium-multi-topic",
    title: "Session 12 Debrief",
    input: {
      blocks: [
        { kind: "heading", level: 2, text: "Travel" },
        {
          kind: "paragraph",
          text: "The convoy reached the trench edge by dusk.",
        },
        { kind: "heading", level: 2, text: "Conflict" },
        {
          kind: "paragraph",
          text: "A patrol skirmish slowed progress for one hour.",
        },
        { kind: "heading", level: 2, text: "Aftermath" },
        {
          kind: "paragraph",
          text: "Recovered charts were cataloged in the river archive.",
        },
      ],
    },
    expect: { minH1: 1, minH2: 3, minH3: 0 },
  },
  {
    name: "malformed-h3-before-h2",
    title: "Ops Handbook",
    input: {
      blocks: [
        { kind: "heading", level: 3, text: "Dispatch Timing" },
        { kind: "paragraph", text: "Signals go out at first bell." },
      ],
    },
    expect: { minH1: 1, minH2: 1, minH3: 0 },
  },
];
