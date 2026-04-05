import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { embedTexts, isEmbeddingApiConfigured } from "@/src/lib/embedding-provider";

function vec(fill: number): number[] {
  return Array.from({ length: 1536 }, () => fill);
}

describe("embedding-provider", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test";
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { index: 1, embedding: vec(0.1) },
            { index: 0, embedding: vec(0.2) },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.OPENAI_API_KEY;
  });

  it("isEmbeddingApiConfigured reflects env", () => {
    expect(isEmbeddingApiConfigured()).toBe(true);
  });

  it("embedTexts sorts by index and posts OpenAI shape", async () => {
    const out = await embedTexts(["alpha", "beta"]);
    expect(out).toHaveLength(2);
    expect(out[0]![0]).toBe(0.2);
    expect(out[1]![0]).toBe(0.1);
    expect(fetchSpy).toHaveBeenCalled();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/embeddings");
    expect(init).toMatchObject({ method: "POST" });
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("Authorization")).toBe("Bearer sk-test");
    const body = JSON.parse((init as RequestInit).body as string) as {
      input: string[];
      dimensions: number;
    };
    expect(body.input).toEqual(["alpha", "beta"]);
    expect(body.dimensions).toBe(1536);
  });
});

describe("isEmbeddingApiConfigured", () => {
  it("is false when OPENAI_API_KEY is unset", () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(isEmbeddingApiConfigured()).toBe(false);
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
  });
});
