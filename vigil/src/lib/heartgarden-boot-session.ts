import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { HEARTGARDEN_BOOT_COOKIE_MAX_CHARS } from "@/src/lib/heartgarden-boot-cookie-limits";
import { HEARTGARDEN_BOOT_PIN_LENGTH } from "@/src/lib/heartgarden-boot-pin-constants";
import { readHeartgardenPlayersBootPin } from "@/src/lib/heartgarden-boot-players-pin";

export { HEARTGARDEN_BOOT_PIN_LENGTH } from "@/src/lib/heartgarden-boot-pin-constants";

export const HEARTGARDEN_BOOT_COOKIE_NAME = "hg_boot";

export type HeartgardenBootTier = "access" | "visitor" | "demo";

export type HeartgardenBootPayload = {
  tier: HeartgardenBootTier;
  /** Unix seconds */
  exp: number;
};

const DUMMY_DIGEST_A = createHash("sha256").update("\0hg_boot_unset_a", "utf8").digest();
const DUMMY_DIGEST_B = createHash("sha256").update("\0hg_boot_unset_b", "utf8").digest();
const DUMMY_DIGEST_C = createHash("sha256").update("\0hg_boot_unset_c", "utf8").digest();

export function isPlaywrightE2E(): boolean {
  return process.env.PLAYWRIGHT_E2E === "1";
}

export function readBootEnv(): {
  gateEnabled: boolean;
  accessPin: string;
  visitorPin: string;
  demoPin: string;
  sessionSecret: string;
} {
  if (isPlaywrightE2E()) {
    return { gateEnabled: false, accessPin: "", visitorPin: "", demoPin: "", sessionSecret: "" };
  }
  const accessPin = (process.env.HEARTGARDEN_BOOT_PIN_ACCESS ?? "").trim();
  const visitorPin = readHeartgardenPlayersBootPin();
  const demoPin = (process.env.HEARTGARDEN_BOOT_PIN_DEMO ?? "").trim();
  const sessionSecret = (process.env.HEARTGARDEN_BOOT_SESSION_SECRET ?? "").trim();
  const accessOk = accessPin.length === HEARTGARDEN_BOOT_PIN_LENGTH;
  const visitorOk = visitorPin.length === HEARTGARDEN_BOOT_PIN_LENGTH;
  const demoOk = demoPin.length === HEARTGARDEN_BOOT_PIN_LENGTH;
  /** Gate is on when the session secret is set and at least one PIN is configured. */
  const gateEnabled = sessionSecret.length >= 16 && (accessOk || visitorOk || demoOk);
  return { gateEnabled, accessPin, visitorPin, demoPin, sessionSecret };
}

export function bootSessionMaxAgeSec(): number {
  const raw = (process.env.HEARTGARDEN_BOOT_SESSION_MAX_AGE_SEC ?? "").trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n > 60 && n <= 365 * 24 * 60 * 60) return n;
  return 30 * 24 * 60 * 60;
}

function sha256Utf8(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

/**
 * Compare submitted code to access / visitor pins without short-circuiting digest equality.
 * Returns tier or null. Pins shorter than 8 use dummy digests so they never match.
 */
export function resolveBootPinTier(
  code: string,
  accessPin: string,
  visitorPin: string,
  demoPin: string,
): HeartgardenBootTier | null {
  const h = sha256Utf8(code);
  const hAccess =
    accessPin.length === HEARTGARDEN_BOOT_PIN_LENGTH ? sha256Utf8(accessPin) : DUMMY_DIGEST_A;
  const hVisitor =
    visitorPin.length === HEARTGARDEN_BOOT_PIN_LENGTH ? sha256Utf8(visitorPin) : DUMMY_DIGEST_B;
  const hDemo =
    demoPin.length === HEARTGARDEN_BOOT_PIN_LENGTH ? sha256Utf8(demoPin) : DUMMY_DIGEST_C;
  const okAccess = timingSafeEqual(h, hAccess);
  const okVisitor = timingSafeEqual(h, hVisitor);
  const okDemo = timingSafeEqual(h, hDemo);
  if (okAccess) return "access";
  if (okVisitor) return "visitor";
  if (okDemo) return "demo";
  return null;
}

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function fromBase64Url(s: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]*$/u.test(s)) return null;
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const mod = b64.length % 4;
  if (mod === 1) return null;
  if (mod === 2) b64 += "==";
  else if (mod === 3) b64 += "=";
  try {
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

export function signBootSessionPayload(secret: string, payload: HeartgardenBootPayload): string {
  const body = JSON.stringify(payload);
  const payloadB64 = toBase64Url(Buffer.from(body, "utf8"));
  const sig = createHmac("sha256", secret).update(payloadB64, "utf8").digest();
  const sigB64 = toBase64Url(sig);
  return `${payloadB64}.${sigB64}`;
}

export function verifyBootSessionCookie(secret: string, cookieValue: string): HeartgardenBootPayload | null {
  if (cookieValue.length > HEARTGARDEN_BOOT_COOKIE_MAX_CHARS) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;
  const expectedSig = createHmac("sha256", secret).update(payloadB64, "utf8").digest();
  const gotSig = fromBase64Url(sigB64);
  if (!gotSig || gotSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(expectedSig, gotSig)) return null;
  const jsonBuf = fromBase64Url(payloadB64);
  if (!jsonBuf) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBuf.toString("utf8"));
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

export function clearBootSessionCookieOptions(): {
  name: string;
  path: string;
  maxAge: 0;
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
} {
  return {
    name: HEARTGARDEN_BOOT_COOKIE_NAME,
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}

export function bootSessionCookieOptions(value: string, maxAgeSec: number): {
  name: string;
  value: string;
  path: string;
  maxAge: number;
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
} {
  return {
    name: HEARTGARDEN_BOOT_COOKIE_NAME,
    value,
    path: "/",
    maxAge: maxAgeSec,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
