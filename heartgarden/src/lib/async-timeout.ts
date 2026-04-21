/** Default cap for Anthropic `messages.create` calls (configurable via `HEARTGARDEN_ANTHROPIC_TIMEOUT_MS`). */
const DEFAULT_ANTHROPIC_MS = 120_000;

export async function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
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
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function anthropicLlmDeadlineMs(): number {
  const raw = (process.env.HEARTGARDEN_ANTHROPIC_TIMEOUT_MS ?? "").trim();
  if (!raw) return DEFAULT_ANTHROPIC_MS;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 5000 && n <= 600_000) return Math.floor(n);
  return DEFAULT_ANTHROPIC_MS;
}
