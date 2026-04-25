import { afterEach, describe, expect, it, vi } from "vitest";

import { callAnthropicTextStream } from "./anthropic-client";

function makeSseResponse(events: unknown[]): Response {
  const body = events.map((evt) => `data: ${JSON.stringify(evt)}\n\n`).join("");
  return new Response(body, {
    headers: { "content-type": "text/event-stream; charset=utf-8" },
    status: 200,
  });
}

describe("callAnthropicTextStream", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("continues automatically when stream stops at max_tokens", async () => {
    const requestBodies: Record<string, unknown>[] = [];
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_input, init) => {
        const parsed = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        requestBodies.push(parsed);
        if (requestBodies.length === 1) {
          return makeSseResponse([
            {
              delta: { text: "Hello ", type: "text_delta" },
              type: "content_block_delta",
            },
            { delta: { stop_reason: "max_tokens" }, type: "message_delta" },
          ]);
        }
        return makeSseResponse([
          {
            delta: { text: "world", type: "text_delta" },
            type: "content_block_delta",
          },
          { delta: { stop_reason: "end_turn" }, type: "message_delta" },
        ]);
      });

    const chunks: string[] = [];
    for await (const chunk of callAnthropicTextStream(
      "key",
      {
        messages: [{ content: "Say hello world.", role: "user" }],
        model: "claude-sonnet-4-20250514",
      },
      { label: "lore.query.answer", maxOutputTokens: 16 }
    )) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("Hello world");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = requestBodies[1];
    const secondMessages = Array.isArray(second.messages)
      ? second.messages
      : [];
    expect(secondMessages).toHaveLength(3);
    expect(secondMessages[1]).toEqual({ content: "Hello ", role: "assistant" });
    expect(secondMessages[2]).toEqual({
      content:
        "Continue from where you left off. Do not repeat content already emitted.",
      role: "user",
    });
  });

  it("does not continue when stop reason is end_turn", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeSseResponse([
        {
          delta: { text: "Done.", type: "text_delta" },
          type: "content_block_delta",
        },
        { delta: { stop_reason: "end_turn" }, type: "message_delta" },
      ])
    );

    const chunks: string[] = [];
    for await (const chunk of callAnthropicTextStream(
      "key",
      {
        messages: [{ content: "One line.", role: "user" }],
        model: "claude-sonnet-4-20250514",
      },
      { label: "lore.query.answer", maxOutputTokens: 16 }
    )) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("Done.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
