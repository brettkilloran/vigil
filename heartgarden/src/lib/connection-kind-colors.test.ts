import { describe, expect, it } from "vitest";

import {
  canonicalKindForConnection,
  canonicalPairForKind,
  connectionKindFromLinkType,
  connectionKindsPromptGlossary,
  isCanonicalConnectionPair,
  normalizeLinkTypeAlias,
} from "@/src/lib/connection-kind-colors";

describe("connection-kind-colors aliases and migration", () => {
  it("normalizes legacy linkType aliases to canonical values", () => {
    expect(normalizeLinkTypeAlias("reference")).toBe("history");
    expect(normalizeLinkTypeAlias("ally")).toBe("bond");
    expect(normalizeLinkTypeAlias("enemy")).toBe("conflict");
    expect(normalizeLinkTypeAlias("faction")).toBe("affiliation");
    expect(normalizeLinkTypeAlias("leverage")).toBe("conflict");
  });

  it("maps canonical and alias link types to picker kinds", () => {
    expect(connectionKindFromLinkType("bond")).toBe("bond");
    expect(connectionKindFromLinkType("enemy")).toBe("conflict");
    expect(connectionKindFromLinkType("location")).toBe("history");
  });

  it("prefers normalized link type over color when inferring canonical kind", () => {
    const bondPair = canonicalPairForKind("bond");
    const contractPair = canonicalPairForKind("contract");
    const kind = canonicalKindForConnection({
      color: contractPair.color,
      linkType: "ally",
    });
    expect(kind).toBe("bond");
    expect(bondPair.linkType).toBe("bond");
  });

  it("treats legacy alias pairs as non-canonical to force migration rewrite", () => {
    const conflictPair = canonicalPairForKind("conflict");
    expect(
      isCanonicalConnectionPair({
        color: conflictPair.color,
        linkType: "enemy",
      }),
    ).toBe(false);
    expect(
      isCanonicalConnectionPair({
        color: conflictPair.color,
        linkType: conflictPair.linkType,
      }),
    ).toBe(true);
  });

  it("exports prompt glossary text for all canonical semantic link types", () => {
    const glossary = connectionKindsPromptGlossary();
    expect(glossary).toContain("bond");
    expect(glossary).toContain("affiliation");
    expect(glossary).toContain("contract");
    expect(glossary).toContain("conflict");
    expect(glossary).toContain("history");
  });
});
