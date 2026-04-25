/** Default cap for user-facing Anthropic `messages.create` calls. */
const DEFAULT_ANTHROPIC_MS = 120_000;
/** Background/job Anthropic calls can run longer on huge imports. */
const DEFAULT_ANTHROPIC_JOB_MS = 300_000;

function parseDeadlineMs(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }
  const n = Number(trimmed);
  if (Number.isFinite(n) && n >= 5000 && n <= 600_000) {
    return Math.floor(n);
  }
  return fallback;
}

export async function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export function anthropicLlmDeadlineMs(): number {
  return parseDeadlineMs(
    process.env.HEARTGARDEN_ANTHROPIC_TIMEOUT_MS ?? "",
    DEFAULT_ANTHROPIC_MS
  );
}

export function anthropicLlmJobDeadlineMs(): number {
  return parseDeadlineMs(
    process.env.HEARTGARDEN_ANTHROPIC_JOB_TIMEOUT_MS ?? "",
    DEFAULT_ANTHROPIC_JOB_MS
  );
}
