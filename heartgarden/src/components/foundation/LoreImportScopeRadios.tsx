"use client";

import styles from "./ArchitecturalCanvasApp.module.css";

export type LoreImportScopeMode = "current_subtree" | "gm_workspace";

const SCOPE_MODE_OPTIONS: { id: LoreImportScopeMode; title: string; description: string }[] = [
  {
    id: "current_subtree",
    title: "This space & its folders",
    description: "Keep import targets inside this space branch only.",
  },
  {
    id: "gm_workspace",
    title: "Entire GM workspace",
    description: "Allow matching and placement across all GM-visible spaces.",
  },
];

export function LoreImportScopeRadios(props: {
  scope: LoreImportScopeMode;
  onScopeChange: (scope: LoreImportScopeMode) => void;
  name?: string;
}) {
  const { scope, onScopeChange, name = "import-scope" } = props;
  return (
    <div
      className={`${styles.smartImportWizardOptions} ${styles.importUploadPopoverLandModeOptions}`}
      role="radiogroup"
      aria-label="Where this import can place notes"
    >
      {SCOPE_MODE_OPTIONS.map((opt) => (
        <label key={opt.id} className={styles.smartImportWizardOption}>
          <input
            type="radio"
            name={name}
            checked={scope === opt.id}
            onChange={() => onScopeChange(opt.id)}
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

