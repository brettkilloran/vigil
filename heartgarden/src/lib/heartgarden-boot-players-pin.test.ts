import { afterEach, describe, expect, it } from "vitest";

import { readHeartgardenPlayersBootPin } from "@/src/lib/heartgarden-boot-players-pin";

describe("readHeartgardenPlayersBootPin", () => {
  const prevPlayers = process.env.HEARTGARDEN_BOOT_PIN_PLAYERS;
  const prevPlayer = process.env.HEARTGARDEN_BOOT_PIN_PLAYER;

  afterEach(() => {
    if (prevPlayers === undefined) {
      delete process.env.HEARTGARDEN_BOOT_PIN_PLAYERS;
    } else {
      process.env.HEARTGARDEN_BOOT_PIN_PLAYERS = prevPlayers;
    }
    if (prevPlayer === undefined) {
      delete process.env.HEARTGARDEN_BOOT_PIN_PLAYER;
    } else {
      process.env.HEARTGARDEN_BOOT_PIN_PLAYER = prevPlayer;
    }
  });

  it("returns trimmed HEARTGARDEN_BOOT_PIN_PLAYERS", () => {
    process.env.HEARTGARDEN_BOOT_PIN_PLAYERS = "  12345678  ";
    expect(readHeartgardenPlayersBootPin()).toBe("12345678");
  });

  it("returns empty when unset", () => {
    delete process.env.HEARTGARDEN_BOOT_PIN_PLAYERS;
    delete process.env.HEARTGARDEN_BOOT_PIN_PLAYER;
    expect(readHeartgardenPlayersBootPin()).toBe("");
  });

  it("falls back to trimmed HEARTGARDEN_BOOT_PIN_PLAYER when PLAYERS is unset", () => {
    delete process.env.HEARTGARDEN_BOOT_PIN_PLAYERS;
    process.env.HEARTGARDEN_BOOT_PIN_PLAYER = "  abcdefgh  ";
    expect(readHeartgardenPlayersBootPin()).toBe("abcdefgh");
  });

  it("prefers HEARTGARDEN_BOOT_PIN_PLAYERS when both are set", () => {
    process.env.HEARTGARDEN_BOOT_PIN_PLAYERS = "11111111";
    process.env.HEARTGARDEN_BOOT_PIN_PLAYER = "22222222";
    expect(readHeartgardenPlayersBootPin()).toBe("11111111");
  });
});
