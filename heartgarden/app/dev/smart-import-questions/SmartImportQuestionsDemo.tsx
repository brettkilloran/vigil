"use client";

import { useMemo, useState } from "react";

import canvasStyles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { Button } from "@/src/components/ui/Button";
import type {
  ClarificationAnswer,
  LoreImportClarificationItem,
} from "@/src/lib/lore-import-plan-types";

import styles from "./smart-import-questions-demo.module.css";

/**
 * Visual preview of the Smart Import question wizard flow.
 * Mirrors the JSX used in `ArchitecturalCanvasApp.tsx` so design iterations can
 * happen without running a full import pipeline.
 * Open: /dev/smart-import-questions
 */

type OtherFollowUp = {
  clarificationId: string;
  title: string;
  question: string;
  otherText: string;
  options: { id: string; label: string; recommended?: boolean }[];
};

function upsertAnswer(
  prev: ClarificationAnswer[],
  next: ClarificationAnswer,
): ClarificationAnswer[] {
  return [...prev.filter((a) => a.clarificationId !== next.clarificationId), next];
}

function recommendedOptionId(c: LoreImportClarificationItem): string | undefined {
  const r = c.options.find((o) => o.recommended);
  return r?.id ?? c.options[0]?.id;
}

function isAnswered(a: ClarificationAnswer | undefined): boolean {
  if (!a) return false;
  if (a.resolution === "answered") return (a.selectedOptionIds?.length ?? 0) > 0;
  if (a.resolution === "skipped_default") return !!a.skipDefaultOptionId;
  if (a.resolution === "other_text") return (a.otherText?.trim().length ?? 0) >= 4;
  if (a.resolution === "skipped_best_judgement") return true;
  return false;
}

/* ---------- Sample clarifications (planPatchHint = no_op keeps types honest) ---------- */

const noOp = { op: "no_op" as const };

const SINGLE_SELECT: LoreImportClarificationItem = {
  id: "11111111-1111-4111-8111-111111111111",
  category: "structure",
  severity: "required",
  confidenceScore: 0.38,
  title: "Where should the chapter on the Ember Consortium live?",
  context:
    "The import produced a new folder “Factions › Ember Consortium”, but your vault already has “Guilds › Ember Consortium”. Choose one home so the notes merge cleanly.",
  questionKind: "single_select",
  options: [
    { id: "opt-existing", label: "Merge into Guilds › Ember Consortium", recommended: true, planPatchHint: noOp },
    { id: "opt-new", label: "Keep the new Factions › Ember Consortium folder", planPatchHint: noOp },
    { id: "opt-both", label: "Keep both (link them)", planPatchHint: noOp },
  ],
};

const MULTI_SELECT: LoreImportClarificationItem = {
  id: "22222222-2222-4222-8222-222222222222",
  category: "link_semantics",
  severity: "optional",
  confidenceScore: 0.55,
  title: "Which roles apply to Captain Irell in the Ashen Pact?",
  context: "Pick any that match the source document. Leave empty to fall back on best judgement.",
  questionKind: "multi_select",
  options: [
    { id: "role-founder", label: "Founder", planPatchHint: noOp },
    { id: "role-enforcer", label: "Enforcer", recommended: true, planPatchHint: noOp },
    { id: "role-liaison", label: "Liaison to the Crown", planPatchHint: noOp },
    { id: "role-exile", label: "Exile", planPatchHint: noOp },
  ],
};

const CONFIRM_DEFAULT: LoreImportClarificationItem = {
  id: "33333333-3333-4333-8333-333333333333",
  category: "canon_weight",
  severity: "required",
  confidenceScore: 0.82,
  title: "Treat this chapter as current canon?",
  context:
    "The voice reads as narrator rather than an in-world document. We'll mark the notes as canon unless you say otherwise.",
  questionKind: "confirm_default",
  options: [
    { id: "confirm-yes", label: "Yes — mark as canon", recommended: true, planPatchHint: noOp },
    { id: "confirm-no", label: "No — mark as draft / speculative", planPatchHint: noOp },
  ],
};

