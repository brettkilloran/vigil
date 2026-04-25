"use client";

import styles from "./ArchitecturalCanvasApp.module.css";

export type LoreImportScopeMode = "current_subtree" | "gm_workspace";

const SCOPE_MODE_OPTIONS: {
  id: LoreImportScopeMode;
  title: string;
  description: string;
}[] = [
  {
    description: "Keep import targets inside this space branch only.",
    id: "current_subtree",
    title: "This space & its folders",
  },
  {
    description: "Allow matching and placement across all GM-visible spaces.",
    id: "gm_workspace",
    title: "Entire GM workspace",
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
      aria-label="Where this import can place notes"
      className={`${styles.smartImportWizardOptions} ${styles.importUploadPopoverLandModeOptions}`}
      role="radiogroup"
    >
      {SCOPE_MODE_OPTIONS.map((opt) => (
        <label className={styles.smartImportWizardOption} key={opt.id}>
          <input
            checked={scope === opt.id}
            name={name}
            onChange={() => onScopeChange(opt.id)}
            type="radio"
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
