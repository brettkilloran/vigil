import { buildItemVaultCorpus, type ItemSearchableSource } from "@/src/lib/item-searchable-text";

export type SearchBlobSource = ItemSearchableSource;

/** Flattened plain text for Postgres FTS (`items.search_blob`). */
export function buildSearchBlob(source: SearchBlobSource): string {
  return buildItemVaultCorpus(source);
}
