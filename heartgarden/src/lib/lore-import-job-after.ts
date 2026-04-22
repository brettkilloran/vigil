import { after } from "next/server";

import { processLoreImportJob } from "@/src/lib/lore-import-job-process";

/** Run smart-import planning after the HTTP response returns (Next.js `after`). */
export function scheduleLoreImportJobProcessing(jobId: string): void {
  const runJob = async () => {
    await processLoreImportJob(jobId).catch((e) => {
      console.error("[lore-import-job] unexpected failure", jobId, e);
    });
  };
  try {
    after(runJob);
  } catch (error) {
    console.warn("[lore-import-job] after() unavailable; running immediately", {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    void runJob();
  }
}
