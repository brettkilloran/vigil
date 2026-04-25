/** UUID v4 shape check shared by canvas, hgArch extractors, and API validation. */
export function isUuidLike(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
