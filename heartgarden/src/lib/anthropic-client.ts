import Anthropic from "@anthropic-ai/sdk";

import {
  anthropicLlmDeadlineMs,
  anthropicLlmJobDeadlineMs,
  withDeadline,
} from "@/src/lib/async-timeout";

type AnthropicCreateParams = Parameters<Anthropic["messages"]["create"]>[0];
type AnthropicCreateParamsLoose = Omit<AnthropicCreateParams, "max_tokens"> & {
  max_tokens?: number;
};
type AnthropicMessage = Anthropic.Message;

type CacheTtl = "5m" | "1h";

type CallAnthropicOptions = {
  label: string;
  expectJson?: boolean;
  deadlineMs?: number;
  maxOutputTokens?: number;
  thinkingBudget?: number | "off";
};

type CallAnthropicStreamOptions = {
  label: string;
  deadlineMs?: number;
  maxOutputTokens?: number;
  thinkingBudget?: number | "off";
};

type RunCompletionResult = {
  message: AnthropicMessage;
  text: string;
  stopReason: string | null;
  continuationCount: number;
  retryCount: number;
};

export type CallAnthropicResult = RunCompletionResult & {
  jsonText: string | null;
  parsedJson: unknown | null;
  elapsedMs: number;
};

const CONTINUE_JSON_PROMPT =
  "Continue the previous response. Output only the remaining JSON text. Do not repeat any content already emitted, and do not add markdown or commentary.";
const CONTINUE_TEXT_PROMPT =
  "Continue from where you left off. Do not repeat content already emitted.";
const JSON_REPAIR_PROMPT =
  "Your previous response was not valid JSON. Return corrected JSON only (single JSON object), no markdown fences or prose.";

const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
const MAX_OUTPUT_TOKENS_BY_LABEL: Record<string, number> = {
  "lore.item_meta": 4096,
  "lore.query.answer": 8192,
  "lore.import.outline": 16384,
  "lore.import.merge": 16384,
  "lore.import.clarify": 16384,
  "lore.import.extract": 8192,
  "lore.consistency": 8192,
};

const THINKING_ENABLED_LABELS = new Set<string>([
  "lore.query.answer",
  "lore.import.clarify",
  "lore.consistency",
]);

const clientByApiKey = new Map<string, Anthropic>();
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.floor(n);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCacheTtl(): CacheTtl {
  const raw = (process.env.HEARTGARDEN_ANTHROPIC_CACHE_TTL ?? "").trim().toLowerCase();
  return raw === "1h" ? "1h" : "5m";
}

function cacheControlForSystem(): Record<string, unknown> | null {
  if ((process.env.HEARTGARDEN_ANTHROPIC_CACHE_DISABLED ?? "").trim() === "1") {
    return null;
  }
  const ttl = getCacheTtl();
  return ttl === "1h" ? { type: "ephemeral", ttl: "1h" } : { type: "ephemeral" };
}

function extractText(message: AnthropicMessage): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === "text") parts.push(block.text);
  }
  return parts.join("\n").trim();
}

function extractJsonObject(raw: string): string | null {
  const t = raw.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return t.slice(start, end + 1);
}

function parseJsonCandidate(text: string): { jsonText: string | null; parsed: unknown | null } {
  const candidate = text.trimStart().startsWith("{") ? text : `{${text}`;
  const jsonText = extractJsonObject(candidate);
  if (!jsonText) return { jsonText: null, parsed: null };
  try {
    return { jsonText, parsed: JSON.parse(jsonText) as unknown };
  } catch {
    return { jsonText, parsed: null };
  }
}

function isRetryableAnthropicError(err: unknown): boolean {
  const status = Number(
    (err as { status?: unknown; response?: { status?: unknown } })?.status ??
      (err as { response?: { status?: unknown } })?.response?.status,
  );
  if ([429, 500, 502, 503, 504, 529].includes(status)) return true;
  const code = String((err as { code?: unknown })?.code ?? "").toUpperCase();
  if (["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND"].includes(code)) {
    return true;
  }
  const msg = String((err as { message?: unknown })?.message ?? "").toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("socket") ||
    msg.includes("timed out") ||
    msg.includes("overloaded")
  );
}

function isAssistantPrefillUnsupportedError(err: unknown): boolean {
  const status = Number((err as { status?: unknown })?.status ?? 0);
  if (status !== 400) return false;
  const msg = String((err as { message?: unknown })?.message ?? "").toLowerCase();
  return (
    msg.includes("assistant message prefill") ||
    msg.includes("conversation must end with a user message")
  );
}

