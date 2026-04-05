import { NextResponse, type NextRequest } from "next/server";

import {
  HEARTGARDEN_BOOT_COOKIE_NAME,
  isHeartgardenBootApiAllowlisted,
  readBootGateEnvEdge,
  verifyBootSessionCookieEdge,
} from "@/src/lib/heartgarden-boot-edge";

const FORBIDDEN = { ok: false, error: "Forbidden." };

export async function middleware(request: NextRequest) {
  const { gateEnabled, sessionSecret } = readBootGateEnvEdge();
  if (!gateEnabled) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isHeartgardenBootApiAllowlisted(pathname)) {
    return NextResponse.next();
  }

  const raw = request.cookies.get(HEARTGARDEN_BOOT_COOKIE_NAME)?.value;
  if (!raw) {
    return NextResponse.json(FORBIDDEN, { status: 403 });
  }

  const payload = await verifyBootSessionCookieEdge(sessionSecret, raw);
  if (!payload) {
    return NextResponse.json(FORBIDDEN, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
