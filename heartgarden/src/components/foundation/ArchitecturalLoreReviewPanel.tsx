"use client";

import { Article, Sparkle, WarningCircle, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import styles from "@/src/components/foundation/ArchitecturalLoreReviewPanel.module.css";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
import { Button } from "@/src/components/ui/Button";
import { cx } from "@/src/lib/cx";
import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";
import { HEARTGARDEN_CHROME_ICON } from "@/src/lib/vigil-ui-classes";
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

  const { attentionIndices, infoIndices } = useMemo(() => {
    const attention: number[] = [];
    const info: number[] = [];
    issues.forEach((issue, i) => {
      if (issue.severity === "info") info.push(i);
      else attention.push(i);
    });
    return { attentionIndices: attention, infoIndices: info };
  }, [issues]);

  const infoDisclosureKey = useMemo(
    () => infoIndices.map((idx) => `${idx}:${issues[idx]?.summary ?? ""}`).join("‖"),
    [infoIndices, issues],
  );

  const visibleAttentionCount = useMemo(
    () => attentionIndices.filter((i) => !dismissed.has(i)).length,
    [attentionIndices, dismissed],
  );

  const visibleInfoCount = useMemo(
    () => infoIndices.filter((i) => !dismissed.has(i)).length,
    [infoIndices, dismissed],
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

  const modal = (
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
      <aside
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hg-vault-review-title"
      >
        <div className={styles.panelHeader}>
          <div className={styles.headerMain}>
            <span className={cx(styles.microLabel, styles.drawerEyebrow)}>Beta</span>
            <h2 id="hg-vault-review-title" className={styles.panelTitle}>
              Vault review
            </h2>
            <p className={styles.introText}>
              Consistency pass plus light semantic tags. Many findings are fine to{" "}
              <strong className={styles.introStrong}>label</strong> instead of moving or flagging as errors.
            </p>
            {draft ? (
              <div className={styles.targetCard}>
                <Article className={cx(HEARTGARDEN_CHROME_ICON, styles.targetIconTint)} size={15} weight="duotone" aria-hidden />
                <div className={styles.targetMeta}>
                  <span className={cx(styles.microLabel, styles.metadataKicker)}>Active note</span>
                  <span className={styles.targetTitle}>{draft.targetLabel}</span>
                </div>
              </div>
            ) : (
              <div className={styles.calloutWarn} role="status">
                <WarningCircle className={styles.calloutWarnIcon} size={18} weight="fill" aria-hidden />
                <p className={styles.calloutWarnText}>
                  Select one text note or open focus mode on a note to run a pass.
                </p>
              </div>
            )}
          </div>
          <div className={styles.headerAside}>
            <ArchitecturalTooltip content="Close" side="left" delayMs={200}>
              <Button
                type="button"
                size="sm"
                variant="default"
                tone="glass"
                className={styles.closeFab}
                iconOnly
                aria-label="Close vault review"
                disabled={loading}
                onClick={onClose}
              >
                <X className={HEARTGARDEN_CHROME_ICON} size={15} weight="bold" aria-hidden />
              </Button>
            </ArchitecturalTooltip>
          </div>
        </div>

        <div className={styles.panelBody}>
          <div className={styles.ctaBand}>
            <Button
              type="button"
              size="md"
              variant="primary"
              tone="solid"
              className={styles.primaryCta}
              isLoading={loading}
              leadingIcon={loading ? undefined : <Sparkle className={HEARTGARDEN_CHROME_ICON} size={15} weight="fill" aria-hidden />}
              disabled={!draft || loading}
              onClick={() => {
                setDismissed(new Set());
                onRunAnalysis();
              }}
            >
              {loading ? "Analyzing…" : "Run consistency & semantic pass"}
            </Button>
          </div>

          {error ? <p className={styles.errorCallout}>{error}</p> : null}

          {semanticSummary && !loading ? (
            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <h3 className={styles.sectionTitle}>Semantic read</h3>
              </div>
              <div className={styles.semanticCard}>
                <p className={styles.semanticText}>{semanticSummary}</p>
              </div>
            </div>
          ) : null}

          {suggestedNoteTags.length > 0 && !loading ? (
            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <h3 className={styles.sectionTitle}>Suggested tags</h3>
              </div>
              <p className={styles.sectionHint}>From the last pass — tap to append to this note.</p>
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

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>Quick labels</h3>
            </div>
            <p className={styles.sectionHint}>
              Metadata only — search and future tooling. No canvas moves or sorting.
            </p>
            <div className={styles.chipGrid}>
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
              <p className={styles.syncHint}>
                Tags need a synced note — save to Neon first if this card is new.
              </p>
            ) : null}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>
                Needs attention
                {visibleAttentionCount > 0 ? ` · ${visibleAttentionCount}` : ""}
              </h3>
            </div>
            {!loading && !error && issues.length === 0 && semanticSummary == null && suggestedNoteTags.length === 0 ? (
              <p className={styles.emptyHint}>
                Run an analysis to compare this note against retrieved vault excerpts. Results land here as
                short rows you can dismiss or tag.
              </p>
            ) : null}
            {!loading &&
            !error &&
            issues.length > 0 &&
            visibleAttentionCount === 0 &&
            visibleInfoCount > 0 ? (
              <p className={styles.mutedLine}>
                No contradictions or warnings — context notes are below if you want detail.
              </p>
            ) : null}
            {!loading && issues.length === 0 && (semanticSummary || suggestedNoteTags.length > 0) ? (
              <p className={styles.mutedLine}>No conflict rows — optional tags above still apply.</p>
            ) : null}
            <ul className={styles.issueList}>
              {attentionIndices.map((i) => {
                const issue = issues[i];
                if (!issue || dismissed.has(i)) return null;
                const sevClass =
                  issue.severity === "contradiction" ? styles.issueMetaContradiction : styles.issueMetaWarning;
                return (
                  <li key={i} className={styles.issueCard}>
                    <div className={`${styles.issueMeta} ${sevClass}`}>{issue.severity}</div>
                    <div className={styles.issueSummary}>{issue.summary}</div>
                    {issue.details ? <div className={styles.issueDetails}>{issue.details}</div> : null}
                    {issue.handlingHint ? (
                      <span className={styles.hintPill}>Hint: {issue.handlingHint.replace(/_/g, " ")}</span>
                    ) : null}
                    {issue.candidateItemId ? (
                      <div className={styles.issueRelatedId}>Related: {issue.candidateItemId}</div>
                    ) : null}
                    <div className={styles.issueActions}>
                      <Button
                        type="button"
                        size="xs"
                        variant="default"
                        tone="glass"
                        onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                      >
                        Dismiss
                      </Button>
                      {canTag ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="default"
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

            {infoIndices.length > 0 ? (
              <details key={infoDisclosureKey} className={styles.infoDisclosure}>
                <summary className={styles.infoDisclosureSummary}>
                  Context notes
                  {visibleInfoCount > 0 ? ` (${visibleInfoCount})` : ""}
                </summary>
                <div className={styles.infoDisclosureBody}>
                  {infoIndices.map((i) => {
                    const issue = issues[i];
                    if (!issue || dismissed.has(i)) return null;
                    return (
                      <div
                        key={i}
                        className={`${styles.issueCard} ${styles.issueCardQuiet}`}
                      >
                        <div className={`${styles.issueMeta} ${styles.issueMetaInfo}`}>info</div>
                        <div className={styles.issueSummary}>{issue.summary}</div>
                        {issue.details ? <div className={styles.issueDetails}>{issue.details}</div> : null}
                        {issue.handlingHint ? (
                          <span className={styles.hintPill}>Hint: {issue.handlingHint.replace(/_/g, " ")}</span>
                        ) : null}
                        {issue.candidateItemId ? (
                          <div className={styles.issueRelatedId}>Related: {issue.candidateItemId}</div>
                        ) : null}
                        <div className={styles.issueActions}>
                          <Button
                            type="button"
                            size="xs"
                            variant="default"
                            tone="glass"
                            onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                          >
                            Dismiss
                          </Button>
                          {canTag ? (
                            <Button
                              type="button"
                              size="xs"
                              variant="default"
                              tone="glass"
                              disabled={tagBusy}
                              onClick={() => void applyTags(["reviewed_finding_ack"])}
                            >
                              Tag: acknowledged
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </aside>
    </>
  );

  return createPortal(modal, getVigilPortalRoot());
}
