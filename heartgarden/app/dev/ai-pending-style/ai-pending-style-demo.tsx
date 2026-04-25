"use client";

import type { JSONContent } from "@tiptap/core";
import { useState } from "react";

import { HeartgardenDocEditor } from "@/src/components/editing/heartgarden-doc-editor";
import canvasStyles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import { Button } from "@/src/components/ui/button";
import { Tag } from "@/src/components/ui/tag";

import styles from "./ai-pending-style-demo.module.css";

/** Two hgAiPending ranges → two margin Accept buttons (matches real focus / canvas hgDoc). */
const FOCUS_MARGIN_PREVIEW_DOC: JSONContent = {
  content: [
    {
      content: [
        { text: "Approved line. ", type: "text" },
        {
          marks: [{ type: "hgAiPending" }],
          text: "First pending AI clause — check the right margin.",
          type: "text",
        },
      ],
      type: "paragraph",
    },
    {
      content: [
        {
          marks: [{ type: "hgAiPending" }],
          text: "Second pending block in another paragraph (separate Accept).",
          type: "text",
        },
      ],
      type: "paragraph",
    },
  ],
  type: "doc",
};

/**
 * Static preview of import / LLM “pending review” styling (HTML spans + canvas card chrome).
 * Open: /dev/ai-pending-style
 */
