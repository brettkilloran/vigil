import { afterEach, describe, expect, it } from "vitest";

import { isHeartgardenBootGateBypassed } from "@/src/lib/heartgarden-boot-gate-bypass";

describe("isHeartgardenBootGateBypassed", () => {
  const prev = {
    HEARTGARDEN_DEV_ENFORCE_BOOT_GATE:
      process.env.HEARTGARDEN_DEV_ENFORCE_BOOT_GATE,
    NODE_ENV: process.env.NODE_ENV,
    PLAYWRIGHT_E2E: process.env.PLAYWRIGHT_E2E,
  };

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) {
        delete process.env[k as keyof typeof prev];
      } else {
        process.env[k as keyof typeof prev] = v;
      }
    }
  });

  it("is true when PLAYWRIGHT_E2E=1 regardless of NODE_ENV", () => {
    process.env.PLAYWRIGHT_E2E = "1";
    process.env.NODE_ENV = "production";
    delete process.env.HEARTGARDEN_DEV_ENFORCE_BOOT_GATE;
    expect(isHeartgardenBootGateBypassed()).toBe(true);
  });

  it("is true in development by default (easy local http://localhost:3000)", () => {
    delete process.env.PLAYWRIGHT_E2E;
    process.env.NODE_ENV = "development";
    delete process.env.HEARTGARDEN_DEV_ENFORCE_BOOT_GATE;
    expect(isHeartgardenBootGateBypassed()).toBe(true);
  });

  it("is false in development when HEARTGARDEN_DEV_ENFORCE_BOOT_GATE is truthy", () => {
    delete process.env.PLAYWRIGHT_E2E;
    process.env.NODE_ENV = "development";
    process.env.HEARTGARDEN_DEV_ENFORCE_BOOT_GATE = "1";
    expect(isHeartgardenBootGateBypassed()).toBe(false);
  });

  it("is false in production", () => {
    delete process.env.PLAYWRIGHT_E2E;
    process.env.NODE_ENV = "production";
    delete process.env.HEARTGARDEN_DEV_ENFORCE_BOOT_GATE;
    expect(isHeartgardenBootGateBypassed()).toBe(false);
  });

  it("is false in production even if HEARTGARDEN_DEV_ENFORCE_BOOT_GATE=1", () => {
    delete process.env.PLAYWRIGHT_E2E;
    process.env.NODE_ENV = "production";
    process.env.HEARTGARDEN_DEV_ENFORCE_BOOT_GATE = "1";
    expect(isHeartgardenBootGateBypassed()).toBe(false);
  });
});
