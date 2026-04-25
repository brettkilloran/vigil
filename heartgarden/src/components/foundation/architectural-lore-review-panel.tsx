"use client";

import { Article, Sparkle, WarningCircle, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import styles from "@/src/components/foundation/ArchitecturalLoreReviewPanel.module.css";
import { ArchitecturalTooltip } from "@/src/components/foundation/architectural-tooltip";
import { Button } from "@/src/components/ui/button";
import { cx } from "@/src/lib/cx";
import { getVigilPortalRoot } from "@/src/lib/dom-portal-root";
import { HEARTGARDEN_CHROME_ICON } from "@/src/lib/vigil-ui-classes";
import { playVigilUiSound } from "@/src/lib/vigil-ui-sounds";

export interface VaultReviewDraft {
  bodyText: string;
  excludeItemId?: string;
  /** Short label for the header (e.g. note title). */
  targetLabel: string;
  title: string;
}

export interface VaultReviewIssue {
  candidateItemId?: string;
  details?: string;
  handlingHint?: string;
  severity: string;
  summary: string;
}

const NON_LOWER_ALNUM_RUN_RE = /[^a-z0-9]+/g;
const LEADING_TRAILING_UNDERSCORE_RE = /^_+|_+$/g;
const STARTS_WITH_LOWERCASE_RE = /^[a-z]/;

const PRESET_TAGS: { id: string; label: string; hint: string }[] = [
  {
    hint: "No rules weight — mood / color only",
    id: "flavor_not_crunch",
    label: "Flavor, not crunch",
  },
  {
    hint: "Truth status unclear; label, do not move",
    id: "uncertain_canon",
    label: "Uncertain canon",
  },
  {
    hint: "Meta or facilitator text",
    id: "gm_note_layer",
    label: "GM / OOC layer",
  },
  {
    hint: "Past-tense lore, not current facts",
    id: "historical_in_setting",
    label: "Historical in-setting",
  },
  {
    hint: "Consider a reference, not a folder move",
    id: "needs_crosslink",
    label: "Wants a link",
  },
  {
    hint: "Fine where it is — metadata only",
    id: "no_structural_change",
    label: "No sort / move",
  },
];

function slugifyTag(raw: string): string | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(NON_LOWER_ALNUM_RUN_RE, "_")
    .replace(LEADING_TRAILING_UNDERSCORE_RE, "")
    .slice(0, 48);
  if (!(s && STARTS_WITH_LOWERCASE_RE.test(s))) {
    return null;
  }
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
  }, []);

  const { attentionIndices, infoIndices } = useMemo(() => {
    const attention: number[] = [];
    const info: number[] = [];
    for (const [i, issue] of issues.entries()) {
      if (issue.severity === "info") {
        info.push(i);
      } else {
        attention.push(i);
      }
    }
    return { attentionIndices: attention, infoIndices: info };
  }, [issues]);

  const infoDisclosureKey = useMemo(
    () =>
      infoIndices
        .map((idx) => `${idx}:${issues[idx]?.summary ?? ""}`)
        .join("‖"),
    [infoIndices, issues]
  );

  const visibleAttentionCount = useMemo(
    () => attentionIndices.filter((i) => !dismissed.has(i)).length,
    [attentionIndices, dismissed]
  );

  const visibleInfoCount = useMemo(
    () => infoIndices.filter((i) => !dismissed.has(i)).length,
    [infoIndices, dismissed]
  );

  const applyTags = useCallback(
    async (tags: string[]) => {
      const clean = [
        ...new Set(tags.map(slugifyTag).filter(Boolean) as string[]),
      ];
      if (clean.length === 0) {
        return;
      }
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
    [onAppendTags]
  );

  if (!open) {
    return null;
  }

  const canTag = Boolean(draft?.excludeItemId);

  const modal = (
    <>
      <Button
        aria-label="Close vault review"
        className={styles.backdrop}
        disabled={loading}
        onClick={onClose}
        tone="glass"
        type="button"
        variant="ghost"
      />
      <aside
        aria-labelledby="hg-vault-review-title"
        aria-modal="true"
        className={styles.panel}
        role="dialog"
      >
        <div className={styles.panelHeader}>
          <div className={styles.headerMain}>
            <span className={cx(styles.microLabel, styles.drawerEyebrow)}>
              Beta
            </span>
            <h2 className={styles.panelTitle} id="hg-vault-review-title">
              Vault review
            </h2>
            <p className={styles.introText}>
              Consistency pass plus light semantic tags. Many findings are fine
              to <strong className={styles.introStrong}>label</strong> instead
              of moving or flagging as errors.
            </p>
            {draft ? (
              <div className={styles.targetCard}>
                <Article
                  aria-hidden
                  className={cx(HEARTGARDEN_CHROME_ICON, styles.targetIconTint)}
                  size={15}
                  weight="duotone"
                />
                <div className={styles.targetMeta}>
                  <span
                    className={cx(styles.microLabel, styles.metadataKicker)}
                  >
                    Active note
                  </span>
                  <span className={styles.targetTitle}>
                    {draft.targetLabel}
                  </span>
                </div>
              </div>
            ) : (
              <div className={styles.calloutWarn} role="status">
                <WarningCircle
                  aria-hidden
                  className={styles.calloutWarnIcon}
                  size={18}
                  weight="fill"
                />
                <p className={styles.calloutWarnText}>
                  Select one text note or open focus mode on a note to run a
                  pass.
                </p>
              </div>
            )}
          </div>
          <div className={styles.headerAside}>
            <ArchitecturalTooltip content="Close" delayMs={200} side="left">
              <Button
                aria-label="Close vault review"
                className={styles.closeFab}
                disabled={loading}
                iconOnly
                onClick={onClose}
                size="sm"
                tone="glass"
                type="button"
                variant="default"
              >
                <X
                  aria-hidden
                  className={HEARTGARDEN_CHROME_ICON}
                  size={15}
                  weight="bold"
                />
              </Button>
            </ArchitecturalTooltip>
          </div>
        </div>

        <div className={styles.panelBody}>
          <div className={styles.ctaBand}>
            <Button
              className={styles.primaryCta}
              disabled={!draft || loading}
              isLoading={loading}
              leadingIcon={
                loading ? undefined : (
                  <Sparkle
                    aria-hidden
                    className={HEARTGARDEN_CHROME_ICON}
                    size={15}
                    weight="fill"
                  />
                )
              }
              onClick={() => {
                setDismissed(new Set());
                onRunAnalysis();
              }}
              size="md"
              type="button"
              variant="primary"
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
              <p className={styles.sectionHint}>
                From the last pass — tap to append to this note.
              </p>
              <div className={styles.chipRow}>
                {suggestedNoteTags.map((tag) => (
                  <Button
                    className={styles.chip}
                    disabled={!canTag || tagBusy}
                    key={tag}
                    onClick={() => {
                      applyTags([tag]);
                    }}
                    size="xs"
                    tone="glass"
                    type="button"
                    variant="subtle"
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
              Metadata only — search and future tooling. No canvas moves or
              sorting.
            </p>
            <div className={styles.chipGrid}>
              {PRESET_TAGS.map((t) => (
                <ArchitecturalTooltip
                  content={t.hint}
                  delayMs={240}
                  key={t.id}
                  side="bottom"
                >
                  <Button
                    className={styles.chip}
                    disabled={!canTag || tagBusy || loading}
                    onClick={() => {
                      applyTags([t.id]);
                    }}
                    size="xs"
                    tone="glass"
                    type="button"
                    variant="subtle"
                  >
                    {t.label}
                  </Button>
                </ArchitecturalTooltip>
              ))}
            </div>
            {!canTag && draft ? (
              <p className={styles.syncHint}>
                Tags need a synced note — save to Neon first if this card is
                new.
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
            {!(loading || error) &&
            issues.length === 0 &&
            semanticSummary == null &&
            suggestedNoteTags.length === 0 ? (
              <p className={styles.emptyHint}>
                Run an analysis to compare this note against retrieved vault
                excerpts. Results land here as short rows you can dismiss or
                tag.
              </p>
            ) : null}
            {!(loading || error) &&
            issues.length > 0 &&
            visibleAttentionCount === 0 &&
            visibleInfoCount > 0 ? (
              <p className={styles.mutedLine}>
                No contradictions or warnings — context notes are below if you
                want detail.
              </p>
            ) : null}
            {!loading &&
            issues.length === 0 &&
            (semanticSummary || suggestedNoteTags.length > 0) ? (
              <p className={styles.mutedLine}>
                No conflict rows — optional tags above still apply.
              </p>
            ) : null}
            <ul className={styles.issueList}>
              {attentionIndices.map((i) => {
                const issue = issues[i];
                if (!issue || dismissed.has(i)) {
                  return null;
                }
                const sevClass =
                  issue.severity === "contradiction"
                    ? styles.issueMetaContradiction
                    : styles.issueMetaWarning;
                return (
                  <li
                    className={styles.issueCard}
                    key={`${issue.severity}:${issue.candidateItemId ?? ""}:${issue.summary}:${i}`}
                  >
                    <div className={`${styles.issueMeta} ${sevClass}`}>
                      {issue.severity}
                    </div>
                    <div className={styles.issueSummary}>{issue.summary}</div>
                    {issue.details ? (
                      <div className={styles.issueDetails}>{issue.details}</div>
                    ) : null}
                    {issue.handlingHint ? (
                      <span className={styles.hintPill}>
                        Hint: {issue.handlingHint.replace(/_/g, " ")}
                      </span>
                    ) : null}
                    {issue.candidateItemId ? (
                      <div className={styles.issueRelatedId}>
                        Related: {issue.candidateItemId}
                      </div>
                    ) : null}
                    <div className={styles.issueActions}>
                      <Button
                        onClick={() =>
                          setDismissed((prev) => new Set(prev).add(i))
                        }
                        size="xs"
                        tone="glass"
                        type="button"
                        variant="default"
                      >
                        Dismiss
                      </Button>
                      {canTag ? (
                        <Button
                          disabled={tagBusy}
                          onClick={() => {
                            applyTags(["reviewed_finding_ack"]);
                          }}
                          size="xs"
                          tone="glass"
                          type="button"
                          variant="default"
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
              <details
                className={styles.infoDisclosure}
                key={infoDisclosureKey}
              >
                <summary className={styles.infoDisclosureSummary}>
                  Context notes
                  {visibleInfoCount > 0 ? ` (${visibleInfoCount})` : ""}
                </summary>
                <div className={styles.infoDisclosureBody}>
                  {infoIndices.map((i) => {
                    const issue = issues[i];
                    if (!issue || dismissed.has(i)) {
                      return null;
                    }
                    return (
                      <div
                        className={`${styles.issueCard} ${styles.issueCardQuiet}`}
                        key={`${issue.severity}:${issue.candidateItemId ?? ""}:${issue.summary}:${i}`}
                      >
                        <div
                          className={`${styles.issueMeta} ${styles.issueMetaInfo}`}
                        >
                          info
                        </div>
                        <div className={styles.issueSummary}>
                          {issue.summary}
                        </div>
                        {issue.details ? (
                          <div className={styles.issueDetails}>
                            {issue.details}
                          </div>
                        ) : null}
                        {issue.handlingHint ? (
                          <span className={styles.hintPill}>
                            Hint: {issue.handlingHint.replace(/_/g, " ")}
                          </span>
                        ) : null}
                        {issue.candidateItemId ? (
                          <div className={styles.issueRelatedId}>
                            Related: {issue.candidateItemId}
                          </div>
                        ) : null}
                        <div className={styles.issueActions}>
                          <Button
                            onClick={() =>
                              setDismissed((prev) => new Set(prev).add(i))
                            }
                            size="xs"
                            tone="glass"
                            type="button"
                            variant="default"
                          >
                            Dismiss
                          </Button>
                          {canTag ? (
                            <Button
                              disabled={tagBusy}
                              onClick={() => {
                                applyTags(["reviewed_finding_ack"]);
                              }}
                              size="xs"
                              tone="glass"
                              type="button"
                              variant="default"
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
