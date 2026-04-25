export type LoreImportProgress = {
  phase: string;
  step?: number;
  total?: number;
  message: string;
  meta?: Record<string, unknown>;
};

export type LoreImportProgressReporter = (
  progress: LoreImportProgress
) => void | Promise<void>;
