"use client";

import styles from "./ArchitecturalCanvasApp.module.css";

export type LoreImportUploadMode = "one_note" | "many_loose" | "many_folders";

const LAND_MODE_OPTIONS: { id: LoreImportUploadMode; title: string; description: string }[] = [
  {
    id: "one_note",
    title: "One note",
    description: "Drop the whole document as one card. No AI planning.",
  },
  {
    id: "many_loose",
    title: "Many loose",
    description: "Extract entities and drop them on this canvas. No folders.",
  },
  {
    id: "many_folders",
    title: "Many in folders",
    description: "Extract entities and organize them into folders.",
  },
];

/**
 * “How should this import land?” options — same Smart Import question-wizard option styling
 * (`smartImportWizardOptions` / `smartImportWizardOption` in `ArchitecturalCanvasApp.module.css`).
 * Use this in the app and in Storybook so copy and layout stay in one place.
 */
export function LoreImportLandModeRadios(props: {
  mode: LoreImportUploadMode;
  onModeChange: (mode: LoreImportUploadMode) => void;
  /** Passed to `name` on each radio; scope when multiple groups exist (e.g. Storybook + tests). */
  name?: string;
}) {
  const { mode, onModeChange, name = "import-mode" } = props;

  return (
    <div
      className={`${styles.smartImportWizardOptions} ${styles.importUploadPopoverLandModeOptions}`}
      role="radiogroup"
      aria-label="How this import should land on the canvas"
    >
      {LAND_MODE_OPTIONS.map((opt) => (
        <label key={opt.id} className={styles.smartImportWizardOption}>
          <input
            type="radio"
            name={name}
            checked={mode === opt.id}
            onChange={() => onModeChange(opt.id)}
          />
          <span>
            <strong>{opt.title}</strong>
            <small>{opt.description}</small>
          </span>
        </label>
      ))}
    </div>
  );
}
