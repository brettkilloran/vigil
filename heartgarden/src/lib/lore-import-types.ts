export interface LoreImportEntityDraft {
  kind: string;
  name: string;
  summary: string;
}

export interface LoreImportLinkDraft {
  fromName: string;
  linkType?: string;
  toName: string;
}

export interface LoreImportExtractResult {
  entities: LoreImportEntityDraft[];
  suggestedLinks: LoreImportLinkDraft[];
}
