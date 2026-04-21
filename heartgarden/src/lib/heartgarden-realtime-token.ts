import { createHmac, timingSafeEqual } from "node:crypto";

import { verifyBootSessionCookie } from "@/src/lib/heartgarden-boot-session";
import { heartgardenRealtimeSecretFromEnv } from "@/src/lib/heartgarden-realtime-config";
export {
  HEARTGARDEN_REALTIME_WS_PROTOCOL,
  heartgardenRealtimeSocketProtocols,
  heartgardenRealtimeTokenFromProtocolsHeader,
} from "@/src/lib/heartgarden-realtime-protocol";

type HeartgardenRealtimeTokenPayload = {
  spaceId: string;
  exp: number;
  role: "gm" | "player";
};

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

export function signHeartgardenRealtimeRoomToken(payload: HeartgardenRealtimeTokenPayload): string {
  const secret = heartgardenRealtimeSecretFromEnv();
  if (secret.length < 16) {
    throw new Error("HEARTGARDEN_REALTIME_SECRET is not configured");
  }
  const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = createHmac("sha256", secret).update(payloadB64, "utf8").digest();
  return `${payloadB64}.${toBase64Url(sig)}`;
}

export function verifyHeartgardenRealtimeRoomToken(
  token: string,
): HeartgardenRealtimeTokenPayload | null {
  const secret = heartgardenRealtimeSecretFromEnv();
  if (secret.length < 16) return null;
  const parts = token.split(".");
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
  const raw = parsed as Record<string, unknown>;
  if (
    typeof raw.spaceId !== "string" ||
    typeof raw.exp !== "number" ||
    (raw.role !== "gm" && raw.role !== "player")
  ) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (raw.exp <= now) return null;
  return {
    spaceId: raw.spaceId,
    exp: raw.exp,
    role: raw.role,
  };
}

export function heartgardenRealtimeRoleFromBootCookie(
  sessionSecret: string,
  cookieValue: string | undefined,
): "gm" | "player" | null {
  const raw = (cookieValue ?? "").trim();
  if (!raw) return null;
  const payload = verifyBootSessionCookie(sessionSecret, raw);
  if (!payload) return null;
  if (payload.tier === "access") return "gm";
  if (payload.tier === "player") return "player";
  return null;
}