export function AiPendingStyleDemo() {
  const [marginPreviewDoc, setMarginPreviewDoc] = useState<JSONContent>(() =>
    structuredClone(FOCUS_MARGIN_PREVIEW_DOC)
  );

  return (
    <div className={styles.shell}>
      <h1
        style={{
          color: "var(--sem-text-primary)",
          fontSize: "1.125rem",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          margin: "0 0 8px",
        }}
      >
        Unreviewed AI / import text — style preview
      </h1>
      <p className={styles.url}>
        Route: <a href="/dev/ai-pending-style">/dev/ai-pending-style</a>
      </p>
      <p className={styles.intro}>
        Pending text uses a <strong>soft violet tint</strong> (not underlined)
        so it does not look like a link. The same spans render on the{" "}
        <strong>canvas card</strong>, in <strong>focus mode</strong> (expanded
        editor), and in lore hybrid notes (TipTap <code>hgAiPending</code>{" "}
        mark).
      </p>
      <ul className={styles.flowList}>
        <li>
          <strong>Canvas:</strong> “Unreviewed” chip + <strong>Accept</strong>{" "}
          in the card header clears highlights and marks the item reviewed.
        </li>
        <li>
          <strong>Focus mode:</strong> the same chip, header{" "}
          <strong>Accept</strong>, and a short hint appear under{" "}
          {"“EDITING // …”."}
          In the TipTap body, each pending range also gets its own
          <strong>Accept</strong> in the <strong>right margin</strong> (see live
          preview below).
        </li>
        <li>
          <strong>Inline:</strong> typing inside highlighted text removes the
          tint for that range; when nothing is left highlighted, the item’s
          review flag clears on save.
        </li>
      </ul>

      <h2 className={styles.sectionTitle} style={{ marginBottom: 12 }}>
        Focus mode (mock)
      </h2>
      <p className={styles.intro} style={{ marginBottom: 16 }}>
        Real UI lives in the focus overlay; this block copies the same header
        layout and body tokens.
      </p>
      <div
        className={`${styles.focusMockSheet} ${styles.demoCard}`}
        style={{ marginBottom: 32 }}
      >
        <div className={styles.focusMockHeader}>
          <div className={canvasStyles.focusHeaderLead}>
            <div className={canvasStyles.focusMeta}>
              {"EDITING // DEMO1234"}
            </div>
            <div className={canvasStyles.focusAiReviewBar}>
              <Tag variant="llmLight">Unreviewed</Tag>
              <Button size="xs" tone="glass" type="button" variant="ghost">
                Accept
              </Button>
              <span className={canvasStyles.focusAiReviewHint}>
                Typing in highlighted text also clears it; Save applies like any
                edit.
              </span>
            </div>
          </div>
        </div>
        <div
          className={`${styles.focusMockBody} ${canvasStyles.focusBody}`}
          style={{ minHeight: "auto", opacity: 1, transform: "none" }}
        >
          <p style={{ marginTop: 0 }}>
            Normal focus body copy uses the default ink color.{" "}
            <span className="hgAiPending" data-hg-ai-pending="true">
              This sentence is still marked as import / LLM output.
            </span>{" "}
            The rest is yours.
          </p>
        </div>
      </div>

      <div className={`${styles.tiptapMarginPreviewSheet} ${styles.demoCard}`}>
        <h2 className={styles.sectionTitle} style={{ marginBottom: 8 }}>
          Focus body — margin Accept (live TipTap)
        </h2>
        <p className={styles.intro} style={{ marginBottom: 16 }}>
          The <strong>per-section</strong> check buttons only exist in the real{" "}
          <code>HeartgardenDocEditor</code> when the document contains{" "}
          <code>hgAiPending</code> marks. Static HTML spans (mock section above)
          do not mount this rail. Edit the text or click Accept to see the mark
          strip and the header chip clear on save in the real app.
        </p>
        <div className={styles.tiptapMarginPreviewBody}>
          <HeartgardenDocEditor
            chromeRole="focus"
            className={canvasStyles.focusBody}
            editable
            enableDragHandle
            onChange={setMarginPreviewDoc}
            placeholder="Write here, or type / for blocks…"
            showAiPendingGutter
            surfaceKey="dev-ai-pending-focus-margin"
            value={marginPreviewDoc}
          />
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.column}>
          <h2 className={styles.sectionTitle}>Default note (light)</h2>
          <div
            className={`${canvasStyles.entityNode} ${canvasStyles.themeDefault} ${canvasStyles.a4DocumentNode} ${styles.demoCard}`}
            style={{ maxWidth: "100%", width: 380 }}
          >
            <div
              className={canvasStyles.nodeHeader}
              style={{ cursor: "default" }}
            >
              <div className={canvasStyles.nodeTitleRow}>
                <Tag variant="llmLight">Unreviewed</Tag>
                <span className={canvasStyles.nodeTitle}>Merged import</span>
              </div>
            </div>
            <div
              className={`${canvasStyles.nodeBody} ${canvasStyles.a4DocumentBody}`}
            >
              <p>
                Your existing note text stays at normal body color. After a
                merge, the import adds a block below.
              </p>
              <p>
                <span className="hgAiPending" data-hg-ai-pending="true">
                  This paragraph was appended by the import pipeline and is
                  wrapped in a pending span. Edit or Accept to clear.
                </span>
              </p>
              <p>
                Approved line.{" "}
                <span className="hgAiPending" data-hg-ai-pending="true">
                  Mid-sentence pending AI clause
                </span>{" "}
                and the rest is approved.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.column}>
          <h2 className={styles.sectionTitle}>Code note (dark)</h2>
          <div
            className={`${canvasStyles.entityNode} ${canvasStyles.themeCode} ${canvasStyles.a4DocumentNode} ${styles.demoCard}`}
            style={{ maxWidth: "100%", width: 380 }}
          >
            <div
              className={canvasStyles.nodeHeader}
              style={{ cursor: "default" }}
            >
              <div className={canvasStyles.nodeTitleRow}>
                <Tag variant="llmCode">Unreviewed</Tag>
                <span className={canvasStyles.nodeTitle}>Snippet</span>
              </div>
            </div>
            <div
              className={`${canvasStyles.nodeBody} ${canvasStyles.a4DocumentBody}`}
            >
              <p
                style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: 13,
                }}
              >
                <span className="hgAiPending" data-hg-ai-pending="true">
                  Pending AI line in a code-themed card (hgDoc uses the same
                  mark in the editor).
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className={styles.column}>
          <h2 className={styles.sectionTitle}>
            TipTap hgDoc (read-only JSON → HTML)
          </h2>
          <p
            style={{
              color: "var(--sem-text-muted)",
              fontSize: 12,
              lineHeight: 1.5,
              margin: 0,
              maxWidth: 380,
            }}
          >
            In the app, hgDoc surfaces render the <code>hgAiPending</code> mark
            with the same global span styling after export.
          </p>
        </div>
      </div>
    </div>
  );
}
