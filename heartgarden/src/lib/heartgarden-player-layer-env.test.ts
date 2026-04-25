import { afterEach, describe, expect, it } from "vitest";

import {
  isHeartgardenPlayerLayerMisconfigured,
  resolveHeartgardenPlayerSpaceIdFromEnv,
} from "@/src/lib/heartgarden-player-layer-env";

const VALID = "11111111-1111-4111-8111-111111111111";
const PLAYERS_PIN = "12345678";

describe("heartgarden-player-layer-env", () => {
  const keys = [
    "HEARTGARDEN_BOOT_PIN_PLAYERS",
    "HEARTGARDEN_BOOT_PIN_PLAYER",
    "HEARTGARDEN_PLAYER_SPACE_ID",
    "HEARTGARDEN_DEFAULT_SPACE_ID",
  ] as const;
  const prev: Partial<Record<(typeof keys)[number], string | undefined>> = {};

  afterEach(() => {
    for (const k of keys) {
      const v = prev[k];
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
      delete prev[k];
    }
  });

  function snapshotEnv() {
    for (const k of keys) {
      prev[k] = process.env[k];
    }
  }

  it("resolveHeartgardenPlayerSpaceIdFromEnv prefers HEARTGARDEN_PLAYER_SPACE_ID", () => {
    snapshotEnv();
    process.env.HEARTGARDEN_PLAYER_SPACE_ID = VALID;
    process.env.HEARTGARDEN_DEFAULT_SPACE_ID =
      "22222222-2222-4222-8222-222222222222";
    expect(resolveHeartgardenPlayerSpaceIdFromEnv()).toBe(VALID);
  });

  it("resolveHeartgardenPlayerSpaceIdFromEnv falls back to HEARTGARDEN_DEFAULT_SPACE_ID", () => {
    snapshotEnv();
    delete process.env.HEARTGARDEN_PLAYER_SPACE_ID;
    process.env.HEARTGARDEN_DEFAULT_SPACE_ID = VALID;
    expect(resolveHeartgardenPlayerSpaceIdFromEnv()).toBe(VALID);
  });

  it("isHeartgardenPlayerLayerMisconfigured is false when Players PIN set but space env omitted", () => {
    snapshotEnv();
    process.env.HEARTGARDEN_BOOT_PIN_PLAYERS = PLAYERS_PIN;
    delete process.env.HEARTGARDEN_PLAYER_SPACE_ID;
    delete process.env.HEARTGARDEN_DEFAULT_SPACE_ID;
    expect(isHeartgardenPlayerLayerMisconfigured()).toBe(false);
  });

  it("isHeartgardenPlayerLayerMisconfigured is true when HEARTGARDEN_PLAYER_SPACE_ID is non-empty garbage", () => {
    snapshotEnv();
    process.env.HEARTGARDEN_BOOT_PIN_PLAYERS = PLAYERS_PIN;
    process.env.HEARTGARDEN_PLAYER_SPACE_ID = "not-a-uuid";
    expect(isHeartgardenPlayerLayerMisconfigured()).toBe(true);
  });

  it("isHeartgardenPlayerLayerMisconfigured is false when Players PIN unset", () => {
    snapshotEnv();
    delete process.env.HEARTGARDEN_BOOT_PIN_PLAYERS;
    delete process.env.HEARTGARDEN_BOOT_PIN_PLAYER;
    process.env.HEARTGARDEN_PLAYER_SPACE_ID = "not-a-uuid";
    expect(isHeartgardenPlayerLayerMisconfigured()).toBe(false);
  });
});