function shouldEmitSampledMetric(): boolean {
  const raw = (process.env.HEARTGARDEN_ANTHROPIC_METRICS_SAMPLE_RATE ?? "").trim();
  if (!raw) return false;
  const rate = Number(raw);
  if (!Number.isFinite(rate)) return false;
  const clamped = Math.max(0, Math.min(1, rate));
  return Math.random() < clamped;
}

function resolveMaxOutputTokens(label: string, override?: number): number {
  const envOverride = envInt("HEARTGARDEN_ANTHROPIC_MAX_OUTPUT_TOKENS", 0, 256, 64_000);
  if (envOverride > 0) return envOverride;
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return Math.floor(override);
  }
  return MAX_OUTPUT_TOKENS_BY_LABEL[label] ?? DEFAULT_MAX_OUTPUT_TOKENS;
}

function resolveDeadlineMs(label: string, override?: number): number {
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return Math.floor(override);
  }
  return label.startsWith("lore.query.") ? anthropicLlmDeadlineMs() : anthropicLlmJobDeadlineMs();
}

function resolveThinking(
  label: string,
  override?: number | "off",
): Anthropic.ThinkingConfigParam | undefined {
  if ((process.env.HEARTGARDEN_ANTHROPIC_THINKING_DISABLED ?? "").trim() === "1") {
    return undefined;
  }
  if (override === "off") return undefined;
  const enabled = THINKING_ENABLED_LABELS.has(label);
  if (!enabled && override === undefined) return undefined;
  const budget =
    typeof override === "number"
      ? Math.floor(override)
      : envInt("HEARTGARDEN_ANTHROPIC_THINKING_BUDGET", 8192, 1024, 64_000);
  return { type: "enabled", budget_tokens: budget };
}

async function createWithRetry(
  client: Anthropic,
  params: AnthropicCreateParams,
  deadlineMs: number,
  label: string,
): Promise<{ message: AnthropicMessage; retryCount: number }> {
  const maxRetries = envInt("HEARTGARDEN_ANTHROPIC_MAX_RETRIES", 3, 0, 8);
  let retries = 0;
  while (true) {
    try {
      const message = (await withDeadline(
        client.messages.create(params),
        deadlineMs,
        `${label}_anthropic`,
      )) as AnthropicMessage;
      return { message, retryCount: retries };
    } catch (error) {
      if (retries >= maxRetries || !isRetryableAnthropicError(error)) {
        throw error;
      }
      retries += 1;
      const base = 1000 * 2 ** (retries - 1);
      const jitter = Math.floor(Math.random() * base);
      await sleep(base + jitter);
    }
  }
}

function withMaxTokens(params: AnthropicCreateParamsLoose, maxTokens: number): AnthropicCreateParams {
  return {
    ...(params as unknown as Record<string, unknown>),
    max_tokens: maxTokens,
  } as AnthropicCreateParams;
}

async function runCompletion(args: {
  client: Anthropic;
  baseParams: AnthropicCreateParamsLoose;
  label: string;
  deadlineMs: number;
  expectJson: boolean;
  includeJsonPrefill: boolean;
  maxOutputTokens: number;
  thinking?: Anthropic.ThinkingConfigParam;
}): Promise<RunCompletionResult> {
  const maxContinuations = envInt("HEARTGARDEN_ANTHROPIC_MAX_CONTINUATIONS", 3, 0, 12);
  const baseMessages = Array.isArray((args.baseParams as { messages?: unknown }).messages)
    ? ([...(args.baseParams as { messages: unknown[] }).messages] as unknown[])
    : [];

  let messages = [...baseMessages];
  if (args.expectJson && args.includeJsonPrefill) {
    messages.push({ role: "assistant", content: "{" });
  }

  let text = "";
  let continuationCount = 0;
  let retryCount = 0;
  let lastMessage: AnthropicMessage | null = null;
  let stopReason: string | null = null;

  while (true) {
    const params = {
      ...(args.baseParams as unknown as Record<string, unknown>),
      messages,
    } as AnthropicCreateParams;
    const withTokens = withMaxTokens(params, args.maxOutputTokens);
    const finalParams = withTokens as AnthropicCreateParams & {
      thinking?: Anthropic.ThinkingConfigParam;
    };
    if (args.thinking) {
      finalParams.thinking = args.thinking;
    }

    const { message, retryCount: callRetries } = await createWithRetry(
      args.client,
      finalParams,
      args.deadlineMs,
      args.label,
    );
    retryCount += callRetries;
    lastMessage = message;
    stopReason = String((message as { stop_reason?: unknown }).stop_reason ?? "");
    const piece = extractText(message);
    text += piece;

    if (stopReason !== "max_tokens" || continuationCount >= maxContinuations) break;

    continuationCount += 1;
    messages = [
      ...messages,
      { role: "assistant", content: piece },
      { role: "user", content: args.expectJson ? CONTINUE_JSON_PROMPT : CONTINUE_TEXT_PROMPT },
    ];
  }

  if (!lastMessage) {
    throw new Error(`${args.label}: no Anthropic response received`);
  }
  return { message: lastMessage, text, stopReason, continuationCount, retryCount };
}