type ScenarioKey =
  | "single"
  | "multi"
  | "confirmDefault"
  | "otherFollowUp"
  | "allDone";

type Scenario = {
  key: ScenarioKey;
  label: string;
  description: string;
  clarifications: LoreImportClarificationItem[];
  initialAnswers?: ClarificationAnswer[];
  initialOtherFollowUp?: OtherFollowUp | null;
};

const SCENARIOS: Scenario[] = [
  {
    key: "single",
    label: "Single-select (required)",
    description:
      "Low-confidence structural decision. Required to apply the import. A “Use recommended” shortcut is offered.",
    clarifications: [SINGLE_SELECT],
  },
  {
    key: "multi",
    label: "Multi-select (optional)",
    description:
      "Optional multi-select with a recommended role pre-highlighted. Skipping falls back to best judgement.",
    clarifications: [MULTI_SELECT],
  },
  {
    key: "confirmDefault",
    label: "Confirm default (required)",
    description:
      "High-confidence binary confirmation. Defaults to the recommended option; user can override.",
    clarifications: [CONFIRM_DEFAULT],
  },
  {
    key: "otherFollowUp",
    label: "“Other…” follow-up card",
    description:
      "User typed a free-text answer; the planner offers normalized options to disambiguate.",
    clarifications: [SINGLE_SELECT],
    initialOtherFollowUp: {
      clarificationId: SINGLE_SELECT.id,
      title: "Where should the chapter on the Ember Consortium live?",
      question:
        "We read your answer as wanting a new top-level folder. Which of these closest matches your intent?",
      otherText: "Put it under a new Syndicates heading next to Cartels.",
      options: [
        { id: "fu-new-top", label: "Create Syndicates › Ember Consortium", recommended: true },
        { id: "fu-under-factions", label: "Create Factions › Syndicates › Ember Consortium" },
        { id: "fu-rename-existing", label: "Rename Guilds to Syndicates and merge" },
      ],
    },
  },
  {
    key: "allDone",
    label: "All-set completion",
    description:
      "Shown when every required clarification is resolved. Gives a direct path to apply the import.",
    clarifications: [SINGLE_SELECT, CONFIRM_DEFAULT],
    initialAnswers: [
      {
        clarificationId: SINGLE_SELECT.id,
        resolution: "answered",
        selectedOptionIds: ["opt-existing"],
      },
      {
        clarificationId: CONFIRM_DEFAULT.id,
        resolution: "answered",
        selectedOptionIds: ["confirm-yes"],
      },
    ],
  },
];

/* ------------------------------------ UI ------------------------------------ */

type WizardProps = {
  scenario: Scenario;
};

type MockPlanStats = {
  folders: number;
  notes: number;
  merges: number;
  links: number;
  reviewFlags: number;
};

const MOCK_STATS: MockPlanStats = {
  folders: 4,
  notes: 18,
  merges: 3,
  links: 7,
  reviewFlags: 1,
};

const MOCK_FILE_NAME = "fellowship-lore.md";

