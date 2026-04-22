"use client";

import { useMemo, useState } from "react";

import canvasStyles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { Button } from "@/src/components/ui/Button";

import styles from "./smart-import-planning-demo.module.css";

/**
 * Visual preview of the simplified Smart Import planning modal.
 * The real modal is rendered inside `ArchitecturalCanvasApp.tsx`; this page mirrors
 * its JSX / classes so we can iterate on the spinner + copy without running a full import.
 * Open: /dev/smart-import-planning
 */

const PHASES: { key: string; label: string }[] = [
  { key: "queued", label: "Queued on the server" },
  { key: "fallback_plan", label: "Planning locally" },
  { key: "chunking", label: "Reading the document" },
  { key: "outline", label: "Building the outline" },
  { key: "vault_retrieval", label: "Gathering related vault context" },
  { key: "merge", label: "Merging entities and notes" },
  { key: "clarify", label: "Drafting clarifications" },
  { key: "persist_review", label: "Saving the review queue" },
  { key: "failed", label: "Planning failed" },
  { key: "ready", label: "Plan ready" },
];

function toHumanPhaseLabel(phase: string): string {
  const hit = PHASES.find((p) => p.key === phase);
  if (hit) return hit.label;
  const key = phase.trim();
  if (!key) return "Starting…";
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function SmartImportPlanningDemo() {
  const [phase, setPhase] = useState<string>("queued");
  const [detail, setDetail] = useState<string>("");
  const [showQueueFailure, setShowQueueFailure] = useState(false);

  const phaseLabel = useMemo(() => toHumanPhaseLabel(phase), [phase]);

  const rawDetail = detail.trim();
  const resolvedDetail =
    rawDetail.length === 0 || /^queued\b/i.test(rawDetail) ? null : rawDetail;
  const queueFailureHint = showQueueFailure
    ? "The queue worker did not acknowledge this job in time. We'll retry a local plan on this tab if the server doesn't pick it up."
    : null;

  return (
    <div className={styles.shell}>
      <h1 className={styles.title}>Smart import — planning modal</h1>
      <p className={styles.subtitle}>
        Simplified planning overlay with a conic-gradient ring spinner. The phase label
        updates as the server emits progress events; there is no numeric progress bar
        because the server rarely reports a reliable percentage for the planning step.
      </p>
      <p className={styles.url}>
        URL: <code>/dev/smart-import-planning</code>
      </p>

      <div className={styles.grid}>
        <aside className={styles.controls} aria-label="Preview controls">
          <div className={styles.controlGroup}>
            <p className={styles.controlLabel}>Phase</p>
            <div className={styles.phaseList} role="radiogroup" aria-label="Planner phase">
              {PHASES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={phase === p.key}
                  className={
                    phase === p.key
                      ? `${styles.phaseChip} ${styles.phaseChipActive}`
                      : styles.phaseChip
                  }
                  onClick={() => setPhase(p.key)}
                >
                  {p.key}
                </button>
              ))}
            </div>
            <p className={styles.stageHint}>
              Label: <strong>{phaseLabel}</strong>
            </p>
          </div>

          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="plan-detail-input">
              Server detail message
            </label>
            <input
              id="plan-detail-input"
              className={styles.textInput}
              placeholder="Empty = show default phase label only"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
            <p className={styles.stageHint}>
              Redundant &quot;queued…&quot; copy is intentionally suppressed.
            </p>
          </div>

          <div className={styles.controlGroup}>
            <p className={styles.controlLabel}>Flags</p>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={showQueueFailure}
                onChange={(e) => setShowQueueFailure(e.target.checked)}
              />
              <span>Show queue failure hint</span>
            </label>
          </div>
        </aside>

        <div className={styles.stage} aria-label="Modal preview stage">
          <span className={styles.stageLabel}>Preview</span>
          <div
            className={`${canvasStyles.smartImportPlanningBackdrop} ${styles.stageBackdrop}`}
            role="status"
            aria-live="polite"
            aria-label="Smart import planning status"
          >
            <div className={canvasStyles.smartImportPlanningCard}>
              <div className={canvasStyles.smartImportPlanningSpinner} aria-hidden>
                <span className={canvasStyles.smartImportPlanningSpinnerRing} />
              </div>
              <p className={canvasStyles.smartImportPlanningPhase}>{phaseLabel}</p>
              {resolvedDetail ? (
                <p className={canvasStyles.smartImportPlanningDetail}>{resolvedDetail}</p>
              ) : null}
              {queueFailureHint ? (
                <p className={canvasStyles.smartImportPlanningWarning}>{queueFailureHint}</p>
              ) : null}
              <p className={canvasStyles.smartImportPlanningHint}>
                Keep this tab open — most imports finish in a minute or two.
              </p>
              <div className={canvasStyles.smartImportPlanningActions}>
                <Button
                  size="sm"
                  variant="subtle"
                  tone="glass"
                  type="button"
                  onClick={() => {
                    /* demo — no-op */
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
