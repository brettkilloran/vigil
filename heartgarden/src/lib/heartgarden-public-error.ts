/**
 * Opaque API errors for clients; log full detail server-side only (see CODE_HEALTH_AUDIT #14).
 */
export function jsonPublicError(
  status: number,
  publicMessage: string,
  code: string,
  extra?: Record<string, unknown>
): Response {
  return Response.json(
    { ok: false, error: publicMessage, code, ...extra },
    { status }
  );
}
