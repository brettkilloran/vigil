import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  consumeHeartgardenBootPostRateLimit,
  heartgardenBootClientIp,
} from "@/src/lib/heartgarden-boot-rate-limit";
import {
  bootSessionCookieOptions,
  bootSessionMaxAgeSec,
  clearBootSessionCookieOptions,
  HEARTGARDEN_BOOT_COOKIE_NAME,
  HEARTGARDEN_BOOT_PIN_LENGTH,
  readBootEnv,
  resolveBootPinTier,
  signBootSessionPayload,
  verifyBootSessionCookie,
} from "@/src/lib/heartgarden-boot-session";
import {
  firePlayerLayerMisconfigAlertOnce,
  isHeartgardenPlayerLayerMisconfigured,
} from "@/src/lib/heartgarden-player-layer-env";

const GENERIC_UNAUTHORIZED = { error: "Access denied." };

const postBodySchema = z.object({
  code: z.string(),
});

export async function GET() {
  const { gateEnabled, sessionSecret } = readBootEnv();
  const jar = await cookies();
  const raw = jar.get(HEARTGARDEN_BOOT_COOKIE_NAME)?.value;
  const payload =
    raw && sessionSecret ? verifyBootSessionCookie(sessionSecret, raw) : null;
  const playerLayerMisconfigured = isHeartgardenPlayerLayerMisconfigured();
  const sessionValid =
    gateEnabled &&
    Boolean(payload) &&
    !(payload?.tier === "player" && playerLayerMisconfigured);

  let sessionTier: "access" | "player" | "demo" | null = null;
  if (gateEnabled && payload) {
    if (payload.tier === "access" || payload.tier === "demo") {
      sessionTier = payload.tier;
    } else if (payload.tier === "player" && !playerLayerMisconfigured) {
      sessionTier = "player";
    }
  }

  void firePlayerLayerMisconfigAlertOnce(playerLayerMisconfigured);

  return NextResponse.json({
    gateEnabled,
    playerLayerMisconfigured: gateEnabled ? playerLayerMisconfigured : false,
    sessionTier,
    sessionValid,
  });
}

export async function POST(req: Request) {
  const { gateEnabled, bishopPin, playersPin, demoPin, sessionSecret } =
    readBootEnv();
  if (!gateEnabled) {
    return NextResponse.json(
      { error: "Boot gate is not enabled." },
      { status: 400 }
    );
  }

  const ip = heartgardenBootClientIp(req);
  if (!consumeHeartgardenBootPostRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(GENERIC_UNAUTHORIZED, { status: 401 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_UNAUTHORIZED, { status: 401 });
  }

  const code = parsed.data.code.trim();
  if (code.length !== HEARTGARDEN_BOOT_PIN_LENGTH) {
    return NextResponse.json(GENERIC_UNAUTHORIZED, { status: 401 });
  }

  const tier = resolveBootPinTier(code, bishopPin, playersPin, demoPin);
  if (!tier) {
    return NextResponse.json(GENERIC_UNAUTHORIZED, { status: 401 });
  }

  if (tier === "player" && isHeartgardenPlayerLayerMisconfigured()) {
    return NextResponse.json(GENERIC_UNAUTHORIZED, { status: 401 });
  }

  const maxAgeSec = bootSessionMaxAgeSec();
  const exp = Math.floor(Date.now() / 1000) + maxAgeSec;
  const token = signBootSessionPayload(sessionSecret, { exp, tier });

  const o = bootSessionCookieOptions(token, maxAgeSec);
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(o.name, o.value, {
    httpOnly: o.httpOnly,
    maxAge: o.maxAge,
    path: o.path,
    sameSite: o.sameSite,
    secure: o.secure,
  });
  return res;
}

// biome-ignore lint/suspicious/useAwait: Next.js Route Handler signatures must be async even when no await is needed.
export async function DELETE() {
  const c = clearBootSessionCookieOptions();
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(c.name, "", {
    httpOnly: c.httpOnly,
    maxAge: 0,
    path: c.path,
    sameSite: c.sameSite,
    secure: c.secure,
  });
  return res;
}