function logDebug(info: Record<string, unknown>): void {
  const debugEnabled =
    (process.env.HEARTGARDEN_ANTHROPIC_DEBUG ?? "").trim() === "1" ||
    (process.env.HEARTGARDEN_ANTHROPIC_CACHE_DEBUG ?? "").trim() === "1";
  if (!debugEnabled) return;
  try {
    console.info(`[anthropic] ${JSON.stringify(info)}`);
  } catch {
    console.info("[anthropic] debug log serialization failed");
  }
}

function logSampledMetric(info: Record<string, unknown>): void {
  if (!shouldEmitSampledMetric()) return;
  try {
    console.info(`[anthropic-metric] ${JSON.stringify(info)}`);
  } catch {
    console.info("[anthropic-metric] metric log serialization failed");
  }
}

export function getAnthropicClient(apiKey: string): Anthropic {
  const cached = clientByApiKey.get(apiKey);
  if (cached) return cached;
  const next = new Anthropic({ apiKey });
  clientByApiKey.set(apiKey, next);
  return next;
}

export function buildCachedSystem(text: string): Anthropic.TextBlockParam[] {
  const cacheControl = cacheControlForSystem();
  if (!cacheControl) return [{ type: "text", text }];
  return [
    {
      type: "text",
      text,
      cache_control: cacheControl as unknown as Anthropic.CacheControlEphemeral,
    },
  ];
}

export async function callAnthropic(
  apiKey: string,
  params: AnthropicCreateParamsLoose,
  options: CallAnthropicOptions,
): Promise<CallAnthropicResult> {
  const started = Date.now();
  const label = options.label;
  const expectJson = options.expectJson === true;
  const client = getAnthropicClient(apiKey);
  const maxOutputTokens = resolveMaxOutputTokens(label, options.maxOutputTokens);
  const deadlineMs = resolveDeadlineMs(label, options.deadlineMs);
  const thinking = resolveThinking(label, options.thinkingBudget);

  let includeJsonPrefill = expectJson;
  let initial: RunCompletionResult;
  try {
    initial = await runCompletion({
      client,
      baseParams: params,
      label,
      deadlineMs,
      expectJson,
      includeJsonPrefill,
      maxOutputTokens,
      thinking,
    });
  } catch (error) {
    if (includeJsonPrefill && isAssistantPrefillUnsupportedError(error)) {
      includeJsonPrefill = false;
      initial = await runCompletion({
        client,
        baseParams: params,
        label,
        deadlineMs,
        expectJson,
        includeJsonPrefill: false,
        maxOutputTokens,
        thinking,
      });
    } else {
      throw error;
    }
  }

  let text = initial.text;
  let jsonText: string | null = null;
  let parsedJson: unknown | null = null;
  let retryCount = initial.retryCount;
  let continuationCount = initial.continuationCount;
  let finalMessage = initial.message;
  let stopReason = initial.stopReason;

  if (expectJson) {
    const parsed = parseJsonCandidate(text);
    jsonText = parsed.jsonText;
    parsedJson = parsed.parsed;
    if (parsedJson === null) {
      const repair = await runCompletion({
        client,
        baseParams: {
          ...(params as unknown as Record<string, unknown>),
          messages: [
            ...(Array.isArray((params as { messages?: unknown }).messages)
              ? ([...(params as { messages: unknown[] }).messages] as unknown[])
              : []),
            { role: "assistant", content: text },
            { role: "user", content: JSON_REPAIR_PROMPT },
          ],
        } as AnthropicCreateParams,
        label: `${label}.json_repair`,
        deadlineMs,
        expectJson: true,
        includeJsonPrefill,
        maxOutputTokens,
        thinking,
      });
      retryCount += repair.retryCount;
      continuationCount += repair.continuationCount;
      text = repair.text;
      finalMessage = repair.message;
      stopReason = repair.stopReason;
      const repairedParsed = parseJsonCandidate(text);
      jsonText = repairedParsed.jsonText;
      parsedJson = repairedParsed.parsed;
    }
  }

  const usage = (finalMessage as unknown as { usage?: Record<string, unknown> }).usage ?? {};
  const elapsedMs = Date.now() - started;
  logDebug({
    label,
    model: (params as { model?: unknown }).model,
    stopReason,
    retries: retryCount,
    continuations: continuationCount,
    elapsedMs,
    inputTokens: usage.input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? null,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? null,
  });
  logSampledMetric({
    label,
    model: (params as { model?: unknown }).model,
    stopReason,
    retries: retryCount,
    continuations: continuationCount,
    elapsedMs,
    inputTokens: usage.input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? null,
    cacheReadInputTokens: usage.cache_read_input_tokens ?? null,
  });

  return {
    message: finalMessage,
    text,
    stopReason,
    continuationCount,
    retryCount,
    jsonText,
    parsedJson,
    elapsedMs,
  };
}

