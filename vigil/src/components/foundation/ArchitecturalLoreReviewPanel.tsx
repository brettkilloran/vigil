"use client";

import { X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "@/src/components/foundation/ArchitecturalLoreReviewPanel.module.css";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
import { Button } from "@/src/components/ui/Button";
import { playVigilUiSound } from "@/src/lib/vigil-ui-sounds";

export type VaultReviewDraft = {
  title: string;
  bodyText: string;
  excludeItemId?: string;
  /** Short label for the header (e.g. note title). */
  targetLabel: string;
};

export type VaultReviewIssue = {
  summary: string;
  severity: string;
  details?: string;
  candidateItemId?: string;
  handlingHint?: string;
};

const PRESET_TAGS: { id: string; label: string; hint: string }[] = [
  { id: "flavor_not_crunch", label: "Flavor, not crunch", hint: "No rules weight — mood / color only" },
  { id: "uncertain_canon", label: "Uncertain canon", hint: "Truth status unclear; label, do not move" },
  { id: "gm_note_layer", label: "GM / OOC layer", hint: "Meta or facilitator text" },
  { id: "historical_in_setting", label: "Historical in-setting", hint: "Past-tense lore, not current facts" },
  { id: "needs_crosslink", label: "Wants a link", hint: "Consider a reference, not a folder move" },
  { id: "no_structural_change", label: "No sort / move", hint: "Fine where it is — metadata only" },
];

function slugifyTag(raw: string): string | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  if (!s || !/^[a-z]/.test(s)) return null;
  return s;
}

