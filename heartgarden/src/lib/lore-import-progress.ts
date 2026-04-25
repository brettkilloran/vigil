export interface LoreImportProgress {
  message: string;
  meta?: Record<string, unknown>;
  phase: string;
  step?: number;
  total?: number;
}

export type LoreImportProgressReporter = (
  progress: LoreImportProgress
) => void | Promise<void>;
