import { afterEach, describe, expect, it, vi } from "vitest";

import { callAnthropicTextStream } from "./anthropic-client";

function makeSseResponse(events: unknown[]): Response {
  const body = events.map((evt) => `data: ${JSON.stringify(evt)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  });
}

describe("callAnthropicTextStream", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("continues automatically when stream stops at max_tokens", async () => {
    const requestBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_input, init) => {
        const parsed = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        requestBodies.push(parsed);
        if (requestBodies.length === 1) {
          return makeSseResponse([
            { type: "content_block_delta", delta: { type: "text_delta", text: "Hello " } },
            { type: "message_delta", delta: { stop_reason: "max_tokens" } },
          ]);
        }
        return makeSseResponse([
          { type: "content_block_delta", delta: { type: "text_delta", text: "world" } },
          { type: "message_delta", delta: { stop_reason: "end_turn" } },
        ]);
      });

    const chunks: string[] = [];
    for await (const chunk of callAnthropicTextStream(
      "key",
      {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Say hello world." }],
      },
      { label: "lore.query.answer", maxOutputTokens: 16 },
    )) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("Hello world");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = requestBodies[1];
    const secondMessages = Array.isArray(second.messages) ? second.messages : [];
    expect(secondMessages).toHaveLength(3);
    expect(secondMessages[1]).toEqual({ role: "assistant", content: "Hello " });
    expect(secondMessages[2]).toEqual({
      role: "user",
      content: "Continue from where you left off. Do not repeat content already emitted.",
    });
  });

  it("does not continue when stop reason is end_turn", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeSseResponse([
        { type: "content_block_delta", delta: { type: "text_delta", text: "Done." } },
        { type: "message_delta", delta: { stop_reason: "end_turn" } },
      ]),
    );

    const chunks: string[] = [];
    for await (const chunk of callAnthropicTextStream(
      "key",
      {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "One line." }],
      },
      { label: "lore.query.answer", maxOutputTokens: 16 },
    )) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("Done.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
