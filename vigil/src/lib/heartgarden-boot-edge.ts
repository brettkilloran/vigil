/**
 * Edge-safe boot gate helpers for Next.js middleware (no `node:crypto`).
 * Verification must match `verifyBootSessionCookie` in `heartgarden-boot-session.ts`.
 */

import { HEARTGARDEN_BOOT_COOKIE_MAX_CHARS } from "@/src/lib/heartgarden-boot-cookie-limits";
import { isHeartgardenBootGateBypassed } from "@/src/lib/heartgarden-boot-gate-bypass";
import { HEARTGARDEN_BOOT_PIN_LENGTH } from "@/src/lib/heartgarden-boot-pin-constants";
import { readHeartgardenPlayersBootPin } from "@/src/lib/heartgarden-boot-players-pin";

export const HEARTGARDEN_BOOT_COOKIE_NAME = "hg_boot";

export type HeartgardenBootTierEdge = "access" | "visitor" | "demo";

function base64UrlToUint8Array(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/u.test(s)) return null;
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const mod = b64.length % 4;
  if (mod === 1) return null;
  if (mod === 2) b64 += "==";
  else if (mod === 3) b64 += "=";
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a[i]! ^ b[i]!;
  return x === 0;
}

async function hmacSha256(secretUtf8: string, messageUtf8: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = enc.encode(secretUtf8);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(messageUtf8));
  return new Uint8Array(sig);
}

export function readBootGateEnvEdge(): {
  gateEnabled: boolean;
  sessionSecret: string;
} {
  if (isHeartgardenBootGateBypassed()) {
    return { gateEnabled: false, sessionSecret: "" };
  }
  const accessPin = (process.env.HEARTGARDEN_BOOT_PIN_ACCESS ?? "").trim();
  const visitorPin = readHeartgardenPlayersBootPin();
  const demoPin = (process.env.HEARTGARDEN_BOOT_PIN_DEMO ?? "").trim();
  const sessionSecret = (process.env.HEARTGARDEN_BOOT_SESSION_SECRET ?? "").trim();
  const accessOk = accessPin.length === HEARTGARDEN_BOOT_PIN_LENGTH;
  const visitorOk = visitorPin.length === HEARTGARDEN_BOOT_PIN_LENGTH;
  const demoOk = demoPin.length === HEARTGARDEN_BOOT_PIN_LENGTH;
  const gateEnabled = sessionSecret.length >= 16 && (accessOk || visitorOk || demoOk);
  return { gateEnabled, sessionSecret };
}

/**
 * Returns verified tier or null (invalid / expired / bad signature).
 */
export async function verifyBootSessionCookieEdge(
  secret: string,
  cookieValue: string,
): Promise<{ tier: HeartgardenBootTierEdge; exp: number } | null> {
  if (cookieValue.length > HEARTGARDEN_BOOT_COOKIE_MAX_CHARS) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;
  const expectedSig = await hmacSha256(secret, payloadB64);
  const gotSig = base64UrlToUint8Array(sigB64);
  if (!gotSig || !timingSafeEqualBytes(expectedSig, gotSig)) return null;
  const jsonBuf = base64UrlToUint8Array(payloadB64);
  if (!jsonBuf) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(jsonBuf));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (o.tier !== "access" && o.tier !== "visitor" && o.tier !== "demo") return null;
  if (typeof o.exp !== "number" || !Number.isFinite(o.exp)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (o.exp <= now) return null;
  return { tier: o.tier, exp: o.exp };
}

export function isHeartgardenBootApiAllowlisted(pathname: string): boolean {
  return (
    pathname === "/api/heartgarden/boot" ||
    pathname.startsWith("/api/heartgarden/boot/")
  );
}
