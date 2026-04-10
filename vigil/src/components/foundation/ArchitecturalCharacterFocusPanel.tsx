"use client";

import { BufferedContentEditable } from "@/src/components/editing/BufferedContentEditable";
import type {
  ChecklistDeletionClassNames,
  WikiLinkAssistConfig,
} from "@/src/components/editing/BufferedContentEditable";
import loreEntityCardStyles from "@/src/components/foundation/lore-entity-card.module.css";

/** Subset of `ArchitecturalCanvasApp.module.css` keys used by this panel. */
export type ArchitecturalCanvasFocusStyles = {
  focusCharacterHybridRoot: string;
  focusCharacterStructuredWrap: string;
  focusLoreCredentialStage: string;
  focusBody: string;
  focusLoreCharacterCredential: string;
  focusCharacterPaperSection: string;
  focusCharacterPaperLabel: string;
  focusCharacterPaperStage: string;
  focusCharacterPaperBody: string;
};

export type ArchitecturalCharacterFocusPanelProps = {
  styles: ArchitecturalCanvasFocusStyles;
  structuredHtml: string;
  paperHtml: string;
  onStructuredCommit: (html: string) => void;
  onPaperCommit: (html: string) => void;
  checklistDeletion: ChecklistDeletionClassNames;
  normalizeBody: (html: string) => string;
  richDocCommand: (command: string, value?: string) => void;
  wikiLinkAssist: WikiLinkAssistConfig | null;
  documentBlockDrag: {
    handleClass: string;
    taskItemClass: string;
  } | null;
  paperEmptyPlaceholder: string;
};

/**
 * Hybrid Dropbox-Paper-style character focus: structured v11 credential plate on top,
 * long-form notes editor below (toolbar targets the paper region from the parent dock).
 */
export function ArchitecturalCharacterFocusPanel({
  styles,
  structuredHtml,
  paperHtml,
  onStructuredCommit,
  onPaperCommit,
  checklistDeletion,
  normalizeBody,
  richDocCommand,
  wikiLinkAssist,
  documentBlockDrag,
  paperEmptyPlaceholder,
}: ArchitecturalCharacterFocusPanelProps) {
  return (
    <div
      className={styles.focusCharacterHybridRoot}
      data-hg-character-focus="true"
      data-hg-rich-editor-scope="character-focus"
    >
      <section
        className={`${styles.focusCharacterStructuredWrap} ${loreEntityCardStyles.characterFocusFieldHost}`}
        aria-label="Character fields"
      >
        <div className={styles.focusLoreCredentialStage}>
          <BufferedContentEditable
            value={structuredHtml}
            className={`${styles.focusBody} ${styles.focusLoreCharacterCredential}`}
            editable
            spellCheck={false}
            debounceMs={150}
            dataAttribute="data-focus-body-editor"
            checklistDeletion={checklistDeletion}
            documentBlockDrag={null}
            richDocCommand={undefined}
            emptyPlaceholder={null}
            onCommit={(nextHtml) => onStructuredCommit(normalizeBody(nextHtml))}
            wikiLinkAssist={null}
          />
        </div>
      </section>

      <section className={styles.focusCharacterPaperSection} aria-label="Long-form notes">
        <div className={styles.focusCharacterPaperLabel}>Notes</div>
        <div
          className={styles.focusCharacterPaperStage}
          data-hg-rich-prose-body="true"
        >
          <BufferedContentEditable
            value={paperHtml}
            className={`${styles.focusBody} ${styles.focusCharacterPaperBody}`}
            editable
            spellCheck={false}
            debounceMs={150}
            dataAttribute="data-focus-body-editor"
            checklistDeletion={checklistDeletion}
            documentBlockDrag={documentBlockDrag}
            richDocCommand={richDocCommand}
            emptyPlaceholder={paperEmptyPlaceholder}
            onCommit={(nextHtml) => onPaperCommit(normalizeBody(nextHtml))}
            wikiLinkAssist={wikiLinkAssist}
          />
        </div>
      </section>
    </div>
  );
}
