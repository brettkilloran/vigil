import { isUuidV1To5Like } from "@/src/lib/uuid-like";

export function parseSpaceIdParam(raw: string | null): string | undefined {
  if (!isUuidV1To5Like(raw)) {
    return;
  }
  return raw;
}
