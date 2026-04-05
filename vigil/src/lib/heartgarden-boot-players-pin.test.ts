import { afterEach, describe, expect, it } from "vitest";

import { readHeartgardenPlayersBootPin } from "@/src/lib/heartgarden-boot-players-pin";

describe("readHeartgardenPlayersBootPin", () => {
  const prevPlayers = process.env.HEARTGARDEN_BOOT_PIN_PLAYERS;
  const prevVisitor = process.env.HEARTGARDEN_BOOT_PIN_VISITOR;

  afterEach(() => {
    if (prevPlayers === undefined) delete process.env.HEARTGARDEN_BOOT_PIN_PLAYERS;
    else process.env.HEARTGARDEN_BOOT_PIN_PLAYERS = prevPlayers;
    if (prevVisitor === undefined) delete process.env.HEARTGARDEN_BOOT_PIN_VISITOR;
    else process.env.HEARTGARDEN_BOOT_PIN_VISITOR = prevVisitor;
  });

  it("prefers HEARTGARDEN_BOOT_PIN_PLAYERS when 8 characters", () => {
    delete process.env.HEARTGARDEN_BOOT_PIN_VISITOR;
    process.env.HEARTGARDEN_BOOT_PIN_PLAYERS = "12345678";
    expect(readHeartgardenPlayersBootPin()).toBe("12345678");
  });

  it("falls back to HEARTGARDEN_BOOT_PIN_VISITOR when PLAYERS unset", () => {
    delete process.env.HEARTGARDEN_BOOT_PIN_PLAYERS;
    process.env.HEARTGARDEN_BOOT_PIN_VISITOR = "abcdefgh";
    expect(readHeartgardenPlayersBootPin()).toBe("abcdefgh");
  });

  it("falls back when PLAYERS is wrong length", () => {
    process.env.HEARTGARDEN_BOOT_PIN_PLAYERS = "short";
    process.env.HEARTGARDEN_BOOT_PIN_VISITOR = "87654321";
    expect(readHeartgardenPlayersBootPin()).toBe("87654321");
  });
});