function WizardPreview({ scenario }: WizardProps) {
  const [answers, setAnswers] = useState<ClarificationAnswer[]>(
    () => scenario.initialAnswers ?? [],
  );
  const [otherFollowUp, setOtherFollowUp] = useState<OtherFollowUp | null>(
    () => scenario.initialOtherFollowUp ?? null,
  );

  const ordered = scenario.clarifications;
  const byId = useMemo(
    () => new Map(answers.map((a) => [a.clarificationId, a])),
    [answers],
  );
  const totalQuestions = ordered.length;
  const answeredCount = ordered.filter((c) => isAnswered(byId.get(c.id))).length;
  const questionsComplete =
    totalQuestions > 0 && ordered.every((c) => isAnswered(byId.get(c.id)));
  const focusQuestion =
    totalQuestions === 0
      ? null
      : ordered.find((c) => !isAnswered(byId.get(c.id))) ?? null;
  const wizardBarPercentRaw =
    totalQuestions === 0 ? 100 : Math.round((answeredCount / totalQuestions) * 100);
  const wizardBarPercent =
    totalQuestions === 0
      ? 100
      : answeredCount >= totalQuestions
        ? 100
        : answeredCount === 0
          ? 0
          : Math.max(wizardBarPercentRaw, 6);
  const reset = () => {
    setAnswers(scenario.initialAnswers ?? []);
    setOtherFollowUp(scenario.initialOtherFollowUp ?? null);
  };

  const answerAll = () => {
    setAnswers(
      ordered.map((c) => ({
        clarificationId: c.id,
        resolution: "answered" as const,
        selectedOptionIds: [recommendedOptionId(c) ?? c.options[0]!.id],
      })),
    );
    setOtherFollowUp(null);
  };

  return (
    <>
      <div className={styles.stage}>
        <span className={styles.stageLabel}>Preview</span>
        <div
          className={`${canvasStyles.smartImportReviewBackdrop} ${styles.stageBackdrop}`}
          role="dialog"
          aria-modal="true"
          aria-label="Smart document import"
        >
        <div className={`${canvasStyles.smartImportReviewPanel} ${styles.stagePanel}`}>
          <header className={canvasStyles.smartImportReviewHeader}>
            <div className={canvasStyles.smartImportReviewHeaderMain}>
              <h2 className={canvasStyles.smartImportReviewTitle}>Smart import</h2>
              <p className={canvasStyles.smartImportReviewFile}>{MOCK_FILE_NAME}</p>
              <p className={canvasStyles.smartImportReviewStatsLine}>
                <strong>{MOCK_STATS.folders}</strong> folders ·{" "}
                <strong>{MOCK_STATS.notes}</strong> notes ·{" "}
                <strong>{totalQuestions}</strong> question{totalQuestions === 1 ? "" : "s"}
              </p>
            </div>
            <div className={canvasStyles.smartImportReviewHeaderActions}>
              <Button
                size="sm"
                variant="default"
                tone="card-dark"
                type="button"
                onClick={() => {
                  /* demo — no-op */
                }}
              >
                Close
              </Button>
            </div>
          </header>
          <div className={canvasStyles.smartImportReviewBody}>
            <div className={canvasStyles.smartImportWizard}>
              <div className={canvasStyles.smartImportWizardProgress}>
          <p className={canvasStyles.smartImportWizardProgressLabel}>
            {otherFollowUp
              ? "Follow-up"
              : questionsComplete
                ? "All done"
                : focusQuestion
                  ? `Question ${ordered.indexOf(focusQuestion) + 1} of ${totalQuestions}`
                  : "Questions"}
          </p>
          <div
            className={
              totalQuestions > 1
                ? `${canvasStyles.smartImportQuestionsProgressTrack} ${canvasStyles.smartImportQuestionsProgressTrackSegmented}`
                : canvasStyles.smartImportQuestionsProgressTrack
            }
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={wizardBarPercent}
            aria-label="Questions completed"
          >
            {totalQuestions > 1 ? (
              ordered.map((q) => {
                const answered = byId.get(q.id);
                const isDone = isAnswered(answered);
                const isActive = !!focusQuestion && focusQuestion.id === q.id;
                return (
                  <span
                    key={q.id}
                    className={`${canvasStyles.smartImportQuestionsProgressSegment}${isDone ? ` ${canvasStyles.smartImportQuestionsProgressSegmentDone}` : ""}${isActive ? ` ${canvasStyles.smartImportQuestionsProgressSegmentActive}` : ""}`}
                  />
                );
              })
            ) : (
              <div
                className={canvasStyles.smartImportQuestionsProgressFill}
                style={{ width: `${wizardBarPercent}%` }}
              />
            )}
          </div>
        </div>

        {otherFollowUp ? (
          <div className={canvasStyles.smartImportWizardCard} role="region" aria-live="polite">
            <p className={canvasStyles.smartImportWizardEyebrow}>Follow-up</p>
            <h3 className={canvasStyles.smartImportWizardTitle}>{otherFollowUp.title}</h3>
            <p className={canvasStyles.smartImportWizardContext}>{otherFollowUp.question}</p>
            <p className={canvasStyles.smartImportWizardQuote}>
              You wrote: &quot;{otherFollowUp.otherText}&quot;
            </p>
            <div className={canvasStyles.smartImportWizardFollowUpOptions}>
              {otherFollowUp.options.map((opt) => (
                <label
                  key={opt.id}
                  className={canvasStyles.smartImportWizardOption}
                >
                  <input
                    type="radio"
                    name={`clarify-followup-${otherFollowUp.clarificationId}`}
                    onChange={() => {
                      setAnswers((prev) =>
                        upsertAnswer(prev, {
                          clarificationId: otherFollowUp.clarificationId,
                          resolution: "answered",
                          selectedOptionIds: [opt.id],
                        }),
                      );
                      setOtherFollowUp(null);
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            <div className={canvasStyles.smartImportWizardFooter}>
              <Button
                size="sm"
                variant="ghost"
                tone="glass"
                type="button"
                onClick={() => {
                  setAnswers((prev) =>
                    upsertAnswer(prev, {
                      clarificationId: otherFollowUp.clarificationId,
                      resolution: "skipped_best_judgement",
                    }),
                  );
                  setOtherFollowUp(null);
                }}
              >
                Skip, use best judgement
              </Button>
            </div>
          </div>
        ) : questionsComplete ? (
          <div className={canvasStyles.smartImportWizardComplete}>
            <p className={canvasStyles.smartImportWizardCompleteTitle}>You&apos;re all set</p>
            <p className={canvasStyles.smartImportWizardCompleteBody}>
              Optionally review <strong>Structure</strong> and <strong>Merges</strong>, then
              apply the import to add this content to your space.
            </p>
            <Button
              size="md"
              variant="primary"
              tone="solid"
              type="button"
              onClick={() => {
                /* demo — no-op */
              }}
            >
              Apply import to canvas
            </Button>
          </div>
        ) : focusQuestion ? (
          (() => {
            const c = focusQuestion;
            const ans = byId.get(c.id);
            const isMulti = c.questionKind === "multi_select";
            const selectedSet = new Set(
              ans?.resolution === "answered"
                ? (ans.selectedOptionIds ?? [])
                : ans?.resolution === "skipped_default" && ans.skipDefaultOptionId
                  ? [ans.skipDefaultOptionId]
                  : [],
            );
            const otherSelected = ans?.resolution === "other_text";
            const step = ordered.indexOf(c) + 1;
            return (
              <article className={canvasStyles.smartImportWizardCard}>
                <p className={canvasStyles.smartImportWizardEyebrow}>
                  {c.severity === "required" ? "Required" : "Optional"} · {step} of{" "}
                  {totalQuestions}
                </p>
                <h3 className={canvasStyles.smartImportWizardTitle}>{c.title}</h3>
                {c.context ? (
                  <p className={canvasStyles.smartImportWizardContext}>{c.context}</p>
                ) : null}
                <div className={canvasStyles.smartImportWizardOptions}>
                  {c.options.map((opt) =>
                    isMulti ? (
                      <label key={opt.id} className={canvasStyles.smartImportWizardOption}>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(opt.id)}
                          onChange={(e) => {
                            let base: string[] =
                              ans?.resolution === "answered"
                                ? [...(ans.selectedOptionIds ?? [])]
                                : [];
                            if (e.target.checked) {
                              if (!base.includes(opt.id)) base.push(opt.id);
                            } else {
                              base = base.filter((x) => x !== opt.id);
                            }
                            setAnswers((prev) =>
                              upsertAnswer(prev, {
                                clarificationId: c.id,
                                resolution: "answered",
                                selectedOptionIds: base,
                              }),
                            );
                            setOtherFollowUp((cur) =>
                              cur?.clarificationId === c.id ? null : cur,
                            );
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ) : (
                      <label key={opt.id} className={canvasStyles.smartImportWizardOption}>
                        <input
                          type="radio"
                          name={`clarify-${c.id}`}
                          checked={
                            !!(
                              ans?.resolution === "answered" &&
                              ans.selectedOptionIds?.[0] === opt.id
                            ) ||
                            !!(
                              ans?.resolution === "skipped_default" &&
                              ans.skipDefaultOptionId === opt.id
                            )
                          }
                          onChange={() => {
                            setAnswers((prev) =>
                              upsertAnswer(prev, {
                                clarificationId: c.id,
                                resolution: "answered",
                                selectedOptionIds: [opt.id],
                              }),
                            );
                            setOtherFollowUp((cur) =>
                              cur?.clarificationId === c.id ? null : cur,
                            );
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ),
                  )}
                  <label className={canvasStyles.smartImportWizardOption}>
                    <input
                      type="radio"
                      name={`clarify-other-${c.id}`}
                      checked={otherSelected}
                      onChange={() =>
                        setAnswers((prev) =>
                          upsertAnswer(prev, {
                            clarificationId: c.id,
                            resolution: "other_text",
                            otherText: ans?.otherText ?? "",
                          }),
                        )
                      }
                    />
                    <span>Other…</span>
                  </label>
                  {otherSelected ? (
                    <textarea
                      className={canvasStyles.smartImportWizardTextarea}
                      placeholder="Type your answer (at least a few characters)…"
                      value={ans?.otherText ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) =>
                          upsertAnswer(prev, {
                            clarificationId: c.id,
                            resolution: "other_text",
                            otherText: e.target.value,
                          }),
                        )
                      }
                    />
                  ) : null}
                </div>
                <div className={canvasStyles.smartImportWizardFooter}>
                  {recommendedOptionId(c) ? (
                    <Button
                      size="sm"
                      variant="default"
                      tone="card-dark"
                      type="button"
                      onClick={() => {
                        const def = recommendedOptionId(c);
                        if (!def) return;
                        setAnswers((prev) =>
                          upsertAnswer(prev, {
                            clarificationId: c.id,
                            resolution: "skipped_default",
                            skipDefaultOptionId: def,
                          }),
                        );
                        setOtherFollowUp((cur) =>
                          cur?.clarificationId === c.id ? null : cur,
                        );
                      }}
                    >
                      Use recommended
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })()
        ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.stageFooter}>
        <div className={styles.resetRow}>
          <Button size="xs" variant="default" tone="card-dark" type="button" onClick={reset}>
            Reset scenario
          </Button>
          <Button size="xs" variant="default" tone="card-dark" type="button" onClick={answerAll}>
            Auto-answer all (recommended)
          </Button>
        </div>
        <pre className={styles.stateDump} aria-label="Answer state">
          {JSON.stringify({ answers, otherFollowUp }, null, 2)}
        </pre>
      </div>
    </>
  );
}

export function SmartImportQuestionsDemo() {
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("single");
  const scenario =
    SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[0]!;

  return (
    <div className={styles.shell}>
      <h1 className={styles.title}>Smart import — question wizard</h1>
      <p className={styles.subtitle}>
        Interactive preview of the clarification cards used on the <code>Questions</code>{" "}
        tab of the Smart Import review panel. Each scenario uses the same JSX and CSS
        modules as the real component.
      </p>
      <p className={styles.url}>
        URL: <code>/dev/smart-import-questions</code>
      </p>

      <div className={styles.layout}>
        <div className={styles.scenarioSwitcher} role="tablist" aria-label="Scenario">
          <span className={styles.scenarioLabel}>Scenario</span>
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={scenarioKey === s.key}
              className={
                scenarioKey === s.key
                  ? `${styles.scenarioChip} ${styles.scenarioChipActive}`
                  : styles.scenarioChip
              }
              onClick={() => setScenarioKey(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className={styles.stageGroup} key={scenario.key}>
          <p className={styles.stageHeading}>{scenario.label}</p>
          <p className={styles.stageHint}>{scenario.description}</p>
          <WizardPreview scenario={scenario} />
        </div>
      </div>
    </div>
  );
}
