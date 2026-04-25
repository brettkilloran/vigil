import { type NextRequest, NextResponse } from "next/server";

import { HEARTGARDEN_BOOT_COOKIE_MAX_CHARS } from "@/src/lib/heartgarden-boot-cookie-limits";
import {
  HEARTGARDEN_BOOT_COOKIE_NAME,
  isHeartgardenBootApiAllowlisted,
  readBootGateEnvEdge,
  verifyBootSessionCookieEdge,
} from "@/src/lib/heartgarden-boot-edge";
import { authorizationBearerMatchesMcpServiceKey } from "@/src/lib/heartgarden-mcp-service-key";

const FORBIDDEN = { error: "Forbidden.", ok: false };

export async function proxy(request: NextRequest) {
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

  /** Remote MCP endpoint: route returns 401 if Authorization is missing/invalid. */
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) {
    return NextResponse.next();
  }

  if (
    authorizationBearerMatchesMcpServiceKey(
      request.headers.get("authorization")
    )
  ) {
    return NextResponse.next();
  }

  const raw = request.cookies.get(HEARTGARDEN_BOOT_COOKIE_NAME)?.value;
  if (!raw || raw.length > HEARTGARDEN_BOOT_COOKIE_MAX_CHARS) {
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
