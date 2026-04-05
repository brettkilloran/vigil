import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

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

const GENERIC_UNAUTHORIZED = { error: "Access denied." };

const postBodySchema = z.object({
  code: z.string(),
});

function sessionValidFromCookie(cookieValue: string | undefined, sessionSecret: string): boolean {
  if (!cookieValue || !sessionSecret) return false;
  return verifyBootSessionCookie(sessionSecret, cookieValue) !== null;
}

export async function GET() {
  const { gateEnabled, sessionSecret } = readBootEnv();
  const jar = await cookies();
  const raw = jar.get(HEARTGARDEN_BOOT_COOKIE_NAME)?.value;
  const sessionValid = gateEnabled && sessionValidFromCookie(raw, sessionSecret);
  return NextResponse.json({ gateEnabled, sessionValid });
}

export async function POST(req: Request) {
  const { gateEnabled, accessPin, visitorPin, sessionSecret } = readBootEnv();
  if (!gateEnabled) {
    return NextResponse.json({ error: "Boot gate is not enabled." }, { status: 400 });
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

  const tier = resolveBootPinTier(code, accessPin, visitorPin);
  if (!tier) {
    return NextResponse.json(GENERIC_UNAUTHORIZED, { status: 401 });
  }

  const maxAgeSec = bootSessionMaxAgeSec();
  const exp = Math.floor(Date.now() / 1000) + maxAgeSec;
  const token = signBootSessionPayload(sessionSecret, { tier, exp });

  const o = bootSessionCookieOptions(token, maxAgeSec);
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(o.name, o.value, {
    path: o.path,
    maxAge: o.maxAge,
    httpOnly: o.httpOnly,
    sameSite: o.sameSite,
    secure: o.secure,
  });
  return res;
}

export async function DELETE() {
  const c = clearBootSessionCookieOptions();
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(c.name, "", {
    path: c.path,
    maxAge: 0,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    secure: c.secure,
  });
  return res;
}