async function fetchAnthropicStreamResponse(args: {
  apiKey: string;
  body: Record<string, unknown>;
  deadlineMs: number;
  label: string;
}): Promise<Response> {
  const maxRetries = envInt("HEARTGARDEN_ANTHROPIC_MAX_RETRIES", 3, 0, 8);
  let retries = 0;
  while (true) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new Error("Anthropic stream timed out")), args.deadlineMs);
    try {
      const res = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": args.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(args.body),
        signal: ctrl.signal,
      });
      if (!res.ok && [429, 500, 502, 503, 504, 529].includes(res.status) && retries < maxRetries) {
        retries += 1;
        const base = 1000 * 2 ** (retries - 1);
        const jitter = Math.floor(Math.random() * base);
        await sleep(base + jitter);
        continue;
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `${args.label}: Anthropic stream request failed (${res.status})${detail ? ` ${detail.slice(0, 500)}` : ""}`,
        );
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
}

function parseSseDataBlock(block: string): string | null {
  const lines = block.split("\n");
  const parts: string[] = [];
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    parts.push(line.slice(5).trimStart());
  }
  if (parts.length === 0) return null;
  const data = parts.join("\n").trim();
  if (!data || data === "[DONE]") return null;
  return data;
}

export async function* callAnthropicTextStream(
  apiKey: string,
  params: AnthropicCreateParamsLoose,
  options: CallAnthropicStreamOptions,
): AsyncGenerator<string> {
  const started = Date.now();
  const label = options.label;
  const maxOutputTokens = resolveMaxOutputTokens(label, options.maxOutputTokens);
  const deadlineMs = resolveDeadlineMs(label, options.deadlineMs);
  const thinking = resolveThinking(label, options.thinkingBudget);
  const maxContinuations = envInt("HEARTGARDEN_ANTHROPIC_MAX_CONTINUATIONS", 3, 0, 12);
  const baseMessages = Array.isArray((params as { messages?: unknown }).messages)
    ? ([...(params as { messages: unknown[] }).messages] as unknown[])
    : [];
  let messages = [...baseMessages];
  let continuationCount = 0;
  let finalStopReason: string | null = null;
  let outputChars = 0;
  for (;;) {
    const body = {
      ...(params as unknown as Record<string, unknown>),
      messages,
      max_tokens: maxOutputTokens,
      stream: true,
      ...(thinking ? { thinking } : {}),
    };
    const res = await fetchAnthropicStreamResponse({
      apiKey,
      body,
      deadlineMs,
      label,
    });
    if (!res.body) {
      throw new Error(`${label}: Anthropic stream body missing`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let continuationText = "";
    let requestStopReason: string | null = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let splitIdx = buffer.indexOf("\n\n");
      while (splitIdx >= 0) {
        const block = buffer.slice(0, splitIdx);
        buffer = buffer.slice(splitIdx + 2);
        const data = parseSseDataBlock(block);
        if (!data) {
          splitIdx = buffer.indexOf("\n\n");
          continue;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(data) as unknown;
        } catch {
          splitIdx = buffer.indexOf("\n\n");
          continue;
        }
        const evt = parsed as {
          type?: string;
          delta?: { type?: string; text?: string; stop_reason?: string | null };
        };
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          const text = evt.delta.text ?? "";
          if (text) {
            outputChars += text.length;
            continuationText += text;
            yield text;
          }
        }
        if (evt.type === "message_delta" && typeof evt.delta?.stop_reason === "string") {
          requestStopReason = evt.delta.stop_reason;
        }
        splitIdx = buffer.indexOf("\n\n");
      }
    }
    finalStopReason = requestStopReason;
    if (
      requestStopReason !== "max_tokens" ||
      continuationCount >= maxContinuations ||
      continuationText.trim().length === 0
    ) {
      break;
    }
    continuationCount += 1;
    messages = [
      ...messages,
      { role: "assistant", content: continuationText },
      { role: "user", content: CONTINUE_TEXT_PROMPT },
    ];
  }
  logSampledMetric({
    label,
    model: (params as { model?: unknown }).model,
    mode: "stream",
    stopReason: finalStopReason,
    continuations: continuationCount,
    elapsedMs: Date.now() - started,
    outputChars,
  });
}
