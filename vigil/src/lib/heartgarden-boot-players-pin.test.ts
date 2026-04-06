import { afterEach, describe, expect, it } from "vitest";

import { readHeartgardenPlayersBootPin } from "@/src/lib/heartgarden-boot-players-pin";

describe("readHeartgardenPlayersBootPin", () => {
  const prevPlayers = process.env.HEARTGARDEN_BOOT_PIN_PLAYERS;

  afterEach(() => {
    if (prevPlayers === undefined) delete process.env.HEARTGARDEN_BOOT_PIN_PLAYERS;
    else process.env.HEARTGARDEN_BOOT_PIN_PLAYERS = prevPlayers;
  });

  it("returns trimmed HEARTGARDEN_BOOT_PIN_PLAYERS", () => {
    process.env.HEARTGARDEN_BOOT_PIN_PLAYERS = "  12345678  ";
    expect(readHeartgardenPlayersBootPin()).toBe("12345678");
  });

  it("returns empty when unset", () => {
    delete process.env.HEARTGARDEN_BOOT_PIN_PLAYERS;
    expect(readHeartgardenPlayersBootPin()).toBe("");
  });
});