export function ArchitecturalLoreReviewPanel({
  open,
  onClose,
  draft,
  onRunAnalysis,
  onAppendTags,
  loading,
  error,
  issues,
  suggestedNoteTags,
  semanticSummary,
}: {
  open: boolean;
  onClose: () => void;
  draft: VaultReviewDraft | null;
  onRunAnalysis: () => void;
  onAppendTags: (tags: string[]) => Promise<boolean>;
  loading: boolean;
  error: string | null;
  issues: VaultReviewIssue[];
  suggestedNoteTags: string[];
  semanticSummary: string | null;
}) {
  const [tagBusy, setTagBusy] = useState(false);
  const [dismissed, setDismissed] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setDismissed(new Set());
  }, [issues]);

  const visibleIssues = useMemo(
    () => issues.filter((_, i) => !dismissed.has(i)),
    [issues, dismissed],
  );

  const applyTags = useCallback(
    async (tags: string[]) => {
      const clean = [...new Set(tags.map(slugifyTag).filter(Boolean) as string[])];
      if (clean.length === 0) return;
      setTagBusy(true);
      try {
        const ok = await onAppendTags(clean);
        if (ok) {
          playVigilUiSound("tap");
        }
      } finally {
        setTagBusy(false);
      }
    },
    [onAppendTags],
  );

  if (!open) return null;

  const canTag = Boolean(draft?.excludeItemId);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        tone="glass"
        className={styles.backdrop}
        aria-label="Close vault review"
        disabled={loading}
        onClick={onClose}
      />
      <aside className={styles.panel} aria-label="Vault review">
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Vault review</h2>
            <p className={styles.panelSubtitle}>
              Consistency pass plus light semantic tags. Many findings are fine to{" "}
              <strong>label</strong> instead of moving or flagging as errors.
            </p>
            {draft ? (
              <p className={styles.panelSubtitle}>
                Target: <span className="font-medium text-[var(--vigil-label)]">{draft.targetLabel}</span>
              </p>
            ) : (
              <p className={`${styles.panelSubtitle} text-amber-700 dark:text-amber-300`}>
                Select one text note or open focus mode on a note.
              </p>
            )}
          </div>
          <ArchitecturalTooltip content="Close" side="left" delayMs={200}>
            <Button
              type="button"
              size="sm"
              variant="neutral"
              tone="glass"
              aria-label="Close vault review"
              disabled={loading}
              onClick={onClose}
            >
              <X size={16} weight="bold" aria-hidden />
            </Button>
          </ArchitecturalTooltip>
        </div>

        <div className={styles.panelBody}>
          <div>
            <Button
              type="button"
              size="sm"
              variant="primary"
              tone="solid"
              className={styles.primaryCta}
              disabled={!draft || loading}
              onClick={() => {
                setDismissed(new Set());
                onRunAnalysis();
              }}
            >
              {loading ? "Analyzing…" : "Run consistency & semantic pass"}
            </Button>
          </div>

          <div>
            <div className={styles.sectionLabel}>Quick labels (no move / sort)</div>
            <p className="mb-2 text-[10px] leading-relaxed text-[var(--vigil-muted)]">
              Append tags to this card’s metadata for search and future tooling. Does not change canvas
              layout.
            </p>
            <div className={styles.chipRow}>
              {PRESET_TAGS.map((t) => (
                <ArchitecturalTooltip key={t.id} content={t.hint} side="bottom" delayMs={240}>
                  <Button
                    type="button"
                    size="xs"
                    variant="subtle"
                    tone="glass"
                    className={styles.chip}
                    disabled={!canTag || tagBusy || loading}
                    onClick={() => void applyTags([t.id])}
                  >
                    {t.label}
                  </Button>
                </ArchitecturalTooltip>
              ))}
            </div>
            {!canTag && draft ? (
              <p className="mt-2 text-[10px] text-[var(--vigil-muted)]">
                Tags require a synced note (save to Neon first if this card is new).
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          {semanticSummary && !loading ? (
            <div>
              <div className={styles.sectionLabel}>Semantic read</div>
              <p className="text-[11px] leading-relaxed text-[var(--vigil-label)]">{semanticSummary}</p>
            </div>
          ) : null}

          {suggestedNoteTags.length > 0 && !loading ? (
            <div>
              <div className={styles.sectionLabel}>Suggested tags (AI)</div>
              <div className={styles.chipRow}>
                {suggestedNoteTags.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    size="xs"
                    variant="subtle"
                    tone="glass"
                    className={styles.chip}
                    disabled={!canTag || tagBusy}
                    onClick={() => void applyTags([tag])}
                  >
                    {tag.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <div className={styles.sectionLabel}>
              Findings {visibleIssues.length > 0 ? `(${visibleIssues.length})` : ""}
            </div>
            {!loading && !error && issues.length === 0 && semanticSummary == null && suggestedNoteTags.length === 0 ? (
              <p className="text-[11px] text-[var(--vigil-muted)]">
                Run an analysis to compare this note against retrieved vault excerpts.
              </p>
            ) : null}
            {!loading && issues.length === 0 && (semanticSummary || suggestedNoteTags.length > 0) ? (
              <p className="text-[11px] text-[var(--vigil-muted)]">
                No conflict rows — optional tags above still apply.
              </p>
            ) : null}
            <ul className="mt-2 space-y-2">
              {issues.map((issue, i) => {
                if (dismissed.has(i)) return null;
                const sev =
                  issue.severity === "contradiction"
                    ? "text-red-600 dark:text-red-400"
                    : issue.severity === "info"
                      ? "text-[var(--vigil-muted)]"
                      : "text-amber-700 dark:text-amber-300";
                return (
                  <li key={i} className={styles.issueCard}>
                    <div className={`${styles.issueMeta} ${sev}`}>{issue.severity}</div>
                    <div className={styles.issueSummary}>{issue.summary}</div>
                    {issue.details ? <div className={styles.issueDetails}>{issue.details}</div> : null}
                    {issue.handlingHint ? (
                      <span className={styles.hintPill}>Hint: {issue.handlingHint.replace(/_/g, " ")}</span>
                    ) : null}
                    {issue.candidateItemId ? (
                      <div className="mt-1 font-mono text-[9px] text-[var(--vigil-muted)]">
                        Related: {issue.candidateItemId}
                      </div>
                    ) : null}
                    <div className={styles.issueActions}>
                      <Button
                        type="button"
                        size="xs"
                        variant="neutral"
                        tone="glass"
                        onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                      >
                        Dismiss
                      </Button>
                      {canTag ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="neutral"
                          tone="glass"
                          disabled={tagBusy}
                          onClick={() => void applyTags(["reviewed_finding_ack"])}
                        >
                          Tag: acknowledged
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}
