import { describe, expect, it } from "vitest";

import {
  assertWebclipFetchTargetAllowed,
  webclipAddressBlocked,
} from "@/src/lib/webclip-ssrf";

const PORT_ERROR_RE = /port/;
const LOCALHOST_ERROR_RE = /localhost/;
const PRIVATE_ADDRESS_ERROR_RE = /private address/;

describe("webclipAddressBlocked", () => {
  it("blocks common private/loopback ranges", () => {
    expect(webclipAddressBlocked("127.0.0.1")).toBe(true);
    expect(webclipAddressBlocked("10.1.2.3")).toBe(true);
    expect(webclipAddressBlocked("172.16.0.1")).toBe(true);
    expect(webclipAddressBlocked("192.168.1.2")).toBe(true);
    expect(webclipAddressBlocked("169.254.10.20")).toBe(true);
    expect(webclipAddressBlocked("::1")).toBe(true);
    expect(webclipAddressBlocked("fe80::1")).toBe(true);
    expect(webclipAddressBlocked("fc00::1")).toBe(true);
  });

  it("allows public addresses", () => {
    expect(webclipAddressBlocked("8.8.8.8")).toBe(false);
    expect(webclipAddressBlocked("1.1.1.1")).toBe(false);
    expect(webclipAddressBlocked("2606:4700:4700::1111")).toBe(false);
  });
});

describe("assertWebclipFetchTargetAllowed", () => {
  it("rejects disallowed ports", async () => {
    await expect(
      assertWebclipFetchTargetAllowed(new URL("https://example.com:8080/path"))
    ).rejects.toThrow(PORT_ERROR_RE);
  });

  it("rejects localhost", async () => {
    await expect(
      assertWebclipFetchTargetAllowed(new URL("http://localhost/path"))
    ).rejects.toThrow(LOCALHOST_ERROR_RE);
  });

  it("rejects host resolving to private address", async () => {
    await expect(
      assertWebclipFetchTargetAllowed(new URL("https://example.com/path"), {
        lookupHost: async () => ["10.0.0.1"],
      })
    ).rejects.toThrow(PRIVATE_ADDRESS_ERROR_RE);
  });

  it("allows host resolving to public address", async () => {
    await expect(
      assertWebclipFetchTargetAllowed(new URL("https://example.com/path"), {
        lookupHost: async () => ["93.184.216.34"],
      })
    ).resolves.toBeUndefined();
  });
});
