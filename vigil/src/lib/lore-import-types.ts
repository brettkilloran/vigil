export type LoreImportEntityDraft = {
  name: string;
  kind: string;
  summary: string;
};

export type LoreImportLinkDraft = {
  fromName: string;
  toName: string;
  linkType?: string;
};

export type LoreImportExtractResult = {
  entities: LoreImportEntityDraft[];
  suggestedLinks: LoreImportLinkDraft[];
};
