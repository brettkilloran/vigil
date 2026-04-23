import { z } from "zod";

export const hgStructuredHeadingBlockSchema = z.object({
  kind: z.literal("heading"),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: z.string().trim().min(1).max(500),
});

export const hgStructuredParagraphBlockSchema = z.object({
  kind: z.literal("paragraph"),
  text: z.string().trim().min(1).max(8_000),
});

const hgStructuredListItemSchema = z.string().trim().min(1).max(1_200);

export const hgStructuredBulletListBlockSchema = z.object({
  kind: z.literal("bullet_list"),
  items: z.array(hgStructuredListItemSchema).min(1).max(200),
});

export const hgStructuredOrderedListBlockSchema = z.object({
  kind: z.literal("ordered_list"),
  items: z.array(hgStructuredListItemSchema).min(1).max(200),
});

export const hgStructuredQuoteBlockSchema = z.object({
  kind: z.literal("quote"),
  text: z.string().trim().min(1).max(8_000),
});

export const hgStructuredRuleBlockSchema = z.object({
  kind: z.literal("hr"),
});

export const hgStructuredBlockSchema = z.discriminatedUnion("kind", [
  hgStructuredHeadingBlockSchema,
  hgStructuredParagraphBlockSchema,
  hgStructuredBulletListBlockSchema,
  hgStructuredOrderedListBlockSchema,
  hgStructuredQuoteBlockSchema,
  hgStructuredRuleBlockSchema,
]);

export type HgStructuredBlock = z.infer<typeof hgStructuredBlockSchema>;

export const hgStructuredBodySchema = z.object({
  blocks: z.array(hgStructuredBlockSchema).min(1).max(400),
});

export type HgStructuredBody = z.infer<typeof hgStructuredBodySchema>;
