import { z } from "zod";
import { isPersistedEntityType } from "@/src/lib/lore-object-registry";

const MAX_JSON_BYTES = 1_500_000;

const jsonRecordSchema = z.record(z.string(), z.unknown());
const loreEntityMetaBaseSchema = z
  .object({
    canonicalKind: z.string().optional(),
    campaignEpoch: z.number().int().optional(),
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
      return { ok: false, error: "contentJson must be an object or null" };
    }
    if (!jsonRecordSchema.safeParse(contentJson).success) {
      return { ok: false, error: "contentJson has invalid structure" };
    }
    if (jsonSizeBytes(contentJson) > MAX_JSON_BYTES) {
      return { ok: false, error: "contentJson exceeds size limit (1.5MB)" };
    }
  }

  if (imageMeta !== undefined && imageMeta !== null) {
    if (!isObjectRecord(imageMeta)) {
      return { ok: false, error: "imageMeta must be an object or null" };
    }
    if (jsonSizeBytes(imageMeta) > MAX_JSON_BYTES) {
      return { ok: false, error: "imageMeta exceeds size limit (1.5MB)" };
    }
  }

  if (entityMeta !== undefined && entityMeta !== null) {
    if (!isObjectRecord(entityMeta)) {
      return { ok: false, error: "entityMeta must be an object or null" };
    }
    if (jsonSizeBytes(entityMeta) > MAX_JSON_BYTES) {
      return { ok: false, error: "entityMeta exceeds size limit (1.5MB)" };
    }
    const normalizedType = (entityType ?? "").trim().toLowerCase();
    if (normalizedType.length > 0 && !isPersistedEntityType(normalizedType)) {
      return {
        ok: false,
        error: `entityType '${normalizedType}' is not allowed`,
      };
    }
    const schema = entityMetaSchemaByType[normalizedType];
    if (schema && !schema.safeParse(entityMeta).success) {
      return {
        ok: false,
        error: `entityMeta is invalid for entityType '${normalizedType}'`,
      };
    }
  }

  const normalizedType = (entityType ?? "").trim().toLowerCase();
  if (normalizedType.length > 0 && !isPersistedEntityType(normalizedType)) {
    return {
      ok: false,
      error: `entityType '${normalizedType}' is not allowed`,
    };
  }

  return { ok: true };
}
