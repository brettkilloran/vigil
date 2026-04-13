import { describe, expect, it } from "vitest";

import { mergeStreamableHttpAcceptHeader } from "./mcp-streamable-http-accept";

describe("mergeStreamableHttpAcceptHeader", () => {
  it("adds text/event-stream for GET when missing", () => {
    expect(mergeStreamableHttpAcceptHeader("GET", null)).toBe("text/event-stream");
    expect(mergeStreamableHttpAcceptHeader("GET", "text/html")).toBe("text/html, text/event-stream");
  });

  it("leaves GET unchanged when text/event-stream is present", () => {
    expect(mergeStreamableHttpAcceptHeader("GET", "text/event-stream")).toBe("text/event-stream");
  });

  it("adds application/json and text/event-stream for POST when missing", () => {
    expect(mergeStreamableHttpAcceptHeader("POST", null)).toBe("application/json, text/event-stream");
    expect(mergeStreamableHttpAcceptHeader("POST", "*/*")).toBe("*/*, application/json, text/event-stream");
  });

  it("leaves DELETE and other methods unchanged", () => {
    expect(mergeStreamableHttpAcceptHeader("DELETE", null)).toBe("");
    expect(mergeStreamableHttpAcceptHeader("DELETE", "application/json")).toBe("application/json");
  });
});
