import { z } from "zod";

import { isPersistedEntityType } from "@/src/lib/lore-object-registry";

const MAX_JSON_BYTES = 1_500_000;

const jsonRecordSchema = z.record(z.string(), z.unknown());
const loreEntityMetaBaseSchema = z
  .object({
    campaignEpoch: z.number().int().optional(),
    canonicalKind: z.string().optional(),
    loreHistorical: z.boolean().optional(),
    loreReviewTags: z.array(z.string()).optional(),
  })
  .passthrough();

const entityMetaSchemaByType: Record<
  string,
  z.ZodType<Record<string, unknown>>
> = {
  character: loreEntityMetaBaseSchema,
  faction: loreEntityMetaBaseSchema,
  location: loreEntityMetaBaseSchema,
};

function jsonSizeBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateItemWriteJsonPayload(input: {
  entityType: string | null | undefined;
  entityMeta: unknown;
  contentJson: unknown;
  imageMeta?: unknown;
  routeTag: string;
}): { ok: true } | { ok: false; error: string } {
  const { entityType, entityMeta, contentJson, imageMeta } = input;

  if (contentJson !== undefined && contentJson !== null) {
    if (!isObjectRecord(contentJson)) {
      return { error: "contentJson must be an object or null", ok: false };
    }
    if (!jsonRecordSchema.safeParse(contentJson).success) {
      return { error: "contentJson has invalid structure", ok: false };
    }
    if (jsonSizeBytes(contentJson) > MAX_JSON_BYTES) {
      return { error: "contentJson exceeds size limit (1.5MB)", ok: false };
    }
  }

  if (imageMeta !== undefined && imageMeta !== null) {
    if (!isObjectRecord(imageMeta)) {
      return { error: "imageMeta must be an object or null", ok: false };
    }
    if (jsonSizeBytes(imageMeta) > MAX_JSON_BYTES) {
      return { error: "imageMeta exceeds size limit (1.5MB)", ok: false };
    }
  }

  if (entityMeta !== undefined && entityMeta !== null) {
    if (!isObjectRecord(entityMeta)) {
      return { error: "entityMeta must be an object or null", ok: false };
    }
    if (jsonSizeBytes(entityMeta) > MAX_JSON_BYTES) {
      return { error: "entityMeta exceeds size limit (1.5MB)", ok: false };
    }
    const normalizedType = (entityType ?? "").trim().toLowerCase();
    if (normalizedType.length > 0 && !isPersistedEntityType(normalizedType)) {
      return {
        error: `entityType '${normalizedType}' is not allowed`,
        ok: false,
      };
    }
    const schema = entityMetaSchemaByType[normalizedType];
    if (schema && !schema.safeParse(entityMeta).success) {
      return {
        error: `entityMeta is invalid for entityType '${normalizedType}'`,
        ok: false,
      };
    }
  }

  const normalizedType = (entityType ?? "").trim().toLowerCase();
  if (normalizedType.length > 0 && !isPersistedEntityType(normalizedType)) {
    return {
      error: `entityType '${normalizedType}' is not allowed`,
      ok: false,
    };
  }

  return { ok: true };
}
