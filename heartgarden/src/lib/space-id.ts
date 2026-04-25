const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseSpaceIdParam(raw: string | null): string | undefined {
  if (!(raw && UUID_RE.test(raw))) {
    return;
  }
  return raw;
}
