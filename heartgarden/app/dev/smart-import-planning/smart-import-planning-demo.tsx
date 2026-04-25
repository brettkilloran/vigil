"use client";

import { CopySimple, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import canvasStyles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { Button } from "@/src/components/ui/button";

import styles from "./smart-import-planning-demo.module.css";

/**
 * Visual preview of the simplified Smart Import planning modal.
 * The real modal is rendered inside `ArchitecturalCanvasApp.tsx`; this page mirrors
 * its JSX / classes so we can iterate on the spinner + copy without running a full import.
 * Open: /dev/smart-import-planning
 */

const QUEUED_DETAIL_RE = /^queued\b/i;

const PHASES: { key: string; label: string }[] = [
  { key: "queued", label: "Queued on the server" },
  { key: "fallback_plan", label: "Planning locally" },
  { key: "chunking", label: "Reading the document" },
  { key: "outline", label: "Building the outline" },
  { key: "vault_retrieval", label: "Gathering related vault context" },
  { key: "merge", label: "Merging entities and notes" },
  { key: "clarify", label: "Drafting clarifications" },
  { key: "persist_review", label: "Saving the review queue" },
  { key: "failed", label: "Smart import failed" },
  { key: "ready", label: "Plan ready" },
];

const FAILURE_STAGES: { key: string; label: string }[] = [
  { key: "plan_failed", label: "plan_failed" },
  { key: "job_poll", label: "job_poll" },
  { key: "job_create", label: "job_create" },
  { key: "timeout", label: "timeout" },
  { key: "parse", label: "parse" },
  { key: "unknown", label: "unknown" },
];

function toHumanPhaseLabel(phase: string): string {
  const hit = PHASES.find((p) => p.key === phase);
  if (hit) {
    return hit.label;
  }
  const key = phase.trim();
  if (!key) {
    return "Starting…";
  }
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function mockFailureReport(args: {
  stage: string;
  message: string;
  recommendedAction: string;
  jobId: string;
  attemptId: string;
}): string {
  const { stage, message, recommendedAction, jobId, attemptId } = args;
  return [
    message.length > 72 ? `${message.slice(0, 70)}...` : message,
    "---",
    "Heartgarden lore import diagnostic (paste to support)",
    `time: ${new Date().toISOString()}`,
    `page: ${typeof window === "undefined" ? "(ssr)" : window.location.origin}`,
    `attemptId: ${attemptId}`,
    `stage: ${stage}`,
    "operation: GET /api/lore/import/jobs/[jobId]",
    `jobId: ${jobId}`,
    `phase: ${stage === "timeout" ? "outline" : "merge"}`,
    `httpStatus: ${stage === "job_poll" ? 502 : 500}`,
    "errorCode: LLM_TIMEOUT",
    "fileName: fellowship-lore.md",
    `recommendedAction: ${recommendedAction}`,
    `message: ${message}`,
  ].join("\n");
}

export function SmartImportPlanningDemo() {
  const [phase, setPhase] = useState<string>("queued");
  const [detail, setDetail] = useState<string>("");
  const [showQueueFailure, setShowQueueFailure] = useState(false);

  const [failureStage, setFailureStage] = useState<string>("plan_failed");
  const [failureMessage, setFailureMessage] = useState<string>(
    "Planner timed out while merging entities. The server may still be working in the background, but your request was not completed."
  );
  const [recommendedAction, setRecommendedAction] = useState<string>(
    "Try splitting the source file into smaller chunks, then retry. Share the snapshot if the failure persists."
  );

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  useEffect(() => {
    if (copyState === "idle") {
      return;
    }
    const t = setTimeout(() => setCopyState("idle"), 1800);
    return () => clearTimeout(t);
  }, [copyState]);

  const phaseLabel = useMemo(() => toHumanPhaseLabel(phase), [phase]);
  const failed = phase === "failed";

  const rawDetail = detail.trim();
  const resolvedDetail =
    rawDetail.length === 0 || QUEUED_DETAIL_RE.test(rawDetail)
      ? null
      : rawDetail;
  const queueFailureHint = showQueueFailure
    ? "The queue worker did not acknowledge this job in time. We'll retry a local plan on this tab if the server doesn't pick it up."
    : null;

  const report = useMemo(
    () =>
      mockFailureReport({
        attemptId: "demo-attempt-preview",
        jobId: "3f8a7c21-…-preview",
        message: failureMessage,
        recommendedAction,
        stage: failureStage,
      }),
    [failureStage, failureMessage, recommendedAction]
  );
  const failurePhaseLabel =
    failureStage === "timeout"
      ? "Import is taking too long"
      : "Smart import failed";

  const handleCopy = () => {
    navigator.clipboard.writeText(report).then(
      () => setCopyState("copied"),
      () => setCopyState("failed")
    );
  };

  return (
    <div className={styles.shell}>
      <h1 className={styles.title}>Smart import — planning modal</h1>
      <p className={styles.subtitle}>
        Simplified planning overlay with an animated ring spinner. The phase
        label updates as the server emits progress events; there is no numeric
        progress bar because the server rarely reports a reliable percentage for
        the planning step. Switch the phase to <code>failed</code> to preview
        the inline retry / copy-details layout.
      </p>
      <p className={styles.url}>
        URL: <code>/dev/smart-import-planning</code>
      </p>

      <div className={styles.grid}>
        <aside aria-label="Preview controls" className={styles.controls}>
          <div className={styles.controlGroup}>
            <p className={styles.controlLabel}>Phase</p>
            <div
              aria-label="Planner phase"
              className={styles.phaseList}
              role="radiogroup"
            >
              {PHASES.map((p) => (
                <button
                  aria-checked={phase === p.key}
                  className={
                    phase === p.key
                      ? `${styles.phaseChip} ${styles.phaseChipActive}`
                      : styles.phaseChip
                  }
                  key={p.key}
                  onClick={() => setPhase(p.key)}
                  role="radio"
                  type="button"
                >
                  {p.key}
                </button>
              ))}
            </div>
            <p className={styles.stageHint}>
              Label: <strong>{failed ? failurePhaseLabel : phaseLabel}</strong>
            </p>
          </div>

          {failed ? (
            <>
              <div className={styles.controlGroup}>
                <p className={styles.controlLabel}>Failure stage</p>
                <div
                  aria-label="Failure stage"
                  className={styles.phaseList}
                  role="radiogroup"
                >
                  {FAILURE_STAGES.map((s) => (
                    <button
                      aria-checked={failureStage === s.key}
                      className={
                        failureStage === s.key
                          ? `${styles.phaseChip} ${styles.phaseChipActive}`
                          : styles.phaseChip
                      }
                      key={s.key}
                      onClick={() => setFailureStage(s.key)}
                      role="radio"
                      type="button"
                    >
                      {s.key}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.controlGroup}>
                <label
                  className={styles.controlLabel}
                  htmlFor="fail-message-input"
                >
                  Error message
                </label>
                <textarea
                  className={styles.textArea}
                  id="fail-message-input"
                  onChange={(e) => setFailureMessage(e.target.value)}
                  rows={3}
                  value={failureMessage}
                />
              </div>

              <div className={styles.controlGroup}>
                <label
                  className={styles.controlLabel}
                  htmlFor="fail-action-input"
                >
                  Recommended action
                </label>
                <textarea
                  className={styles.textArea}
                  id="fail-action-input"
                  onChange={(e) => setRecommendedAction(e.target.value)}
                  rows={2}
                  value={recommendedAction}
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.controlGroup}>
                <label
                  className={styles.controlLabel}
                  htmlFor="plan-detail-input"
                >
                  Server detail message
                </label>
                <input
                  className={styles.textInput}
                  id="plan-detail-input"
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Empty = show default phase label only"
                  value={detail}
                />
                <p className={styles.stageHint}>
                  Redundant &quot;queued…&quot; copy is intentionally
                  suppressed.
                </p>
              </div>

              <div className={styles.controlGroup}>
                <p className={styles.controlLabel}>Flags</p>
                <label className={styles.toggleRow}>
                  <input
                    checked={showQueueFailure}
                    onChange={(e) => setShowQueueFailure(e.target.checked)}
                    type="checkbox"
                  />
                  <span>Show queue failure hint</span>
                </label>
              </div>
            </>
          )}
        </aside>

        <section aria-label="Modal preview stage" className={styles.stage}>
          <span className={styles.stageLabel}>Preview</span>
          {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is always alertdialog or status, both support aria-label; static analysis cannot resolve the ternary */}
          <div
            aria-label={
              failed ? "Smart import failed" : "Smart import planning status"
            }
            aria-live={failed ? "assertive" : "polite"}
            className={`${canvasStyles.smartImportPlanningBackdrop} ${styles.stageBackdrop}`}
            role={failed ? "alertdialog" : "status"}
          >
            <div className={canvasStyles.smartImportPlanningCard}>
              {failed ? (
                <>
                  <div
                    aria-hidden
                    className={canvasStyles.smartImportPlanningFailIcon}
                  >
                    <WarningCircle size={28} weight="fill" />
                  </div>
                  <p className={canvasStyles.smartImportPlanningPhase}>
                    {failurePhaseLabel}
                  </p>
                  <p className={canvasStyles.smartImportPlanningError}>
                    {failureMessage || "Smart import couldn't finish planning."}
                    {recommendedAction.trim().length > 0
                      ? ` ${recommendedAction.trim()}`
                      : ""}
                  </p>
                  <details className={canvasStyles.smartImportPlanningDetails}>
                    <summary>Technical details</summary>
                    <pre>{report}</pre>
                  </details>
                  <div className={canvasStyles.smartImportPlanningActionsSplit}>
                    <Button
                      leadingIcon={<CopySimple size={14} weight="regular" />}
                      onClick={handleCopy}
                      size="sm"
                      tone="card-dark"
                      type="button"
                      variant="default"
                    >
                      {copyState === "copied"
                        ? "Copied"
                        : copyState === "failed"
                          ? "Copy failed"
                          : "Copy details"}
                    </Button>
                    <div>
                      <Button
                        onClick={() => {
                          /* demo — no-op */
                        }}
                        size="sm"
                        tone="card-dark"
                        type="button"
                        variant="default"
                      >
                        Close
                      </Button>
                      <Button
                        onClick={() => {
                          /* demo — flips back to the running state */
                          setPhase("queued");
                        }}
                        size="sm"
                        tone="solid"
                        type="button"
                        variant="primary"
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    aria-hidden
                    className={canvasStyles.smartImportPlanningSpinner}
                  >
                    <span
                      className={canvasStyles.smartImportPlanningSpinnerRing}
                    />
                  </div>
                  <p className={canvasStyles.smartImportPlanningPhase}>
                    {phaseLabel}
                  </p>
                  {resolvedDetail ? (
                    <p className={canvasStyles.smartImportPlanningDetail}>
                      {resolvedDetail}
                    </p>
                  ) : null}
                  {queueFailureHint ? (
                    <p className={canvasStyles.smartImportPlanningWarning}>
                      {queueFailureHint}
                    </p>
                  ) : null}
                  <p className={canvasStyles.smartImportPlanningHint}>
                    Keep this tab open — most imports finish in a minute or two.
                  </p>
                  <div className={canvasStyles.smartImportPlanningActions}>
                    <Button
                      onClick={() => {
                        /* demo — no-op */
                      }}
                      size="sm"
                      tone="card-dark"
                      type="button"
                      variant="default"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
