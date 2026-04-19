"use client";

/**
 * Lore entity node design lab. Location v6 uses legacy rich HTML (`BufferedContentEditable`). Location v7 uses the same
 * **`LoreLocationOrdoV7Slab`** as infinite canvas (canonical ORDO slab + hgDoc notes). Production wiring can use
 * `items.entity_type` (character | faction | location) plus optional `content_json.hgArch`
 * keys such as `cardVariant` once a direction is chosen.
 *
 * **Body vs document shell:** Character v11 uses **`LabSkeuoCard`** (body-only canvas plate; same stack as production).
 * Faction lab previews use **`FactionLabPlate`** (e.g. `protocolIndigoBloom`, `protocolTerminalFleet`, `protocolOcularMandate`, `protocolOcularMandateLight`, `protocolArchive091Readable`, `protocolSynthesisArchive`, `protocolEssentialistId`, `protocolClandestineBrief`) — not **`LabCard`**, so they are not constrained to
 * tape or `a4DocumentBody`. Specimen **`rosterPriming`** validates **`hgArch.factionRoster`** (`faction-roster-schema.ts`)
 * — not production `lore-node-seed-html` faction seeds. Shelf variants use **`ArchitecturalNodeHeader`** for the expand affordance. Location v2–v3
 * use **`LabCard`** to match canvas A4 nodes; v4–v7 are lab-only **`FactionLabPlate`** ORDO mono slabs — v4 static fiction;
 * v5 dense field-mapped; v6 lean **`BufferedContentEditable`** body; v7 matches canvas (**`LoreLocationOrdoV7Slab`**).
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { ArchitecturalTooltip } from "@/src/components/foundation/ArchitecturalTooltip";
import {
  ArchitecturalNodeHeader,
  ArchitecturalNodeTape,
} from "@/src/components/foundation/ArchitecturalNodeCard";
import { LoreLocationOrdoV7Slab } from "@/src/components/foundation/LoreLocationOrdoV7Slab";
import { ArrowsOutSimple, Plus, Trash } from "@phosphor-icons/react";
import canvasStyles from "@/src/components/foundation/ArchitecturalCanvasApp.module.css";
import cardStyles from "@/src/components/foundation/lore-entity-card.module.css";
import { VigilThemeProvider, useVigilThemeContext } from "@/src/contexts/vigil-theme-context";
import { cx } from "@/src/lib/cx";
import type { TapeVariant } from "@/src/components/foundation/architectural-types";
import { Button } from "@/src/components/ui/Button";
import { BufferedContentEditable } from "@/src/components/editing/BufferedContentEditable";
import labStyles from "./lore-entity-node-lab.module.css";
import {
  getLoreNodeSeedBodyHtml,
  locationStripVariantFromSeed,
} from "@/src/lib/lore-node-seed-html";
import type { FactionRosterEntry } from "@/src/lib/faction-roster-schema";
import {
  DEMO_FACTION_ROSTER,
  FACTION_ROSTER_HG_ARCH_KEY,
  parseFactionRoster,
} from "@/src/lib/faction-roster-schema";
import { syncCharSkDisplayNameStack } from "@/src/lib/lore-char-sk-display-name";
import { installLoreV11PlaceholderCaretSync } from "@/src/lib/lore-v11-ph-caret";
import {
  consumeLorePlaceholderBeforeInput,
  installLorePlaceholderSelectionGuards,
  LORE_V9_REDACTED_SENTINEL,
  placeCaretAfterLorePlaceholderReplace,
  syncLoreV9RedactedPlaceholderState,
} from "@/src/lib/lore-v9-placeholder";
import { applyImageDataUrlToArchitecturalMediaBody } from "@/src/components/foundation/architectural-media-html";
import { applySpellcheckToNestedEditables } from "@/src/lib/contenteditable-spellcheck";

/**
 * Multi-paragraph faction `document` regions use static HTML (not React element children) under `contentEditable`, so the
 * runtime does not warn about React-managed children inside an editable host.
 */
const FACTION_LAB_INDIGO_DOCUMENT_HTML = `<p>The initiation begins in the silence between breaths. To perceive the cobalt frequency, one must first relinquish the warmth of the sun. Our roots reach into the abyssal indigo, seeking the nutrient of starlight. This document serves as the primary tether for all initiates of the Ninth Radial.</p><p>Prepare the vessel with water drawn from the silent springs. The petals must be arranged in a non-linear spiral, mimicking the movement of the celestial goldfish. When the blue light peaks—precisely at the transition of the fourth watch—the bloom will commence.</p><p><em>Warning: Exposure to the raw electric cobalt frequency without proper retinal shielding may cause permanent synesthesia.</em></p>`;

const FACTION_LAB_TERMINAL_DOCUMENT_HTML = `<p>Canonical operating agreement for this organization. Roster below mirrors hgArch.${FACTION_ROSTER_HG_ARCH_KEY} (structured JSON, not this HTML body).</p><p>Quorum requires seven active signatures before the exchange may route external traffic. Degraded members stay listed but do not count toward vote weight until their heartbeat clears.</p>`;

const FACTION_LAB_OCULAR_DOCUMENT_HTML = `<p>This document formalizes the shift from raw sight to disciplined perception. Acolytes observe the silence between frames; roster rows below mirror hgArch.${FACTION_ROSTER_HG_ARCH_KEY} (JSON), not pasted prose.</p><p>Visual noise is treated as hostile signal. The mandate is absolute; the eye is constant.</p>`;

const FACTION_LAB_SYNTH_DOCUMENT_HTML = `<p>Canonical charter for this organization. The ledger below lists members from hgArch.${FACTION_ROSTER_HG_ARCH_KEY} (structured JSON); it is not duplicated as unstructured prose here.</p><p>Quorum and routing rules follow the mandate strip above; edits to mission language should stay aligned with stored roster rows.</p>`;

const FACTION_LAB_ESSENTIALIST_CHARTER_HTML = `<p>Canonical operating charter (TipTap-capable in production). Membership below mirrors hgArch.${FACTION_ROSTER_HG_ARCH_KEY} — structured JSON, not pasted prose lists.</p><p>Quorum and succession rules bind all signatories; roster rows are the source of truth for who counts.</p>`;

const FACTION_LAB_CLANDESTINE_DOCUMENT_HTML = `<p>Internal circulation only. This annex merges terminal clearance language with registry protocol: roster rows below are hgArch.${FACTION_ROSTER_HG_ARCH_KEY} (JSON), not transcribed into this body.</p><p>Do not route externally. File under the bureau docket referenced in the subject line; deviations require countersign from the archive clerk of record.</p>`;

const FACTION_LAB_ARCHIVE091_READABLE_DOCUMENT_HTML = `<p>To reach <em>the Absolute Neutral</em>, surrender the chronological anchor. Catalog the exterior, then displace it in the ledger furnace — Ironwood tariff binders only.</p><p>The horizon does not curve for the eye; it curves for the soul. We are the quiet space between charter clauses.</p><p><em>Structured members: use hgArch.${FACTION_ROSTER_HG_ARCH_KEY} (JSON) in the index below — not ad-hoc metrics rows.</em></p>`;

function factionRosterDemoDisplayName(row: FactionRosterEntry): string {
  if (row.kind === "character") {
    return row.displayNameOverride ?? `Character ${row.characterItemId.slice(0, 8)}…`;
  }
  return row.label;
}

/** Role label for roster rows; omit when absent (no placeholder dash). */
function factionRosterDemoRoleOptional(row: FactionRosterEntry): string | null {
  if (row.kind === "character") {
    const r = row.roleOverride?.trim();
    return r ? r : null;
  }
  const r = row.role?.trim();
  return r ? r : null;
}

function newFactionRosterEntryId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * XX specimen: interactive `hgArch.factionRoster` preview — add/remove rows and edit fields that exist on
 * `FactionRosterEntry` (lab state only; production persists via `content_json.hgArch`).
 */
function FactionArchive091ReadableRosterManager({
  roster,
  setRoster,
}: {
  roster: FactionRosterEntry[];
  setRoster: Dispatch<SetStateAction<FactionRosterEntry[]>>;
}) {
  const addUnlinkedMember = useCallback(() => {
    setRoster((prev) => [
      ...prev,
      {
        id: newFactionRosterEntryId(),
        kind: "unlinked",
        label: "New member",
      },
    ]);
  }, [setRoster]);

  const removeMember = useCallback(
    (id: string) => {
      setRoster((prev) => prev.filter((r) => r.id !== id));
    },
    [setRoster],
  );

  return (
    <div
      className={labStyles.facArxxRoster}
      data-hg-lore-faction-roster="1"
      data-hg-arch-key={FACTION_ROSTER_HG_ARCH_KEY}
    >
      <div
        className={labStyles.facArxxRosterList}
        role={roster.length > 0 ? "list" : undefined}
        aria-label={roster.length > 0 ? "Faction roster entries" : undefined}
      >
        {roster.length === 0 ? (
          <div className={labStyles.facArxxRosterEmpty} role="status">
            <p className={labStyles.facArxxRosterEmptyTitle}>No member rows</p>
            <p className={labStyles.facArxxRosterEmptyHint}>
              Use <strong>Add member</strong> — lab state mirrors{" "}
              <span className={labStyles.facArxxRosterEmptyKey}>hgArch.{FACTION_ROSTER_HG_ARCH_KEY}</span>.
            </p>
          </div>
        ) : (
          roster.map((row) => {
            const roleVal =
              row.kind === "character" ? (row.roleOverride ?? "") : (row.role ?? "");
            const nameVal =
              row.kind === "character" ? (row.displayNameOverride ?? "") : row.label;

            return (
              <div
                key={row.id}
                className={labStyles.facArxxRosterCard}
                role="listitem"
                data-faction-roster-entry-id={row.id}
                data-faction-roster-kind={row.kind}
              >
                <div className={labStyles.facArxxRosterCardBody}>
                  <input
                    type="text"
                    className={labStyles.facArxxRosterField}
                    aria-label={row.kind === "character" ? "Display name override" : "Roster label"}
                    value={nameVal}
                    placeholder={row.kind === "character" ? "Display name (optional)" : "Member name"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setRoster((prev) =>
                        prev.map((r) => {
                          if (r.id !== row.id) return r;
                          if (r.kind === "character") {
                            return { ...r, displayNameOverride: v ? v : undefined };
                          }
                          return { ...r, label: v };
                        }),
                      );
                    }}
                    onBlur={() => {
                      if (row.kind !== "unlinked") return;
                      setRoster((prev) =>
                        prev.map((r) =>
                          r.id === row.id && r.kind === "unlinked" && r.label.trim() === ""
                            ? { ...r, label: "Unnamed member" }
                            : r,
                        ),
                      );
                    }}
                  />
                  <input
                    type="text"
                    className={cx(labStyles.facArxxRosterField, labStyles.facArxxRosterFieldRole)}
                    aria-label="Role"
                    value={roleVal}
                    placeholder="Role (optional)"
                    onChange={(e) => {
                      const v = e.target.value;
                      setRoster((prev) =>
                        prev.map((r) => {
                          if (r.id !== row.id) return r;
                          if (r.kind === "character") {
                            return { ...r, roleOverride: v === "" ? undefined : v };
                          }
                          return { ...r, role: v === "" ? undefined : v };
                        }),
                      );
                    }}
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  tone="card-dark"
                  className={labStyles.facArxxRosterRemoveBtn}
                  aria-label="Remove member from roster"
                  onClick={() => removeMember(row.id)}
                >
                  <Trash size={14} weight="regular" />
                </Button>
              </div>
            );
          })
        )}
      </div>
      <div className={labStyles.facArxxRosterAddBar}>
        <Button
          type="button"
          variant="ghost"
          tone="card-dark"
          size="sm"
          className={labStyles.facArxxRosterAddBtn}
          leadingIcon={<Plus size={14} weight="regular" />}
          onClick={addUnlinkedMember}
        >
          Add member
        </Button>
      </div>
    </div>
  );
}

/** `DEMO_FACTION_ROSTER` via `parseFactionRoster` — same shape as production `content_json.hgArch.factionRoster` (read-only demo in lab). */
function FactionLabDemoHgArchRoster({
  variant,
}: {
  variant:
    | "indigo"
    | "terminal"
    | "ocular"
    | "ocularLight"
    | "synthesis"
    | "essentialist"
    | "clandestine";
}) {
  const roster = parseFactionRoster(DEMO_FACTION_ROSTER);
  if (!roster?.length) {
    return (
      <p className={labStyles.facRosterDemoInvalid} data-hg-lore-faction-roster-status="invalid">
        factionRoster parse failed (demo)
      </p>
    );
  }

  if (variant === "indigo") {
    return (
      <div
        className={labStyles.facIndigoRosterBlock}
        data-hg-lore-faction-roster="1"
        data-hg-arch-key={FACTION_ROSTER_HG_ARCH_KEY}
      >
        <div className={labStyles.facIndigoRosterSectionMarker}>
          <span className={labStyles.facIndigoRosterSectionLabel}>
            02 // MEMBERS · hgArch.{FACTION_ROSTER_HG_ARCH_KEY}
          </span>
          <hr className={labStyles.facIndigoRosterHr} />
        </div>
        <ul className={labStyles.facIndigoRosterList}>
          {roster.map((row) => {
            const role = factionRosterDemoRoleOptional(row);
            return (
              <li
                key={row.id}
                className={labStyles.facIndigoRosterRow}
                data-faction-roster-entry-id={row.id}
                data-faction-roster-kind={row.kind}
              >
                <div className={labStyles.facIndigoRosterTop}>
                  <span className={labStyles.facIndigoRosterName}>{factionRosterDemoDisplayName(row)}</span>
                  {role ? <span className={labStyles.facIndigoRosterRole}>{role}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (variant === "essentialist") {
    return (
      <div
        className={labStyles.facEssIdRoster}
        data-hg-lore-faction-roster="1"
        data-hg-arch-key={FACTION_ROSTER_HG_ARCH_KEY}
      >
        <div className={labStyles.facEssIdRosterLabel}>members · hgArch.{FACTION_ROSTER_HG_ARCH_KEY}</div>
        <div className={labStyles.facEssIdRosterList} role="list">
          {roster.map((row) => {
            const role = factionRosterDemoRoleOptional(row);
            return (
              <div
                key={row.id}
                className={labStyles.facEssIdRosterRow}
                role="listitem"
                data-faction-roster-entry-id={row.id}
                data-faction-roster-kind={row.kind}
              >
                <span className={labStyles.facEssIdRosterName}>{factionRosterDemoDisplayName(row)}</span>
                {role ? <span className={labStyles.facEssIdRosterRole}>{role}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === "synthesis") {
    return (
      <div
        className={labStyles.facSynthRoster}
        data-hg-lore-faction-roster="1"
        data-hg-arch-key={FACTION_ROSTER_HG_ARCH_KEY}
      >
        <div className={labStyles.facSynthRosterLabel}>ledger · hgArch.{FACTION_ROSTER_HG_ARCH_KEY}</div>
        {roster.map((row) => {
          const role = factionRosterDemoRoleOptional(row);
          return (
            <div
              key={row.id}
              className={labStyles.facSynthLedgerRow}
              data-faction-roster-entry-id={row.id}
              data-faction-roster-kind={row.kind}
            >
              <div className={labStyles.facSynthLedgerCategory}>{factionRosterDemoDisplayName(row)}</div>
              {role ? <div className={labStyles.facSynthLedgerRole}>{role}</div> : null}
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === "ocular") {
    return (
      <div
        className={labStyles.facOcularRoster}
        data-hg-lore-faction-roster="1"
        data-hg-arch-key={FACTION_ROSTER_HG_ARCH_KEY}
      >
        <div className={labStyles.facOcularRosterBar}>
          <span className={labStyles.facOcularRosterBarLeft}>personnel index</span>
          <span className={labStyles.facOcularRosterBarRight} title={`hgArch.${FACTION_ROSTER_HG_ARCH_KEY}`}>
            {roster.length} record{roster.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className={labStyles.facOcularRosterList} role="list">
          {roster.map((row) => {
            const role = factionRosterDemoRoleOptional(row);
            return (
              <div
                key={row.id}
                className={labStyles.facOcularRosterCard}
                role="listitem"
                data-faction-roster-entry-id={row.id}
                data-faction-roster-kind={row.kind}
              >
                <p className={labStyles.facOcularRosterCardName}>{factionRosterDemoDisplayName(row)}</p>
                {role ? <p className={labStyles.facOcularRosterCardRole}>{role}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === "ocularLight") {
    return (
      <div
        className={labStyles.facOclmRoster}
        data-hg-lore-faction-roster="1"
        data-hg-arch-key={FACTION_ROSTER_HG_ARCH_KEY}
      >
        <div className={labStyles.facOclmRosterBar}>
          <span className={labStyles.facOclmRosterBarLeft}>personnel index</span>
          <span className={labStyles.facOclmRosterBarRight} title={`hgArch.${FACTION_ROSTER_HG_ARCH_KEY}`}>
            {roster.length} record{roster.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className={labStyles.facOclmRosterList} role="list">
          {roster.map((row) => {
            const role = factionRosterDemoRoleOptional(row);
            return (
              <div
                key={row.id}
                className={labStyles.facOclmRosterCard}
                role="listitem"
                data-faction-roster-entry-id={row.id}
                data-faction-roster-kind={row.kind}
              >
                <p className={labStyles.facOclmRosterCardName}>{factionRosterDemoDisplayName(row)}</p>
                {role ? <p className={labStyles.facOclmRosterCardRole}>{role}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === "clandestine") {
    return (
      <div
        className={labStyles.facClandRoster}
        data-hg-lore-faction-roster="1"
        data-hg-arch-key={FACTION_ROSTER_HG_ARCH_KEY}
      >
        <div className={labStyles.facClandRosterBar}>
          <span className={labStyles.facClandRosterBarLeft}>circulation roster</span>
          <span className={labStyles.facClandRosterBarRight} title={`hgArch.${FACTION_ROSTER_HG_ARCH_KEY}`}>
            {roster.length} line{roster.length === 1 ? "" : "s"} · hgArch
          </span>
        </div>
        <div className={labStyles.facClandRosterList} role="list">
          {roster.map((row) => {
            const role = factionRosterDemoRoleOptional(row);
            return (
              <div
                key={row.id}
                className={labStyles.facClandRosterCard}
                role="listitem"
                data-faction-roster-entry-id={row.id}
                data-faction-roster-kind={row.kind}
              >
                <p className={labStyles.facClandRosterCardName}>{factionRosterDemoDisplayName(row)}</p>
                {role ? <p className={labStyles.facClandRosterCardRole}>{role}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={labStyles.facTermXivRoster}
      data-hg-lore-faction-roster="1"
      data-hg-arch-key={FACTION_ROSTER_HG_ARCH_KEY}
    >
      <div className={labStyles.facTermXivRosterBar}>
        <span className={labStyles.facTermXivRosterBarLeft}>members</span>
        <span className={labStyles.facTermXivRosterBarRight} title={`hgArch.${FACTION_ROSTER_HG_ARCH_KEY}`}>
          {roster.length} entr{roster.length === 1 ? "y" : "ies"} · hgArch
        </span>
      </div>
      <div className={labStyles.facTermXivRosterList} role="list">
        {roster.map((row) => {
          const role = factionRosterDemoRoleOptional(row);
          return (
            <div
              key={row.id}
              className={labStyles.facTermXivRosterCard}
              role="listitem"
              data-faction-roster-entry-id={row.id}
              data-faction-roster-kind={row.kind}
            >
              <p className={labStyles.facTermXivRosterCardName}>{factionRosterDemoDisplayName(row)}</p>
              {role ? <p className={labStyles.facTermXivRosterCardRole}>{role}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LabCard({
  headerTitle,
  tapeVariant,
  tapeRotation,
  className,
  children,
}: {
  headerTitle: string;
  tapeVariant: TapeVariant;
  tapeRotation: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        canvasStyles.entityNode,
        canvasStyles.themeDefault,
        canvasStyles.a4DocumentNode,
        className,
      )}
      style={{ width: 340, "--entity-width": "340px" } as CSSProperties}
    >
      <ArchitecturalNodeTape variant={tapeVariant} rotationDeg={tapeRotation} />
      <ArchitecturalNodeHeader
        title={headerTitle}
        showExpand={false}
        onExpand={() => {}}
        buttonTone="card-light"
      />
      <div className={labStyles.labBody}>{children}</div>
    </div>
  );
}

/**
 * Lab-only faction specimen — not a canvas lore node: no tape, no node header, no `a4DocumentBody` / `labBody`.
 * Uses neutral layout + tokens so previews can diverge structurally from canvas lore cards.
 */
function FactionLabPlate({
  plateKind,
  className,
  children,
}: {
  plateKind:
    | "slip"
    | "stub"
    | "iomemo"
    | "shelfcard"
    | "shelfcardSleeve"
    | "protocolOrdo"
    | "protocolOrdoCompact"
    | "protocolOrdoCompactMono"
    | "protocolSynod"
    | "protocolArchive091"
    /** XX · Archive-091 readable — IX void archive with larger type, blue frame, editable PRD fields + hgArch roster. */
    | "protocolArchive091Readable"
    | "protocolLattice"
    | "protocolAeonConclave"
    | "protocolAeonProtocol"
    /** XIII · Indigo Bloom — midnight protocol sheet (editable fields only; static atmosphere). */
    | "protocolIndigoBloom"
    /** XIV · Terminal fleet — minimal black mono: identity + charter + roster demo. */
    | "protocolTerminalFleet"
    /** XV · Ocular Mandate — grid dossier, Inter striped display, Space Mono body; roster demo. */
    | "protocolOcularMandate"
    /** XVI · Synthesis Archive — pale field, Playfair hero, glass pills, ledger roster demo. */
    | "protocolSynthesisArchive"
    /** XVII · Essentialist ID — faction identity + charter + hgArch roster demo (ID-badge chrome); no pointer tilt JS. */
    | "protocolEssentialistId"
    /** XVIII · Clandestine bureau brief — XII shell + XI bar + XV grid/stripes; editable PRD fields + roster demo. */
    | "protocolClandestineBrief"
    /** XIX · Ocular Mandate light — XV dossier in light mode, no rail, single-line sans title; roster demo. */
    | "protocolOcularMandateLight"
    /** Data-model priming — roster + placeholder fields; not a production canvas seed. */
    | "rosterPriming";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(labStyles.factionLabPlate, labStyles[`factionLabPlate_${plateKind}`], className)}
      data-hg-lab-faction-plate={plateKind}
      style={{ width: 340, "--entity-width": "340px" } as CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Priming specimen: validates `DEMO_FACTION_ROSTER` via `faction-roster-schema` and sketches
 * `data-hg-lore-faction-*` hooks for future editable faction fields (layout TBD).
 */
function FactionRosterPrimingBody({ testId }: { testId: string }) {
  const roster = parseFactionRoster(DEMO_FACTION_ROSTER);
  const valid = roster !== null && roster.length === DEMO_FACTION_ROSTER.length;

  return (
    <div className={labStyles.facRosterPrimingRoot} data-testid={testId}>
      <div className={labStyles.facRosterPrimingEyebrow}>Priming · not canvas seed HTML</div>
      <div className={labStyles.facRosterPrimingOrg} data-hg-lore-faction-field="orgName">
        Ironwood Mercantile Exchange
      </div>
      <div className={labStyles.facRosterPrimingNation} data-hg-lore-faction-field="context">
        Obsidian Reach
      </div>
      <div className={labStyles.facRosterPrimingRosterBlock} data-hg-lore-faction-roster="1">
        <div className={labStyles.facRosterPrimingRosterLabel}>
          Members ({FACTION_ROSTER_HG_ARCH_KEY})
        </div>
        <ul className={labStyles.facRosterPrimingList}>
          {roster?.map((row) => (
            <li
              key={row.id}
              className={labStyles.facRosterPrimingRow}
              data-faction-roster-entry-id={row.id}
            >
              {row.kind === "character" ? (
                <>
                  <span className={labStyles.facRosterPrimingName}>
                    {row.displayNameOverride ?? `Character ${row.characterItemId.slice(0, 8)}…`}
                  </span>
                  {row.roleOverride ? (
                    <span className={labStyles.facRosterPrimingRole}>{row.roleOverride}</span>
                  ) : null}
                </>
              ) : (
                <>
                  <span className={labStyles.facRosterPrimingName}>{row.label}</span>
                  {row.role ? <span className={labStyles.facRosterPrimingRole}>{row.role}</span> : null}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p
        className={labStyles.facRosterPrimingFoot}
        data-hg-lore-faction-schema-status={valid ? "ok" : "invalid"}
      >
        {valid ? `Zod: ${FACTION_ROSTER_HG_ARCH_KEY} validates (demo array)` : "Schema mismatch"}
      </p>
    </div>
  );
}

/** 8×8 pixel mark for protocol Ordo plate (CSS grid paints “on” cells). */
const FAC_ORDO_PIXEL_GRID: readonly (0 | 1)[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
];

function ProtocolOrdoLiveClock() {
  const [label, setLabel] = useState("00:00:00:00");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds(), Math.floor(now.getMilliseconds() / 10)]
        .map((v) => v.toString().padStart(2, "0"))
        .join(":");
      setLabel(timeStr);
    };
    tick();
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{label}</span>;
}

/** ORDO LUNARIS–style protocol sheet (lab-only; not canvas wiring). */
function FactionProtocolOrdoBody({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facOrdoRoot} data-testid={testId}>
      <div className={labStyles.facOrdoGeo} aria-hidden />
      <div className={labStyles.facOrdoGlow} aria-hidden />
      <div className={labStyles.facOrdoInner}>
        <header className={labStyles.facOrdoHeader}>
          <div className={labStyles.facOrdoLogoBlock}>
            <div className={labStyles.facOrdoPixelIcon} aria-hidden>
              {FAC_ORDO_PIXEL_GRID.map((row, ri) =>
                row.map((on, ci) => (
                  <span
                    key={`${ri}-${ci}`}
                    className={cx(labStyles.facOrdoPx, !on && labStyles.facOrdoPxOff)}
                  />
                )),
              )}
            </div>
            <span className={labStyles.facOrdoBrand}>ORDO LUNARIS</span>
          </div>
          <div className={labStyles.facOrdoSystemData}>
            <div>CLEARANCE: CHARTER</div>
            <div>
              <ProtocolOrdoLiveClock />
            </div>
            <div>LAT: 52.5200° N</div>
            <div>LON: 13.4050° E</div>
          </div>
        </header>

        <div className={labStyles.facOrdoDocGrid}>
          <div className={labStyles.facOrdoTitleRow}>
            <h1 className={labStyles.facOrdoDisplayTitle}>
              IRON
              <br />
              WOOD
            </h1>
            <div className={labStyles.facOrdoSecondaryTitle}>
              PROTO
              <br />
              COL 09
            </div>
          </div>

          <div className={labStyles.facOrdoMetaStamp}>
            ESTABLISHED 02.02.18
            <br />
            REVISED 21.11.23
            <br />
            SUBJECT: EXCHANGE CHARTER
            <br />
            REF: ORG-7741
          </div>

          <div className={labStyles.facOrdoMain}>
            <div className={labStyles.facOrdoContentBlock}>
              <h2 className={labStyles.facOrdoSectionLabel}>I. INITIATION DECREE</h2>
              <p className={labStyles.facOrdoP}>
                The ritual of the <span className={labStyles.facOrdoRedacted}>REDACTED</span> must be observed with
                clinical precision. Harbor alignment is biological: we breathe the frequency of the ledger. We become
                the echo.
              </p>
              <p className={labStyles.facOrdoP}>
                The architecture of the exchange demands total surrender of the self to the machine of tariffs.
              </p>
              <span className={labStyles.facOrdoBtn}>ACKNOWLEDGE PROTOCOL</span>
            </div>
            <div className={labStyles.facOrdoContentBlock}>
              <h2 className={labStyles.facOrdoSectionLabel}>II. OPERATIONAL GEOMETRY</h2>
              <p className={labStyles.facOrdoP}>
                The circles must overlap. The centers must never touch. The coral core is the only truth in a gray
                world. If the signal drifts beyond 0.04Hz, the{" "}
                <span className={labStyles.facOrdoRedacted}>REDACTED</span> will initiate immediately.
              </p>
            </div>
          </div>

          <aside className={labStyles.facOrdoSidebar} aria-label="Protocol margin notes">
            <div className={labStyles.facOrdoBox}>
              <svg className={labStyles.facOrdoArrowSvg} viewBox="0 0 24 24" aria-hidden>
                <path d="M7 17L17 7M17 7H8M17 7V16" />
              </svg>
              <div className={labStyles.facOrdoBoxText}>
                <strong>NODE 01</strong>
                <br />
                ASCENSION FREQUENCY: 88.2 KHZ
              </div>
            </div>
            <div className={cx(labStyles.facOrdoBox, labStyles.facOrdoBoxDashed)}>
              <strong>WARNING:</strong>
              <br />
              FAILURE TO COMPLY WITH PROTOCOL 09 RESULTS IN PERMANENT SIGNAL DEGRADATION.
            </div>
          </aside>

          <div className={labStyles.facOrdoFooterStrip}>
            00101101 // X-RAY // V-SYSTEM // LUNAR // ECHO // PROTOCOL 09
          </div>
        </div>
      </div>
    </div>
  );
}

/** VI · Compact ORDO LUNARIS — same family as VII, fewer blocks + tighter system sizing for the 340px plate. */
function FactionProtocolOrdoCompactBody({
  testId,
  brandLabel = "ORDO LUNARIS",
}: {
  testId: string;
  brandLabel?: string;
}) {
  return (
    <div className={labStyles.facOrdoRoot} data-testid={testId}>
      <div className={labStyles.facOrdoGeo} aria-hidden />
      <div className={labStyles.facOrdoGlow} aria-hidden />
      <div className={labStyles.facOrdoInner}>
        <header className={labStyles.facOrdoHeader}>
          <div className={labStyles.facOrdoLogoBlock}>
            <div className={labStyles.facOrdoPixelIcon} aria-hidden>
              {FAC_ORDO_PIXEL_GRID.map((row, ri) =>
                row.map((on, ci) => (
                  <span
                    key={`${ri}-${ci}`}
                    className={cx(labStyles.facOrdoPx, !on && labStyles.facOrdoPxOff)}
                  />
                )),
              )}
            </div>
            <span className={labStyles.facOrdoBrand}>{brandLabel}</span>
          </div>
          <div className={labStyles.facOrdoSystemData}>
            <div>CLEARANCE: CHARTER</div>
            <div>
              <ProtocolOrdoLiveClock />
            </div>
            <div>LAT: 52.5200° N</div>
            <div>LON: 13.4050° E</div>
          </div>
        </header>

        <div className={labStyles.facOrdoDocGrid}>
          <div className={labStyles.facOrdoTitleRow}>
            <h1 className={labStyles.facOrdoDisplayTitle}>
              IRON
              <br />
              WOOD
            </h1>
            <div className={labStyles.facOrdoSecondaryTitle}>
              PROTO
              <br />
              COL 09
            </div>
          </div>

          <div className={labStyles.facOrdoMetaStamp}>REF: ORG-7741 · SUBJECT: EXCHANGE CHARTER</div>

          <div className={labStyles.facOrdoMain}>
            <div className={labStyles.facOrdoContentBlock}>
              <h2 className={labStyles.facOrdoSectionLabel}>I. INITIATION DECREE</h2>
              <p className={labStyles.facOrdoP}>
                The ritual of the <span className={labStyles.facOrdoRedacted}>REDACTED</span> must be observed with
                clinical precision — harbor alignment to the ledger frequency; surrender to the machine of tariffs.
              </p>
            </div>
          </div>

          <div className={labStyles.facOrdoFooterStrip}>
            {"// LUNAR // ECHO // NODE 01 // PROTOCOL 09"}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Deterministic pseudo-coordinates so the same ref always charts the same bearing in the lab. */
function labStableLatLonFromSeed(seed: string): { lat: string; lon: string } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const lat = 48 + (h % 700) / 100;
  const lon = 6 + ((h >> 12) % 1100) / 100;
  return {
    lat: `${lat.toFixed(4)}° N`,
    lon: `${lon.toFixed(4)}° E`,
  };
}

function locOrdoV5ContextAcronym(context: string): string {
  const parts = context.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 6).toUpperCase();
  return parts
    .map((p) => p[0])
    .join("")
    .slice(0, 6)
    .toUpperCase();
}

function locOrdoV5SplitDisplayName(name: string): { line1: string; line2: string | null } {
  const t = name.trim();
  if (!t) return { line1: "UNTITLED", line2: null };
  const words = t.split(/\s+/);
  if (words.length === 1) return { line1: words[0].toUpperCase(), line2: null };
  const mid = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, mid).join(" ").toUpperCase(),
    line2: words.slice(mid).join(" ").toUpperCase(),
  };
}

function escapeHtmlForOrdoDoc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Initial HTML for V6 slab document region — same field slots + classes as the static slab; edited via {@link BufferedContentEditable}. */
function buildLocationOrdoV6DocHtml(
  s: typeof labStyles,
  line1: string,
  line2: string | null,
  context: string,
  detail: string,
  notes: string,
): string {
  const nameBr = line2 ? `<br />${escapeHtmlForOrdoDoc(line2)}` : "";
  return `<div class="${s.facOrdoDocGrid}"><div class="${s.facOrdoTitleRow}"><h1 class="${s.facOrdoDisplayTitle}" data-hg-lore-location-field="name">${escapeHtmlForOrdoDoc(line1)}${nameBr}</h1></div><p class="${s.facOrdoLocV6ContextLine}" data-hg-lore-location-field="context">${escapeHtmlForOrdoDoc(context)}</p><div class="${s.facOrdoMain}"><div class="${s.facOrdoContentBlock} ${s.facOrdoLocV5DocInline}"><p class="${s.facOrdoLocV5DetailLine}" data-hg-lore-location-field="detail">${escapeHtmlForOrdoDoc(detail)}</p><div class="${s.facOrdoLocV5NotesCell}" data-hg-lore-location-notes-cell="true"><div data-hg-lore-location-notes="true" class="${s.facOrdoLocV5NotesInner}"><p class="${s.facOrdoP}">${escapeHtmlForOrdoDoc(notes)}</p></div></div></div></div></div>`;
}

/** Slash menu → `document.execCommand` (same command ids as canvas legacy `runFormat`; checklist/image omitted in lab). */
function labOrdoSlashRichDocCommand(command: string, value?: string) {
  if (command === "arch:insertImage" || command === "arch:checklist") return;
  if (command === "formatBlock" && value) {
    document.execCommand("formatBlock", false, value);
    return;
  }
  document.execCommand(command, false, value);
}

/**
 * V5 · ORDO coordinate slab — same mono plate as v4, but DOM uses `lore-location` field slots (name / context / detail /
 * ref / notes). LAT/LON are a stable lab hash of the ref (not geocoding).
 */
function LocationOrdoCoordinateSlabV5Body({ testId }: { testId: string }) {
  const name = "Old Harbor Kiln No. 4";
  const context = "Kestrel Free City";
  const detail = "Dock ward · industrial brick";
  const ref = "KFC-DOCK-0847";
  const notesExcerpt =
    "Color band suggests landscape / atmosphere without an image asset. Strip uses the same full-bleed inset as the v3 survey bar — kiln shell still radiates dusk heat.";

  /** Lab specimen: survey fix + datum + elevation (MSL) — matches header LAT/LON rail tone. */
  const surveyFix = "2026-04-13";
  const datum = "WGS84";
  const elevMslM = "8.2";

  const { lat, lon } = labStableLatLonFromSeed(`${ref}|${name}`);
  const { line1, line2 } = locOrdoV5SplitDisplayName(name);
  const gridLabel = locOrdoV5ContextAcronym(context);
  const nodeTag = ref.split(/[-\s]/).pop() ?? ref;
  const footerWard = (detail.split("·")[0]?.trim() ?? detail).toUpperCase();

  return (
    <div
      className={labStyles.facOrdoRoot}
      data-testid={testId}
      data-hg-canvas-role="lore-location"
      data-hg-lore-location-variant="v5"
    >
      <div className={labStyles.facOrdoGeo} aria-hidden />
      <div className={labStyles.facOrdoGlow} aria-hidden />
      <div className={labStyles.facOrdoInner}>
        <header className={labStyles.facOrdoHeader}>
          <div className={labStyles.facOrdoLogoBlock}>
            <div className={labStyles.facOrdoPixelIcon} aria-hidden>
              {FAC_ORDO_PIXEL_GRID.map((row, ri) =>
                row.map((on, ci) => (
                  <span
                    key={`${ri}-${ci}`}
                    className={cx(labStyles.facOrdoPx, !on && labStyles.facOrdoPxOff)}
                  />
                )),
              )}
            </div>
            <span className={cx(labStyles.facOrdoBrand, labStyles.facOrdoLocV5BrandRef)}>LOCATION</span>
          </div>
          <div className={labStyles.facOrdoSystemData}>
            <div>REF: {ref}</div>
            <div>CHARTER: HARBOR EXCHANGE</div>
            <div>LAT: {lat}</div>
            <div>LON: {lon}</div>
          </div>
        </header>

        <div className={labStyles.facOrdoDocGrid}>
          <div className={labStyles.facOrdoTitleRow}>
            <h1 className={labStyles.facOrdoDisplayTitle} data-hg-lore-location-field="name">
              {line1}
              {line2 ? (
                <>
                  <br />
                  {line2}
                </>
              ) : null}
            </h1>
          </div>

          <div className={cx(labStyles.facOrdoMetaStamp, labStyles.facOrdoLocV5MetaStamp)}>
            <div>
              REF: <span data-hg-lore-location-field="ref">{ref}</span> · SUBJECT:{" "}
              <span data-hg-lore-location-field="context">{context}</span>
            </div>
            <div className={labStyles.facOrdoLocV5MetaStampSecond}>
              FIX: {surveyFix} · DATUM: {datum} · ELV: {elevMslM} M MSL
            </div>
          </div>

          <div className={labStyles.facOrdoMain}>
            <div className={cx(labStyles.facOrdoContentBlock, labStyles.facOrdoLocV5DocInline)}>
              <h2 className={cx(labStyles.facOrdoSectionLabel, labStyles.facOrdoLocV5DocEyebrow)}>
                I. SITE RECORD
              </h2>
              <p className={labStyles.facOrdoLocV5DetailLine} data-hg-lore-location-field="detail">
                {detail}
              </p>
              <div
                className={labStyles.facOrdoLocV5NotesCell}
                data-hg-lore-location-notes-cell="true"
                contentEditable={false}
              >
                <div
                  data-hg-lore-location-notes="true"
                  contentEditable={false}
                  className={labStyles.facOrdoLocV5NotesInner}
                >
                  <p className={labStyles.facOrdoP}>{notesExcerpt}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={labStyles.facOrdoFooterStrip}>
            {`// ${gridLabel} // ${footerWard} // NODE ${nodeTag}`}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * V6 · Lean ORDO mono slab — `lore-location` field slots in one **`BufferedContentEditable`** (legacy rich HTML, same
 * family as canvas default/task node bodies: `/` slash blocks, execCommand formatting, optional checklist rows). Header
 * is LOCATION + expand only. Vault search still indexes `title` + `contentText`, not per-field keys.
 */
function LocationOrdoCoordinateSlabV6Body({ testId }: { testId: string }) {
  const name = "Old Harbor Kiln No. 4";
  const context = "Kestrel Free City";
  const detail = "Dock ward · industrial brick";
  const notesExcerpt =
    "Color band suggests landscape / atmosphere without an image asset. Strip uses the same full-bleed inset as the v3 survey bar — kiln shell still radiates dusk heat.";

  const { line1, line2 } = locOrdoV5SplitDisplayName(name);
  const [docHtml, setDocHtml] = useState(() =>
    buildLocationOrdoV6DocHtml(labStyles, line1, line2, context, detail, notesExcerpt),
  );

  const onDocCommit = useCallback((next: string) => {
    setDocHtml(next);
  }, []);

  return (
    <div
      className={labStyles.facOrdoRoot}
      data-testid={testId}
      data-hg-canvas-role="lore-location"
      data-hg-lore-location-variant="v6"
    >
      <div className={labStyles.facOrdoGeo} aria-hidden />
      <div className={labStyles.facOrdoGlow} aria-hidden />
      <div className={labStyles.facOrdoInner}>
        <header className={labStyles.facOrdoHeader}>
          <div className={labStyles.facOrdoLogoBlock}>
            <div className={labStyles.facOrdoPixelIcon} aria-hidden>
              {FAC_ORDO_PIXEL_GRID.map((row, ri) =>
                row.map((on, ci) => (
                  <span
                    key={`${ri}-${ci}`}
                    className={cx(labStyles.facOrdoPx, !on && labStyles.facOrdoPxOff)}
                  />
                )),
              )}
            </div>
            <span className={cx(labStyles.facOrdoBrand, labStyles.facOrdoLocV5BrandRef)}>LOCATION</span>
          </div>
          <div className={labStyles.facOrdoHeaderRight}>
            <ArchitecturalTooltip content="Expand object" side="bottom" delayMs={320}>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                tone="card-light"
                className={labStyles.facOrdoHeaderExpandBtn}
                data-expand-btn="true"
                aria-label="Expand object"
                onClick={() => {}}
              >
                <ArrowsOutSimple size={14} />
              </Button>
            </ArchitecturalTooltip>
          </div>
        </header>

        <BufferedContentEditable
          value={docHtml}
          className={cx(labStyles.facOrdoV6RichHost)}
          editable
          spellCheck
          debounceMs={300}
          wikiLinkAssist={null}
          richDocCommand={labOrdoSlashRichDocCommand}
          emptyPlaceholder="Edit location fields…"
          checklistDeletion={{
            taskItem: canvasStyles.taskItem,
            taskText: canvasStyles.taskText,
            taskCheckbox: canvasStyles.taskCheckbox,
          }}
          onCommit={onDocCommit}
          dataAttribute="data-node-body-editor"
        />
      </div>
    </div>
  );
}

function LocationOrdoCoordinateSlabV7LabBody() {
  const seed = useMemo(() => getLoreNodeSeedBodyHtml("location", "v7"), []);
  const [bodyHtml, setBodyHtml] = useState(seed);
  return (
    <LoreLocationOrdoV7Slab
      nodeId="loc-lab-ordo-coordinate-mono-v7"
      labTestId="loc-lab-ordo-coordinate-mono-v7"
      bodyHtml={bodyHtml}
      editable
      onCommit={setBodyHtml}
    />
  );
}

/** Silent Synod — legible “brief” layout for the 340px plate (cream / blood accent; dossier + sigil motion omitted). */
function FactionSilentSynodBody({ testId }: { testId: string }) {
  const [dateStr] = useState(() =>
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
  );

  return (
    <div className={labStyles.facSynodRoot} data-testid={testId}>
      <div className={labStyles.facSynodBrief}>
        <header className={labStyles.facSynodBriefHead}>
          <div className={labStyles.facSynodBriefTitleBlock}>
            <p className={labStyles.facSynodBriefEyebrow}>Bureau · transdimensional affairs</p>
            <h1 className={labStyles.facSynodBriefH1}>Silent Synod</h1>
            <p className={labStyles.facSynodBriefCode}>OMEGA-7</p>
          </div>
          <div className={labStyles.facSynodBriefAside}>
            <span className={labStyles.facSynodBriefAsideLine}>DOC-774-B</span>
            <span className={labStyles.facSynodBriefAsideLine} suppressHydrationWarning>
              {dateStr}
            </span>
            <span className={labStyles.facSynodBriefStatus}>Unresolved</span>
          </div>
        </header>

        <p className={labStyles.facSynodBriefLead}>
          <strong>Constant evolution</strong> — map vectors before entropy lands. Ironwood holds the ledger;{" "}
          <span className={labStyles.facSynodBriefRedact}>the veil</span> holds the charter.
        </p>

        <dl className={labStyles.facSynodBriefFacts}>
          <div className={labStyles.facSynodBriefFact}>
            <dt>Clearance</dt>
            <dd>Level V · eyes only</dd>
          </div>
          <div className={labStyles.facSynodBriefFact}>
            <dt>Risk</dt>
            <dd>Existential erasure</dd>
          </div>
        </dl>

        <section className={labStyles.facSynodBriefSection} aria-label="Standing order">
          <h2 className={labStyles.facSynodBriefH2}>Standing order</h2>
          <p className={labStyles.facSynodBriefP}>
            Report visual echoing to the ward. No static structures past the threshold — when{" "}
            <span className={labStyles.facSynodBriefRedact}>geometries shift</span>, dissolve cleanly.
          </p>
        </section>

        <footer className={labStyles.facSynodBriefFoot}>
          <span className={labStyles.facSynodBriefFootText}>ORG-7741 · Obsidian Reach</span>
          <span className={labStyles.facSynodBriefStamp}>OMEGA</span>
        </footer>
      </div>
    </div>
  );
}

/** ARCHIVE-091 void document (lab-only; dark field, Playfair + mono; no canvas grain / no parallax). */
function FactionArchive091Body({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facArcRoot} data-testid={testId}>
      <div className={labStyles.facArcGrain} aria-hidden />
      <div className={labStyles.facArcPage}>
        <aside className={labStyles.facArcRail} aria-hidden>
          <div className={labStyles.facArcVertical}>Restricted // Access // 091</div>
          <svg className={labStyles.facArcStar} viewBox="0 0 24 24">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" fill="currentColor" />
          </svg>
          <div className={labStyles.facArcVertical}>07652-46738225-415523907</div>
          <div className={labStyles.facArcBarcode} />
        </aside>

        <div className={labStyles.facArcMain}>
          <div className={labStyles.facArcMetaStrip}>
            <span>Ref: VOID_MANIFEST_v4.2</span>
            <span className={labStyles.facArcBlink}>● RECORDING_IN_PROGRESS</span>
            <span>EST: 1984.09.12</span>
          </div>

          <header className={labStyles.facArcLetterhead}>
            <h1 className={labStyles.facArcH1}>Absence</h1>
            <div className={labStyles.facArcSubTitle}>Of Mind</div>
            <div className={labStyles.facArcOrderLine}>By the order of the Void Collective</div>
          </header>

          <div className={labStyles.facArcContentBody}>
            <div className={labStyles.facArcTextSection}>
              <h2 className={labStyles.facArcH2}>The Protocol</h2>
              <p className={labStyles.facArcP}>
                To reach <em className={labStyles.facArcEm}>the Absolute Neutral</em>, surrender the chronological
                anchor. Catalog the exterior, then displace it in the ledger furnace — Ironwood tariff binders only.
              </p>
              <p className={labStyles.facArcP}>
                The horizon does not curve for the eye; it curves for the soul. We are the quiet space between
                charter clauses.
              </p>
              <span className={labStyles.facArcPill}>PHASE-RED-CLEARED</span>
            </div>
            <div className={labStyles.facArcTextSection}>
              <h2 className={labStyles.facArcH2}>Member metrics</h2>
              <table className={labStyles.facArcTable}>
                <tbody>
                  <tr>
                    <td className={labStyles.facArcTdLabel}>Initiate ID</td>
                    <td>#091-ALPHA-9</td>
                  </tr>
                  <tr>
                    <td className={labStyles.facArcTdLabel}>Vibration Hz</td>
                    <td>432.00012</td>
                  </tr>
                  <tr>
                    <td className={labStyles.facArcTdLabel}>Cognitive drift</td>
                    <td>0.002% [STABLE]</td>
                  </tr>
                  <tr>
                    <td className={labStyles.facArcTdLabel}>Ascension prob</td>
                    <td>88.4%</td>
                  </tr>
                  <tr>
                    <td className={labStyles.facArcTdLabel}>Last ritual</td>
                    <td>12.04.2024</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <span className={labStyles.facArcBtn} role="presentation">
            Initiate void protocol
          </span>

          <footer className={labStyles.facArcFooter}>
            <span className={labStyles.facArcPill}>SERIAL: 091-VOID-RKTT</span>
            <div className={labStyles.facArcFooterMid}>All rights forfeited to the void · Obsidian Reach registry</div>
            <div className={labStyles.facArcBarcode} />
          </footer>
        </div>

        <aside className={labStyles.facArcRail} aria-hidden>
          <svg className={labStyles.facArcStar} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" />
            <path d="M12 2L12 22 M2 12 L22 12" stroke="currentColor" strokeWidth="0.5" />
          </svg>
          <div className={labStyles.facArcVertical}>System // status // nominal</div>
          <div className={labStyles.facArcVertical}>Encrypted // channel // 091</div>
          <span className={labStyles.facArcPillVert}>091</span>
        </aside>
      </div>
    </div>
  );
}

/**
 * XX · Archive-091 (readable) — same void-archive IA as IX with larger type, subtle blue frame, and faction PRD wiring.
 * Top chrome: slim archive plate header (mono slug + focus affordance). Metrics table replaced by
 * hgArch roster demo; protocol body is `document`. No bottom serial/registry footer strip.
 */
function FactionArchive091ReadableV20Body({ testId }: { testId: string }) {
  const [archiveRoster, setArchiveRoster] = useState<FactionRosterEntry[]>(() => {
    const parsed = parseFactionRoster(DEMO_FACTION_ROSTER);
    return parsed?.length ? parsed : [];
  });
  const archiveMemberCount = archiveRoster.length;
  const archiveDocumentRef = useRef<HTMLDivElement>(null);
  const facArxxLetterheadPhRef = useRef<HTMLDivElement>(null);

  /** Do not combine `dangerouslySetInnerHTML` with `contentEditable` — React reconciliation can throw (removeChild on null). */
  useLayoutEffect(() => {
    const el = archiveDocumentRef.current;
    if (!el) return;
    el.innerHTML = FACTION_LAB_ARCHIVE091_READABLE_DOCUMENT_HTML;
  }, []);

  useLayoutEffect(() => {
    const shell = facArxxLetterheadPhRef.current;
    if (!shell) return;
    syncLoreV9RedactedPlaceholderState(shell);
    const removeGuards = installLorePlaceholderSelectionGuards(shell);
    const removePhCaret = installLoreV11PlaceholderCaretSync(shell);
    const onInput = () => {
      syncLoreV9RedactedPlaceholderState(shell);
    };
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent;
      const field = (ie.target as HTMLElement | null)?.closest?.("[data-hg-lore-field]");
      if (!field || !(field instanceof HTMLElement) || !shell.contains(field)) return;
      if (!consumeLorePlaceholderBeforeInput(field, ie)) return;
      syncLoreV9RedactedPlaceholderState(shell);
      queueMicrotask(() => {
        if (field.isConnected) placeCaretAfterLorePlaceholderReplace(field);
      });
    };
    const onFocusOut = () => {
      queueMicrotask(() => syncLoreV9RedactedPlaceholderState(shell));
    };
    shell.addEventListener("beforeinput", onBeforeInput, true);
    shell.addEventListener("input", onInput, true);
    shell.addEventListener("focusout", onFocusOut);
    return () => {
      removeGuards();
      removePhCaret();
      shell.removeEventListener("beforeinput", onBeforeInput, true);
      shell.removeEventListener("input", onInput, true);
      shell.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return (
    <div className={labStyles.facArxxRoot} data-testid={testId} data-hg-lab-faction-specimen="xx-archive-091-readable">
      <div className={labStyles.facArxxGrain} aria-hidden />
      <div className={labStyles.facArxxPage}>
        <aside className={labStyles.facArxxRail} aria-hidden>
          <div className={labStyles.facArxxVertical}>Restricted // Access // 091</div>
          <svg className={labStyles.facArxxStar} viewBox="0 0 24 24">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" fill="currentColor" />
          </svg>
          <div className={labStyles.facArxxVertical}>07652-46738225-415523907</div>
          <div className={labStyles.facArxxBarcode} />
        </aside>

        <div className={labStyles.facArxxMain}>
          <div className={labStyles.facArxxFocusTop} data-hg-lab-arxx-focus-chrome="1">
            <div className={labStyles.facArxxPlateHeader}>
              <span className={labStyles.facArxxPlateHeaderTitle}>Faction</span>
              <div className={labStyles.facArxxPlateHeaderActions}>
                <ArchitecturalTooltip content="Focus Mode" side="bottom" delayMs={320}>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    tone="card-dark"
                    className={labStyles.facArxxPlateHeaderBtn}
                    data-expand-btn="true"
                    aria-label="Focus Mode"
                    onClick={() => {}}
                  >
                    <ArrowsOutSimple size={12} weight="regular" />
                  </Button>
                </ArchitecturalTooltip>
              </div>
            </div>
          </div>

          <div className={labStyles.facArxxRule} role="presentation" aria-hidden />

          <header className={labStyles.facArxxLetterhead}>
            <div
              ref={facArxxLetterheadPhRef}
              className={cx(cardStyles.charSkShellV11, labStyles.facArxxLetterheadPh)}
            >
              <h1
                className={cx(cardStyles.charSkDisplayName, labStyles.facArxxLetterheadPrimary)}
                contentEditable
                spellCheck={false}
                suppressContentEditableWarning
                data-hg-lore-field="1"
                data-hg-lore-placeholder="true"
                data-hg-lore-ph={LORE_V9_REDACTED_SENTINEL}
                data-hg-lore-faction-field="orgNamePrimary"
              >
                {LORE_V9_REDACTED_SENTINEL}
              </h1>
              <div
                className={cx(cardStyles.charSkRole, labStyles.facArxxLetterheadSecondary)}
                contentEditable
                spellCheck={false}
                suppressContentEditableWarning
                data-hg-lore-field="1"
                data-hg-lore-placeholder="true"
                data-hg-lore-ph={LORE_V9_REDACTED_SENTINEL}
                data-hg-lore-faction-field="orgNameAccent"
              >
                {LORE_V9_REDACTED_SENTINEL}
              </div>
            </div>
          </header>

          <div className={labStyles.facArxxRule} role="presentation" aria-hidden />

          <div className={labStyles.facArxxTextSection}>
            <div className={labStyles.facArxxH2Row}>
              <h2 className={labStyles.facArxxH2}>Member index</h2>
              <span
                className={labStyles.facArxxH2Meta}
                title={`hgArch.${FACTION_ROSTER_HG_ARCH_KEY}`}
              >
                {archiveMemberCount} record{archiveMemberCount === 1 ? "" : "s"}
              </span>
            </div>
            <FactionArchive091ReadableRosterManager roster={archiveRoster} setRoster={setArchiveRoster} />
          </div>

          <div className={labStyles.facArxxRule} role="presentation" aria-hidden />

          <div className={labStyles.facArxxTextSection}>
            <h2 className={labStyles.facArxxH2}>Record</h2>
            <div
              ref={archiveDocumentRef}
              className={labStyles.facArxxDocument}
              contentEditable
              spellCheck={false}
              suppressHydrationWarning
              data-hg-lore-faction-field="document"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lattice induction — legible “notice” layout for 340px: masthead, stat rows, one obligation; avatar + micro-meta omitted. */
function FactionLatticeInductionBody({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facLatRoot} data-testid={testId}>
      <div className={labStyles.facLatScanlines} aria-hidden />
      <div className={labStyles.facLatDoc}>
        <header className={labStyles.facLatMast}>
          <div className={labStyles.facLatLogoMark} aria-hidden />
          <div className={labStyles.facLatMastText}>
            <div className={labStyles.facLatMastTitle}>The Lattice</div>
            <div className={labStyles.facLatMastSub}>Induction · HG-LATTICE · enrollment open</div>
          </div>
        </header>

        <p className={labStyles.facLatLead}>
          Offer: the title of <span className={labStyles.facLatRedacted}>Primary vessel</span> within the Obsidian
          Reach charter ring.
        </p>

        <ul className={labStyles.facLatStatList} aria-label="Terms">
          <li className={labStyles.facLatStatRow}>
            <span className={labStyles.facLatStatLabel}>Charter stake</span>
            <span className={labStyles.facLatStatVal}>∞ fixed</span>
          </li>
          <li className={labStyles.facLatStatRow}>
            <span className={labStyles.facLatStatLabel}>Quorum</span>
            <span className={labStyles.facLatStatVal}>21 Dec</span>
          </li>
          <li className={labStyles.facLatStatRow}>
            <span className={labStyles.facLatStatLabel}>Review</span>
            <span className={labStyles.facLatStatVal}>9 cycles</span>
          </li>
        </ul>

        <p className={labStyles.facLatOblig}>
          Obligation: hold the Ironwood ledger mesh coherent; invoke{" "}
          <span className={labStyles.facLatRedacted}>Silencing protocol</span> on divergent tariff paths.
        </p>

        <footer className={labStyles.facLatFooter}>
          <div className={labStyles.facLatDecline}>
            Renounce <span aria-hidden>×</span>
          </div>
          <div className={labStyles.facLatAccept}>
            <div className={labStyles.facLatAcceptInner}>
              Accept induction <span className={labStyles.facLatArrow}>→</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** XI · AEON Conclave terminal sheet — light field, crimson accent, mono rail; lab-only, static (no clock / pointer FX). */
function FactionAeonConclaveBody({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facAeonRoot} data-testid={testId}>
      <header className={labStyles.facAeonTopBar}>
        <div className={labStyles.facAeonTopLeft}>
          <span className={labStyles.facAeonStatusDot} aria-hidden />
          <span>Classified · level 9 clearance only</span>
        </div>
        <div className={labStyles.facAeonTopRight}>TS-661.00 · 14:32:08</div>
      </header>

      <div className={labStyles.facAeonLetterhead}>
        <h1 className={labStyles.facAeonDisplay}>
          AEON
          <br />
          CONCLAVE
        </h1>
        <div className={labStyles.facAeonSubhead}>
          <span>Office of the prime arbiter</span>
          <span>Doc ref · HG-77-ALPHA-VOID</span>
        </div>
      </div>

      <div className={labStyles.facAeonGrid}>
        <aside className={labStyles.facAeonMeta} aria-label="Document metadata">
          <div className={labStyles.facAeonMetaRow}>
            <span>Subject</span>
            <span>The great pillar</span>
          </div>
          <div className={labStyles.facAeonMetaRow}>
            <span>Date</span>
            <span>Nov 14, 2024</span>
          </div>
          <div className={labStyles.facAeonMetaRow}>
            <span>Origin</span>
            <span>Sector 7-G</span>
          </div>
          <div className={labStyles.facAeonMetaRow}>
            <span>Handling</span>
            <span>Eyes only</span>
          </div>
          <div className={labStyles.facAeonMetaBlock}>
            <div className={labStyles.facAeonMetaRow}>
              <span>Stability</span>
              <span>Critical</span>
            </div>
          </div>
        </aside>

        <section className={labStyles.facAeonContent} aria-label="Transmission body">
          <span className={labStyles.facAeonParaNum}>001</span>
          <p className={labStyles.facAeonP}>
            As established in the prior quorum, the presence of the{" "}
            <span className={labStyles.facAeonRedacted}>Obsidian monolith</span> within the harbor lower vault has begun
            to manifest structural drift in local ledger coherence. Initial sensor readings suggest non-linear temporal
            leakage. We are no longer cataloging an artifact; we are looking at an aperture.
          </p>

          <div className={labStyles.facAeonVisual} aria-hidden>
            <div className={labStyles.facAeonOrb} />
            <div className={labStyles.facAeonOrbMid} />
            <div className={labStyles.facAeonOrbSm} />
            <div className={labStyles.facAeonFigCap}>Fig 1.0 · radiant field capture (7.21ms)</div>
          </div>

          <span className={labStyles.facAeonParaNum}>002</span>
          <p className={labStyles.facAeonP}>
            Participants scheduled for the <span className={labStyles.facAeonRedacted}>ascension rite</span> must be
            notified of increased volatility. The Conclave does not guarantee physical cohesion past the threshold. Those
            who experience <strong className={labStyles.facAeonStrong}>visual echoing</strong> are to report immediately
            to the Sanitization Ward.
          </p>

          <span className={labStyles.facAeonParaNum}>003</span>
          <p className={labStyles.facAeonP}>
            The following coordinates have been struck from all public maps:{" "}
            <span className={labStyles.facAeonRedacted}>45.892° N, 12.001° E</span>. Communication regarding the Sound
            of the Bone will be met with immediate{" "}
            <span className={labStyles.facAeonRedacted}>Silencing protocol 4</span>.
          </p>

          <div className={labStyles.facAeonSignature}>
            <div className={labStyles.facAeonSignCol}>
              <div className={labStyles.facAeonCertLabel}>Certified by</div>
              <div className={labStyles.facAeonSignName}>A. V. Valerius</div>
              <div className={labStyles.facAeonSignRole}>High priest · ops director</div>
            </div>
            <div className={labStyles.facAeonSeal}>VOID</div>
          </div>
        </section>
      </div>

      <div className={labStyles.facAeonFooterRail}>Ironwood conclave · Obsidian Reach registry · void transmission</div>
    </div>
  );
}

/** XIII · Protocol Indigo Bloom — cobalt / midnight / orange; editable org + directive + jurisdiction + document; demo `hgArch.factionRoster` block (read-only). */
function FactionIndigoBloomV13Body({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facIndigoRoot} data-testid={testId} data-hg-lab-faction-specimen="xiii-indigo-bloom">
      <div className={labStyles.facIndigoBg} aria-hidden />
      <div className={labStyles.facIndigoBloom} aria-hidden />
      <div className={labStyles.facIndigoDoc}>
        <div className={labStyles.facIndigoLayout}>
          <div className={labStyles.facIndigoRail} aria-hidden>
            EST. 1922 // SECTOR 09 // AZURE BLOOM // LAST UPDATED 2024.10.14
          </div>
          <div className={labStyles.facIndigoMain}>
            <div className={labStyles.facIndigoHeaderRow}>
              <div className={labStyles.facIndigoTitleCol}>
                <div className={labStyles.facIndigoTitleBlock}>
                  <div
                    className={labStyles.facIndigoTitleLine}
                    contentEditable
                    spellCheck={false}
                    suppressContentEditableWarning
                    data-hg-lore-faction-field="orgNamePrimary"
                  >
                    Symphony of
                  </div>
                  <div
                    className={labStyles.facIndigoTitleAccent}
                    contentEditable
                    spellCheck={false}
                    suppressContentEditableWarning
                    data-hg-lore-faction-field="orgNameAccent"
                  >
                    Anemone
                  </div>
                </div>
              </div>
              <div className={labStyles.facIndigoSeal} aria-hidden>
                <svg className={labStyles.facIndigoSealSvg} viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
                  <path
                    d="M50 10 L60 40 L90 50 L60 60 L50 90 L40 60 L10 50 L40 40 Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                  <text
                    x="50"
                    y="52"
                    fontFamily="Space Mono, monospace"
                    fontSize="4"
                    textAnchor="middle"
                    fill="currentColor"
                  >
                    VOID
                  </text>
                </svg>
              </div>
            </div>
            <p
              className={labStyles.facIndigoSubtitle}
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="subtitle"
            >
              Directive // Protocol IV-Blue
            </p>
            <p
              className={labStyles.facIndigoContext}
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="context"
            >
              Obsidian Reach
            </p>
            <div className={labStyles.facIndigoSectionMarker} aria-hidden>
              <span className={labStyles.facIndigoSectionLabel}>01 // THE VERNAL EQUINOX RITUAL</span>
              <hr />
            </div>
            <div
              className={labStyles.facIndigoDocument}
              contentEditable
              spellCheck={false}
              suppressHydrationWarning
              data-hg-lore-faction-field="document"
              dangerouslySetInnerHTML={{ __html: FACTION_LAB_INDIGO_DOCUMENT_HTML }}
            />
            <FactionLabDemoHgArchRoster variant="indigo" />
            <div className={labStyles.facIndigoAck} aria-hidden>
              Acknowledge transmission
            </div>
            <footer className={labStyles.facIndigoFooter}>
              <span className={labStyles.facIndigoFooterWordmark}>ANEMONE.</span>
              <span className={labStyles.facIndigoFooterMeta}>
                COPYRIGHT © 2024 THE ORDER OF AZURE · ALL DIMENSIONS RESERVED
              </span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

/** XIV · Terminal fleet — minimal mono plate: identity fields + charter + `hgArch.factionRoster` demo (no decorative telemetry). */
function FactionTerminalFleetV14Body({ testId }: { testId: string }) {
  return (
    <div
      className={labStyles.facTermXivRoot}
      data-testid={testId}
      data-hg-lab-faction-specimen="xiv-terminal-fleet"
    >
      <header className={labStyles.facTermXivHeader}>
        <div className={labStyles.facTermXivHeaderRow}>
          <div className={labStyles.facTermXivKv}>
            <span className={labStyles.facTermXivK}>host</span>
            <span
              className={labStyles.facTermXivV}
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="orgNamePrimary"
            >
              node-prod-zeus
            </span>
          </div>
          <div className={labStyles.facTermXivKv}>
            <span className={labStyles.facTermXivK}>env</span>
            <span
              className={labStyles.facTermXivV}
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="context"
            >
              production
            </span>
          </div>
        </div>
        <div className={labStyles.facTermXivHeaderRow}>
          <div className={labStyles.facTermXivKvWide}>
            <span className={labStyles.facTermXivK}>directive</span>
            <span
              className={labStyles.facTermXivV}
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="subtitle"
            >
              CHARTER // HEARTWOOD EXCHANGE · RING 7
            </span>
          </div>
        </div>
      </header>

      <div
        className={labStyles.facTermXivDocument}
        contentEditable
        spellCheck={false}
        suppressHydrationWarning
        data-hg-lore-faction-field="document"
        dangerouslySetInnerHTML={{ __html: FACTION_LAB_TERMINAL_DOCUMENT_HTML }}
      />

      <FactionLabDemoHgArchRoster variant="terminal" />
    </div>
  );
}

/** XV · Ocular Mandate — grid dossier + striped display type; editable PRD fields + hgArch roster demo; no images / JS. */
function FactionOcularMandateV15Body({ testId }: { testId: string }) {
  return (
    <div
      className={labStyles.facOcularRoot}
      data-testid={testId}
      data-hg-lab-faction-specimen="xv-ocular-mandate"
    >
      <div className={labStyles.facOcularGridBg} aria-hidden />
      <div className={labStyles.facOcularFrame}>
        <div className={labStyles.facOcularRail} aria-hidden>
          protocol 09 · class omega · node 009
        </div>
        <div className={labStyles.facOcularMain}>
          <header className={labStyles.facOcularHeader}>
            <div className={labStyles.facOcularHeaderLeft}>
              <div className={labStyles.facOcularK}>jurisdiction</div>
              <div
                className={labStyles.facOcularContext}
                contentEditable
                spellCheck={false}
                suppressContentEditableWarning
                data-hg-lore-faction-field="context"
              >
                Central Command / Sector 7
              </div>
            </div>
            <div className={labStyles.facOcularHeaderRight}>
              <span className={labStyles.facOcularStamp}>authorized</span>
            </div>
          </header>

          <div className={labStyles.facOcularTitleBlock}>
            <div
              className={labStyles.facOcularStripedLg}
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="orgNamePrimary"
            >
              Ocular
            </div>
            <div
              className={labStyles.facOcularStripedSm}
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="orgNameAccent"
            >
              Sovereignty
            </div>
          </div>

          <div className={labStyles.facOcularSubjectRow}>
            <span className={labStyles.facOcularK}>directive</span>
            <span
              className={labStyles.facOcularSubjectVal}
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="subtitle"
            >
              THE OCULAR MANDATE // PROTOCOL 09
            </span>
          </div>

          <div
            className={labStyles.facOcularDocument}
            contentEditable
            spellCheck={false}
            suppressHydrationWarning
            data-hg-lore-faction-field="document"
            dangerouslySetInnerHTML={{ __html: FACTION_LAB_OCULAR_DOCUMENT_HTML }}
          />

          <div className={labStyles.facOcularEvidence} aria-hidden>
            <span className={labStyles.facOcularEvidenceInner}>evidence slot · no image in lab</span>
          </div>

          <FactionLabDemoHgArchRoster variant="ocular" />

          <div className={labStyles.facOcularFooterSlug} aria-hidden>
            mandate.sys / verify
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * XIX · Ocular Mandate (light) — same dossier IA as XV: grid field, authorized stamp, directive, document, evidence frame,
 * personnel roster. Light paper palette, no vertical rail, single-line Inter title (`orgNamePrimary` only; fold accent into
 * this line in production if needed). CSS only.
 */
function FactionOcularMandateLightV19Body({ testId }: { testId: string }) {
  return (
    <div
      className={labStyles.facOclmRoot}
      data-testid={testId}
      data-hg-lab-faction-specimen="xix-ocular-mandate-light"
    >
      <div className={labStyles.facOclmGridBg} aria-hidden />
      <div className={labStyles.facOclmMain}>
        <header className={labStyles.facOclmHeader}>
          <div className={labStyles.facOclmHeaderLeft}>
            <div className={labStyles.facOclmK}>jurisdiction</div>
            <div
              className={labStyles.facOclmContext}
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="context"
            >
              Central Command / Sector 7
            </div>
          </div>
          <div className={labStyles.facOclmHeaderRight}>
            <span className={labStyles.facOclmStamp}>authorized</span>
          </div>
        </header>

        <h2
          className={labStyles.facOclmTitle}
          contentEditable
          spellCheck={false}
          suppressContentEditableWarning
          data-hg-lore-faction-field="orgNamePrimary"
        >
          Ocular sovereignty
        </h2>

        <div className={labStyles.facOclmSubjectRow}>
          <span className={labStyles.facOclmK}>directive</span>
          <span
            className={labStyles.facOclmSubjectVal}
            contentEditable
            spellCheck={false}
            suppressContentEditableWarning
            data-hg-lore-faction-field="subtitle"
          >
            THE OCULAR MANDATE // PROTOCOL 09
          </span>
        </div>

        <div
          className={labStyles.facOclmDocument}
          contentEditable
          spellCheck={false}
          suppressHydrationWarning
          data-hg-lore-faction-field="document"
          dangerouslySetInnerHTML={{ __html: FACTION_LAB_OCULAR_DOCUMENT_HTML }}
        />

        <div className={labStyles.facOclmEvidence} aria-hidden>
          <span className={labStyles.facOclmEvidenceInner}>evidence slot · no image in lab</span>
        </div>

        <FactionLabDemoHgArchRoster variant="ocularLight" />

        <div className={labStyles.facOclmFooterSlug} aria-hidden>
          mandate.sys / verify
        </div>
      </div>
    </div>
  );
}

/** XVI · Synthesis Archive — Inter + Playfair + JetBrains; glass corner pills, strip + ledger roster; no clock / pointer JS. */
function FactionSynthesisArchiveV16Body({ testId }: { testId: string }) {
  return (
    <div
      className={labStyles.facSynthRoot}
      data-testid={testId}
      data-hg-lab-faction-specimen="xvi-synthesis-archive"
    >
      <div className={labStyles.facSynthNoise} aria-hidden />
      <nav className={labStyles.facSynthNav} aria-label="Archive navigation (decorative)">
        <div className={cx(labStyles.facSynthPill, labStyles.facSynthPillTopLeft)}>
          <span className={labStyles.facSynthPillIndex}>01</span>
          <span className={labStyles.facSynthPillText}>Index / Directory</span>
        </div>
        <div className={cx(labStyles.facSynthPill, labStyles.facSynthPillTopRight)}>
          <span className={labStyles.facSynthPillIndex}>02</span>
          <span className={labStyles.facSynthPillText}>Synthesis Archive</span>
        </div>
        <div className={cx(labStyles.facSynthPill, labStyles.facSynthPillBottomLeft)}>
          <span className={labStyles.facSynthPillIndex}>MTL</span>
          <span className={labStyles.facSynthPillText}>45.5017° N, 73.5673° W</span>
        </div>
        <div className={cx(labStyles.facSynthPill, labStyles.facSynthPillBottomRight)}>
          <span className={labStyles.facSynthPillIndex}>SYS</span>
          <span className={labStyles.facSynthPillTime} data-time="12:00:00" title="Static time (lab)" />
        </div>
      </nav>

      <div className={labStyles.facSynthMain}>
        <section className={labStyles.facSynthHero} aria-labelledby="fac-synth-hero-title">
          <div className={labStyles.facSynthMetaHeader}>
            <div
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="context"
            >
              XJ92+WF MONTREAL, QC
            </div>
            <div
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="orgNameAccent"
            >
              EST. 2024 / ARCHIVE-V1
            </div>
          </div>

          <h1 id="fac-synth-hero-title" className={labStyles.facSynthMainTitle}>
            <span
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="orgNamePrimary"
            >
              Synthesis
            </span>
          </h1>

          <div className={labStyles.facSynthStrip}>
            <div className={cx(labStyles.facSynthStripCell, labStyles.facSynthStripSpan3)}>
              Discipline / Research
            </div>
            <div className={cx(labStyles.facSynthStripCell, labStyles.facSynthStripSpan3)}>Status / Active</div>
            <div className={cx(labStyles.facSynthStripMission, labStyles.facSynthStripSpan6)}>
              <span
                contentEditable
                spellCheck={false}
                suppressContentEditableWarning
                data-hg-lore-faction-field="subtitle"
              >
                Our mission is to bridge the architectural divide between code and kinetic design. Structure is the
                primary interface.
              </span>
            </div>
          </div>
        </section>

        <section className={labStyles.facSynthArchive} aria-label="Charter and roster">
          <div
            className={labStyles.facSynthDocument}
            contentEditable
            spellCheck={false}
            suppressHydrationWarning
            data-hg-lore-faction-field="document"
            dangerouslySetInnerHTML={{ __html: FACTION_LAB_SYNTH_DOCUMENT_HTML }}
          />

          <FactionLabDemoHgArchRoster variant="synthesis" />
        </section>
      </div>

      <svg
        className={labStyles.facSynthDecoration}
        width="400"
        height="400"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle cx="200" cy="200" r="199.5" stroke="#0033FF" strokeDasharray="2 4" />
        <path d="M200 0V400M0 200H400" stroke="#0033FF" strokeWidth="0.5" />
        <rect x="100" y="100" width="200" height="200" stroke="#0033FF" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

/** Bar widths for Essentialist footer strip (reference HTML pattern). */
const ESSENTIALIST_ID_BAR_STRIP: { w: 1 | 2 | 3 | 4; half?: boolean }[] = [
  { w: 2 },
  { w: 1 },
  { w: 3 },
  { w: 1 },
  { w: 2 },
  { w: 4, half: true },
  { w: 1 },
  { w: 1 },
  { w: 2 },
  { w: 3 },
  { w: 1 },
  { w: 2, half: true },
  { w: 1 },
  { w: 4 },
  { w: 1 },
  { w: 2, half: true },
  { w: 1 },
  { w: 3 },
  { w: 2 },
  { w: 1 },
  { w: 2 },
  { w: 1 },
  { w: 4, half: true },
  { w: 4 },
  { w: 1 },
  { w: 2 },
  { w: 1 },
  { w: 3 },
  { w: 1 },
  { w: 2, half: true },
  { w: 2 },
  { w: 1 },
  { w: 2 },
  { w: 1 },
  { w: 3 },
  { w: 1 },
  { w: 2, half: true },
  { w: 2 },
  { w: 1 },
];

/**
 * XVII · Essentialist Identification Protocol — faction lab: org identity + charter (`document`) + hgArch roster demo.
 * Visual reference: ID badge chrome; semantics match faction PRD (not character credential).
 */
function FactionEssentialistIdV17Body({ testId }: { testId: string }) {
  return (
    <div
      className={labStyles.facEssIdRoot}
      data-testid={testId}
      data-hg-lab-faction-specimen="xvii-essentialist-faction"
    >
      <div className={labStyles.facEssIdEnvGrid} aria-hidden />
      <div className={labStyles.facEssIdScene}>
        <div className={labStyles.facEssIdBadge}>
          <span className={cx(labStyles.facEssIdRegMark, labStyles.facEssIdRegTl)} aria-hidden />
          <span className={cx(labStyles.facEssIdRegMark, labStyles.facEssIdRegTr)} aria-hidden />
          <span className={cx(labStyles.facEssIdRegMark, labStyles.facEssIdRegBl)} aria-hidden />
          <span className={cx(labStyles.facEssIdRegMark, labStyles.facEssIdRegBr)} aria-hidden />
          <span className={cx(labStyles.facEssIdCutCorner, labStyles.facEssIdCutTl)} aria-hidden />
          <span className={cx(labStyles.facEssIdCutCorner, labStyles.facEssIdCutBr)} aria-hidden />

          <div className={labStyles.facEssIdHeader}>
            <div className={labStyles.facEssIdHeaderMeta}>
              <span
                contentEditable
                spellCheck={false}
                suppressContentEditableWarning
                data-hg-lore-faction-field="context"
              >
                FACTION_AUTH_NODE
              </span>
              <span
                contentEditable
                spellCheck={false}
                suppressContentEditableWarning
                data-hg-lore-faction-field="orgNameAccent"
              >
                PARENT: HEARTCORE
              </span>
            </div>
          </div>

          <div className={labStyles.facEssIdBodySection}>
            <div className={labStyles.facEssIdRowIdentity}>
              <div className={labStyles.facEssIdIdentityBlock}>
                <span className={labStyles.facEssIdLabelMicro}>Organization</span>
                <h1
                  className={labStyles.facEssIdNamePrimary}
                  contentEditable
                  spellCheck={false}
                  suppressContentEditableWarning
                  data-hg-lore-faction-field="orgNamePrimary"
                >
                  ESSENTIALIST DIRECTORATE
                </h1>
              </div>
              <div
                className={labStyles.facEssIdClearanceBadge}
                contentEditable
                spellCheck={false}
                suppressContentEditableWarning
                data-hg-lore-faction-field="subtitle"
              >
                CHARTER · OMN-9
              </div>
            </div>

            <div className={labStyles.facEssIdRowData}>
              <div className={labStyles.facEssIdDataCell}>
                <span className={labStyles.facEssIdLabelMicro}>Jurisdiction</span>
                <span className={labStyles.facEssIdDataValue}>Obsidian Reach · Sector 7</span>
              </div>
              <div className={labStyles.facEssIdDataCell}>
                <span className={labStyles.facEssIdLabelMicro}>Registry</span>
                <span className={labStyles.facEssIdDataValue}>FAC-ORD-009</span>
              </div>
            </div>
            <div className={labStyles.facEssIdRowData}>
              <div className={labStyles.facEssIdDataCell}>
                <span className={labStyles.facEssIdLabelMicro}>Standing</span>
                <span className={labStyles.facEssIdDataValue}>ACTIVE</span>
              </div>
              <div className={labStyles.facEssIdDataCell}>
                <span className={labStyles.facEssIdLabelMicro}>Charter cycle</span>
                <span className={labStyles.facEssIdDataValue}>2084.11.04</span>
              </div>
            </div>

            <FactionLabDemoHgArchRoster variant="essentialist" />

            <div
              className={labStyles.facEssIdCharter}
              contentEditable
              spellCheck={false}
              suppressHydrationWarning
              data-hg-lore-faction-field="document"
              dangerouslySetInnerHTML={{ __html: FACTION_LAB_ESSENTIALIST_CHARTER_HTML }}
            />

            <div className={labStyles.facEssIdFooter}>
              <div className={labStyles.facEssIdBarcode} aria-hidden>
                {ESSENTIALIST_ID_BAR_STRIP.map((b, i) => (
                  <span
                    key={i}
                    className={cx(labStyles.facEssIdBar, b.half ? labStyles.facEssIdBarHalf : undefined)}
                    style={{ width: b.w, height: b.half ? "60%" : "100%" }}
                  />
                ))}
              </div>
              <div className={labStyles.facEssIdRegistryLine} aria-hidden>
                FAC&lt;&lt;ESSENTIALIST&lt;&lt;DIR&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * XVIII · Clandestine bureau brief — XII concrete classified base, XI clearance bar, XV grid / striped display;
 * editable `orgNamePrimary`, `orgNameAccent`, `subtitle`, `context`, `document` + hgArch roster demo; CSS only.
 */
function FactionClandestineBriefV18Body({ testId }: { testId: string }) {
  return (
    <div
      className={labStyles.facClandRoot}
      data-testid={testId}
      data-hg-lab-faction-specimen="xviii-clandestine-brief"
    >
      <div className={labStyles.facAeonProtoAura} aria-hidden />
      <div className={labStyles.facAeonProtoGrain} aria-hidden />
      <div className={labStyles.facClandGridBg} aria-hidden />

      <div className={labStyles.facClandInner}>
        <header className={labStyles.facClandClassifiedBar}>
          <div className={labStyles.facClandClassifiedLeft}>
            <span className={labStyles.facClandStatusDot} aria-hidden />
            <span>Classified · level 8 clearance only</span>
          </div>
          <div className={labStyles.facClandClassifiedRight}>TS-BU-661.18 · 09:14:00</div>
        </header>

        <div className={labStyles.facClandDocShell}>
          <span className={labStyles.facAeonProtoChTL} aria-hidden />
          <span className={labStyles.facAeonProtoChTR} aria-hidden />
          <span className={labStyles.facAeonProtoChBL} aria-hidden />
          <span className={labStyles.facAeonProtoChBR} aria-hidden />

          <div className={labStyles.facAeonProtoTop}>
            <div className={labStyles.facAeonProtoStampLeft}>
              <span className={labStyles.facAeonProtoSlashed}>18.04.2026</span>
              <span>INDEX_0189</span>
              <span className={labStyles.facAeonProtoIndexNum} aria-hidden>
                18
              </span>
            </div>
            <div className={labStyles.facAeonProtoHeaderRight}>
              <span>18APR&apos;26</span>
              <span>ORD—BUREAU</span>
              <span>
                LEVEL—<span className={labStyles.facAeonProtoSlashed}>0</span>8
              </span>
              <span>ANNEX</span>
            </div>
          </div>

          <div className={labStyles.facClandTitleBlock}>
            <div
              className={labStyles.facClandStripedLg}
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="orgNamePrimary"
            >
              AEON
            </div>
            <div
              className={labStyles.facClandStripedSm}
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="orgNameAccent"
            >
              Registry annex
            </div>
          </div>

          <h2 className={labStyles.facAeonProtoSubject}>
            <span className={labStyles.facAeonProtoSubjectDot} aria-hidden />
            <span
              className={labStyles.facClandSubjectText}
              contentEditable
              spellCheck={false}
              suppressContentEditableWarning
              data-hg-lore-faction-field="subtitle"
            >
              Subject: internal circulation file Ø-18
            </span>
          </h2>

          <div className={labStyles.facClandJurisdictionRow}>
            <div className={labStyles.facClandJurisdictionInner}>
              <div className={labStyles.facClandJurisdictionK}>jurisdiction</div>
              <div
                className={labStyles.facClandJurisdictionVal}
                contentEditable
                spellCheck={false}
                suppressContentEditableWarning
                data-hg-lore-faction-field="context"
              >
                Obsidian Reach · sector registry
              </div>
            </div>
            <span className={labStyles.facClandAuthStamp}>authorized</span>
          </div>

          <div
            className={labStyles.facClandDocument}
            contentEditable
            spellCheck={false}
            suppressHydrationWarning
            data-hg-lore-faction-field="document"
            dangerouslySetInnerHTML={{ __html: FACTION_LAB_CLANDESTINE_DOCUMENT_HTML }}
          />

          <FactionLabDemoHgArchRoster variant="clandestine" />

          <div className={labStyles.facAeonProtoBottom}>
            <div className={labStyles.facAeonProtoStampBox}>Eyes only · internal circulation</div>
            <p className={labStyles.facAeonProtoRegistry}>
              Bureau of annex filings · Girona branch · unit 18
              <br />
              Clerk of record · classified docket
            </p>
          </div>

          <div className={labStyles.facAeonProtoCta} role="presentation">
            Route to archive clerk
          </div>
        </div>
      </div>
    </div>
  );
}

/** XII · AEON Protocol classified — concrete field, red/mint aura, grain; legible 340px sheet (static; no pointer FX). */
function FactionAeonProtocolClassifiedBody({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facAeonProtoRoot} data-testid={testId}>
      <div className={labStyles.facAeonProtoAura} aria-hidden />
      <div className={labStyles.facAeonProtoGrain} aria-hidden />
      <div className={labStyles.facAeonProtoDoc}>
        <span className={labStyles.facAeonProtoChTL} aria-hidden />
        <span className={labStyles.facAeonProtoChTR} aria-hidden />
        <span className={labStyles.facAeonProtoChBL} aria-hidden />
        <span className={labStyles.facAeonProtoChBR} aria-hidden />

        <div className={labStyles.facAeonProtoTop}>
          <div className={labStyles.facAeonProtoStampLeft}>
            <span className={labStyles.facAeonProtoSlashed}>28.02.2025</span>
            <span>INDEX_0089</span>
            <span className={labStyles.facAeonProtoIndexNum} aria-hidden>
              09
            </span>
          </div>
          <div className={labStyles.facAeonProtoHeaderRight}>
            <span>28FEB&apos;25</span>
            <span>ORD—AEON</span>
            <span>
              LEVEL—<span className={labStyles.facAeonProtoSlashed}>0</span>7
            </span>
            <span>ARCHIVE</span>
          </div>
        </div>

        <h2 className={labStyles.facAeonProtoSubject}>
          <span className={labStyles.facAeonProtoSubjectDot} aria-hidden />
          Subject: initiation of protocol Ø-9
        </h2>

        <div className={labStyles.facAeonProtoBody}>
          <p>
            Manifestation began at <span className={labStyles.facAeonProtoRedact}>14:22 HRS</span> in the primary
            sanctum. Observers noted atmospheric shift and{" "}
            <span className={labStyles.facAeonProtoRedact}>spectral resonance</span> beyond nominal thresholds.
          </p>
          <p>
            Maintain silence until final sync — scrub auditory data per Aeon Protocol. Do not fix on the{" "}
            <span className={labStyles.facAeonProtoRedact}>bleeding light</span>. Geometry is no longer Euclidean;
            Obsidian Reach observers only.
          </p>
        </div>

        <div className={labStyles.facAeonProtoGrid}>
          <div className={labStyles.facAeonProtoCell}>
            <span className={labStyles.facAeonProtoLabel}>Coordinates</span>
            <span className={labStyles.facAeonProtoVal}>41.9794° N, 2.8214° E</span>
          </div>
          <div className={labStyles.facAeonProtoCell}>
            <span className={labStyles.facAeonProtoLabel}>Stability</span>
            <span className={labStyles.facAeonProtoVal}>Critical / 0.4%</span>
          </div>
          <div className={labStyles.facAeonProtoCell}>
            <span className={labStyles.facAeonProtoLabel}>Vessel ID</span>
            <span className={labStyles.facAeonProtoVal}>ARKADE—7</span>
          </div>
          <div className={labStyles.facAeonProtoCell}>
            <span className={labStyles.facAeonProtoLabel}>Signature</span>
            <span className={labStyles.facAeonProtoValItalic}>Verified.</span>
          </div>
        </div>

        <div className={labStyles.facAeonProtoBottom}>
          <div className={labStyles.facAeonProtoStampBox}>Eyes only · top secret</div>
          <p className={labStyles.facAeonProtoRegistry}>
            AEON order · Girona branch · unit 9
            <br />
            Director · Ramón Folch · classified registry
          </p>
        </div>

        <div className={labStyles.facAeonProtoCta} role="presentation">
          Initiate scrub sequence
        </div>
      </div>
    </div>
  );
}

/** Shared shelf catalog body — canvas-style expand lives in `ArchitecturalNodeHeader`. */
function FactionShelfCardBody({ testId }: { testId: string }) {
  return (
    <div className={labStyles.facShelfRoot} data-testid={testId}>
      <div className={labStyles.facShelfTitle}>Ironwood Mercantile Exchange</div>
      <div className={labStyles.facShelfLine}>
        <span className={labStyles.facShelfKey}>Jurisdiction</span>
        <span className={labStyles.facShelfDots} aria-hidden />
        <span className={labStyles.facShelfVal}>Obsidian Reach</span>
      </div>
      <div className={labStyles.facShelfLine}>
        <span className={labStyles.facShelfKey}>Class</span>
        <span className={labStyles.facShelfDots} aria-hidden />
        <span className={labStyles.facShelfVal}>Faction · charter registry</span>
      </div>
      <div className={labStyles.facShelfLine}>
        <span className={labStyles.facShelfKey}>Cross-ref</span>
        <span className={labStyles.facShelfDots} aria-hidden />
        <span className={labStyles.facShelfVal}>RG-EMB · harbor tariff</span>
      </div>
      <div className={labStyles.facShelfStamp}>CATALOG · NON-CIRC</div>
    </div>
  );
}

/** Canvas-style shell without tape or header — production character v11 body. */
function LabSkeuoCard({
  className,
  html,
}: {
  className?: string;
  html: string;
}) {
  const [bodyAfterUpload, setBodyAfterUpload] = useState(html);
  const rootRef = useRef<HTMLDivElement>(null);
  const labBodyRef = useRef<HTMLDivElement>(null);
  const portraitFileRef = useRef<HTMLInputElement>(null);

  const portraitCommittedClass = cardStyles.charSkPortraitImg;

  const onPortraitFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const alt =
          file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Portrait";
        setBodyAfterUpload((prev) =>
          applyImageDataUrlToArchitecturalMediaBody(prev, dataUrl, alt, portraitCommittedClass, {
            uploadButtonClass: canvasStyles.mediaUploadBtn,
          }),
        );
      };
      reader.readAsDataURL(file);
    },
    [portraitCommittedClass],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stopCaretDrift = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest("[data-architectural-media-upload]");
      if (t && root.contains(t)) e.preventDefault();
    };
    const onUploadClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest("[data-architectural-media-upload]");
      if (!t || !root.contains(t)) return;
      e.preventDefault();
      e.stopPropagation();
      portraitFileRef.current?.click();
    };
    root.addEventListener("mousedown", stopCaretDrift, true);
    root.addEventListener("click", onUploadClick, true);
    return () => {
      root.removeEventListener("mousedown", stopCaretDrift, true);
      root.removeEventListener("click", onUploadClick, true);
    };
  }, [bodyAfterUpload]);

  const displayHtml = bodyAfterUpload;

  useLayoutEffect(() => {
    const body = labBodyRef.current;
    if (body) applySpellcheckToNestedEditables(body, false);
    syncCharSkDisplayNameStack(rootRef.current);
    syncLoreV9RedactedPlaceholderState(rootRef.current);
  }, [displayHtml]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const removeGuards = installLorePlaceholderSelectionGuards(root);
    const removePhCaret = installLoreV11PlaceholderCaretSync(root);
    const onInput = () => {
      syncLoreV9RedactedPlaceholderState(root);
    };
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent;
      const field = (ie.target as HTMLElement | null)?.closest?.("[data-hg-lore-field]");
      if (!field || !(field instanceof HTMLElement)) return;
      if (!consumeLorePlaceholderBeforeInput(field, ie)) return;
      syncCharSkDisplayNameStack(root);
      syncLoreV9RedactedPlaceholderState(root);
      queueMicrotask(() => {
        if (field.isConnected) placeCaretAfterLorePlaceholderReplace(field);
      });
    };
    const onFocusOut = (e: FocusEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.(
        '[class*="charSkDisplayName"][data-hg-lore-field]',
      );
      if (!t || !root.contains(t)) return;
      queueMicrotask(() => {
        syncCharSkDisplayNameStack(root);
        syncLoreV9RedactedPlaceholderState(root);
      });
    };
    root.addEventListener("beforeinput", onBeforeInput, true);
    root.addEventListener("input", onInput, true);
    root.addEventListener("focusout", onFocusOut);
    return () => {
      removeGuards();
      removePhCaret();
      root.removeEventListener("beforeinput", onBeforeInput, true);
      root.removeEventListener("input", onInput, true);
      root.removeEventListener("focusout", onFocusOut);
    };
  }, [displayHtml]);

  return (
    <div
      ref={rootRef}
      className={cx(canvasStyles.entityNode, canvasStyles.loreCharacterCanvasRoot, className)}
      data-hg-canvas-role="lore-character-v11"
      data-lore-kind="character"
      data-lore-variant="v11"
      style={
        {
          width: 340,
          "--entity-width": "340px",
          boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
        } as CSSProperties
      }
    >
      <input
        ref={portraitFileRef}
        type="file"
        accept="image/*"
        className={labStyles.visuallyHidden}
        aria-hidden
        tabIndex={-1}
        onChange={onPortraitFile}
      />
      {/* Lab-only static HTML; uses canvas `nodeBody` + `loreCharacterBody` (same as production character v11). */}
      <div
        ref={labBodyRef}
        className={cx(canvasStyles.nodeBody, canvasStyles.loreCharacterBody, labStyles.labSkeuoBleed)}
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
    </div>
  );
}

function useLabImagePick() {
  const inputRef = useRef<HTMLInputElement>(null);
  const onFile = useCallback((event: ChangeEvent<HTMLInputElement>, onDataUrl: (url: string) => void) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => onDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }, []);
  return { inputRef, onFile };
}

/** Lab-only: V3 survey tag; optional hero image shows the image-swap path. */
function LabLocationV3SurveyTagPreview() {
  const [hero, setHero] = useState<string | null>(null);
  const { inputRef, onFile } = useLabImagePick();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={labStyles.visuallyHidden}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => onFile(e, setHero)}
      />
      <LabCard headerTitle="Location" tapeVariant="dark" tapeRotation={0.8}>
        <div
          data-hg-canvas-role="lore-location"
          data-hg-lore-location-variant="v3"
          className={labStyles.locSurveyV3Shell}
          data-testid="loc-survey-v3"
        >
          {hero ? (
            <>
              <div
                className={labStyles.locSurveyV3HeroPhoto}
                style={{ backgroundImage: `url(${JSON.stringify(hero)})` } as CSSProperties}
                aria-hidden
              />
              <div className={labStyles.locSurveyV3HeroScrim} aria-hidden />
            </>
          ) : null}
          <div className={labStyles.locSurveyV3Foreground}>
            <div
              className={cardStyles.locPlaqueStrip}
              data-loc-strip={locationStripVariantFromSeed("lab-survey-tag-v3")}
              aria-hidden
            />
            <div
              className={cardStyles.plaqueCorner}
              data-hg-lore-location-field="ref"
              contentEditable={false}
            >
              REF · KFC-DOCK-0847
            </div>
            <div
              className={cx(cardStyles.locHeader, hero ? labStyles.locSurveyV3HeaderOnHero : undefined)}
              contentEditable={false}
            >
              <div
                className={cardStyles.locName}
                data-hg-lore-location-field="name"
                contentEditable={false}
              >
                Old Harbor Kiln No. 4
              </div>
              <div
                className={cardStyles.locMetaLine}
                data-hg-lore-location-optional="true"
                contentEditable={false}
              >
                <span className={cardStyles.locMetaKey}>Nation</span>
                <span data-hg-lore-location-field="context" contentEditable={false}>
                  Kestrel Free City
                </span>
              </div>
              <div
                className={cardStyles.locMetaLine}
                data-hg-lore-location-optional="true"
                contentEditable={false}
              >
                <span className={cardStyles.locMetaKey}>Kind</span>
                <span data-hg-lore-location-field="detail" contentEditable={false}>
                  Warehouse · abandoned ceramic works
                </span>
              </div>
            </div>
            <div
              className={cardStyles.notesBlock}
              data-hg-lore-location-notes-cell="true"
              contentEditable={false}
            >
              <span className={cardStyles.fieldLabel}>Notes</span>
              <div
                className={cardStyles.notesText}
                data-hg-lore-location-notes="true"
                contentEditable={false}
              >
                <p>
                  Thin strip color is stable per item id via <code>data-loc-strip</code> + seed hash; the{" "}
                  <code>ref</code> field is an optional monospace stamp for GMs. Use the buttons under the card to try
                  a hero image: same layering a future cover URL would use (photo, scrim, then type).
                </p>
              </div>
            </div>
          </div>
        </div>
      </LabCard>
      <div className={labStyles.locSurveyV3Chrome}>
        <Button type="button" size="sm" variant="neutral" tone="glass" onClick={() => inputRef.current?.click()}>
          {hero ? "Replace hero image" : "Add hero image"}
        </Button>
        {hero ? (
          <Button type="button" size="sm" variant="neutral" tone="glass" onClick={() => setHero(null)}>
            Clear hero
          </Button>
        ) : null}
      </div>
    </>
  );
}

function ThemeToolbar() {
  const { preference, setPreference } = useVigilThemeContext();
  return (
    <div className={labStyles.themeRow} role="group" aria-label="Color scheme">
      <span className={labStyles.themeLabel}>Theme</span>
      {(["light", "dark", "system"] as const).map((key) => (
        <Button
          key={key}
          type="button"
          size="sm"
          variant="neutral"
          tone="glass"
          isActive={preference === key}
          className={labStyles.themeBtn}
          onClick={() => setPreference(key)}
        >
          {key}
        </Button>
      ))}
    </div>
  );
}

function LoreEntityNodeLabInner() {
  return (
    <div className={labStyles.page}>
      <header className={labStyles.topBar}>
        <div className={labStyles.titleBlock}>
          <h1>Lore entity nodes</h1>
          <p>
            Design lab: character ID plate (same v11 seed as the canvas), faction letterhead, and
            location site cards. Same node shell as production; bodies mirror seeded HTML templates.
          </p>
        </div>
        <ThemeToolbar />
      </header>

      <div className={labStyles.sections}>
        <section aria-labelledby="sec-character">
          <h2 id="sec-character" className={labStyles.sectionTitle}>
            Character
          </h2>
          <p className={labStyles.sectionHint}>
            Production template: <code>loreCard: {"{"} kind: &quot;character&quot;, variant: &quot;v11&quot; {"}"}</code>
            , seeded from <code>getLoreNodeSeedBodyHtml</code>. No canvas tape on character nodes; portrait uses the
            same media-root + Upload path as image entities.
          </p>
          <div className={labStyles.grid}>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>Character · v11 ID plate</span>
              <LabSkeuoCard html={getLoreNodeSeedBodyHtml("character", "v11")} />
              <ul className={labStyles.spec}>
                <li>
                  <code>charSkShellV11</code> guest-check placeholders (<code>data-hg-lore-ph</code> + marker strokes).
                  Affiliation and nationality stay inline until structured fields land.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="sec-faction">
          <h2 id="sec-faction" className={labStyles.sectionTitle}>
            Faction · org · company
          </h2>
          <p className={labStyles.sectionHint}>
            <strong>Priming (specimen 0):</strong> <code>hgArch.{FACTION_ROSTER_HG_ARCH_KEY}</code> from{" "}
            <code>faction-roster-schema.ts</code> — lab-only; production faction letterhead seeds are unchanged. Then{" "}
            <strong>I–XX:</strong> twenty <code>FactionLabPlate</code> specimens — no canvas <code>LabCard</code> stack
            (no tape, no <code>a4DocumentBody</code>). I–III: dead-drop slip, summit stub, interoffice memo. IV–V: same
            rosy shelf
            catalog; V adds left-edge <code>mask-image</code> perforation + dashed border only. VI: ORDO LUNARIS
            compact (system-sized). VII: full ORDO protocol sheet. VIII: Silent Synod classified sheet. IX: Archive-091
            void document (dark field, rails, letterhead + protocol, metrics table; CSS grain only). X: Lattice induction
            (white protocol sheet, mono meta tags, data grid, static split footer; CSS scanlines; no external images).
            XI: AEON Conclave terminal (pale field, crimson accent; classified header, letterhead, meta rail + body;
            static figure orbs; no live clock / pointer motion). XII: AEON Protocol classified (concrete field, red/mint
            aura, noise grain, crosshairs, 2×2 data grid; all static — no scrub invert / pointer parallax). XIII: Protocol
            Indigo Bloom (midnight cobalt; EB Garamond + Space Mono; editable org + directive + jurisdiction + document;
            static seal, rail, footer; CSS-only atmosphere — no pointer / star-field JS). XIV: Terminal fleet (minimal black
            mono: host / env / directive + charter + roster demo only — no telemetry chrome). XV: Ocular Mandate (grid
            dossier, Inter striped display type, Space Mono body, evidence placeholder, personnel index + hgArch roster demo —
            no images / pointer JS). XVI: Synthesis Archive (pale blue field, Playfair hero, glass corner pills, mission strip +
            ledger roster from hgArch — no live clock / pointer motion). XVII: Essentialist ID (faction org + charter + roster
            demo, ID-badge chrome; CSS-only glare — no pointer 3D tilt). XVIII: Clandestine bureau brief (XII concrete +
            classified aura; XI clearance bar; XV grid, striped display, authorized stamp; editable PRD fields + hgArch
            roster — no images / pointer JS). XIX: Ocular Mandate light (XV dossier on pale grid field, no protocol rail,
            single-line Inter title on <code>orgNamePrimary</code> only, Space Mono body + roster — no images / pointer JS).
            XX: Archive-091 readable (IX void archive, larger type + blue frame, slim plate header + focus affordance, editable PRD
            fields, roster replaces fiction metrics table, no ritual CTA / serial footer — no canvas / pointer JS).
          </p>
          <div className={labStyles.grid}>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>0 · Faction roster (data model priming)</span>
              <FactionLabPlate plateKind="rosterPriming">
                <FactionRosterPrimingBody testId="fac-lab-roster-priming" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Structured roster: <code>DEMO_FACTION_ROSTER</code> → <code>parseFactionRoster</code> (
                  <code>FACTION_LORE_ENTITY_CHECKLIST.md</code> for integration parity).
                </li>
                <li>
                  Placeholder field markers: <code>data-hg-lore-faction-field</code>,{" "}
                  <code>data-hg-lore-faction-roster</code> — align with character/location{" "}
                  <code>data-hg-lore-*</code> when layout locks.
                </li>
              </ul>
            </div>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>I · Dead-drop slip</span>
              <FactionLabPlate plateKind="slip">
                <div className={labStyles.facSlipEdge} aria-hidden>
                  WORKING
                </div>
                <div className={labStyles.facSlipMain} data-testid="fac-sheet-docket">
                  <div className={labStyles.facSlipHoles} aria-hidden>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className={labStyles.facSlipMeta}>
                    <span>LOT 7 · ORG-7741</span>
                    <span className={labStyles.facSlipHot}>OPEN CHANNEL</span>
                  </div>
                  <div className={labStyles.facSlipOrg}>Ironwood Mercantile Exchange</div>
                  <div className={labStyles.facSlipNation}>Obsidian Reach</div>
                  <ul className={labStyles.facSlipTeletype}>
                    <li>Clear customs window · 48h</li>
                    <li>East docks liaison only</li>
                    <li>No ledger signatures until seal</li>
                  </ul>
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Vertical margin + binder holes + teletype lines — payload is procedural lines, not a document block.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>II · Summit stub</span>
              <FactionLabPlate plateKind="stub">
                <div className={labStyles.facStubRoot} data-testid="fac-sheet-buff">
                  <div className={labStyles.facStubEyebrow}>Charter summit · admit</div>
                  <div className={labStyles.facStubOrg}>Ironwood Mercantile Exchange</div>
                  <div className={labStyles.facStubNation}>Obsidian Reach</div>
                  <div className={labStyles.facStubPerf} aria-hidden />
                  <div className={labStyles.facStubAgenda}>
                    <div className={labStyles.facStubAgendaTitle}>Floor</div>
                    <ul>
                      <li>Quorum &amp; customs carve-out</li>
                      <li>Harbor tariff pilot vote</li>
                      <li>Adjourn · sealed minutes</li>
                    </ul>
                  </div>
                  <div className={labStyles.facStubTear}>
                    <span className={labStyles.facStubTearCode}>ADM-09-K</span>
                    <span className={labStyles.facStubTearHint}>tear along perf</span>
                  </div>
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>Ticket IA: eyebrow, agenda list, perforated tear row with stub code — not a document lane.</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>III · Interoffice memo</span>
              <FactionLabPlate plateKind="iomemo">
                <div className={labStyles.facMemoRoot} data-testid="fac-lab-iomemo">
                  <div className={labStyles.facMemoMark}>Memorandum</div>
                  <div className={labStyles.facMemoField}>
                    <span className={labStyles.facMemoLabel}>To</span>
                    <span className={labStyles.facMemoVal}>Obsidian Reach · charter window</span>
                  </div>
                  <div className={labStyles.facMemoField}>
                    <span className={labStyles.facMemoLabel}>From</span>
                    <span className={labStyles.facMemoVal}>Ironwood Mercantile Exchange</span>
                  </div>
                  <div className={labStyles.facMemoField}>
                    <span className={labStyles.facMemoLabel}>Re</span>
                    <span className={labStyles.facMemoVal}>Harbor tariff pilot · customs carve-out</span>
                  </div>
                  <div className={labStyles.facMemoRule} aria-hidden />
                  <p className={labStyles.facMemoNote}>
                    Distribution: HG registry clerk · file duplicate under ORG-7741. Verbal commitments non-binding.
                  </p>
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Memo routing: TO / FROM / RE with ruled field lines — not a summit stub, not perforation or tear copy.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>IV · Shelf · rosy gradient</span>
              <FactionLabPlate plateKind="shelfcard">
                <ArchitecturalNodeHeader
                  title="Faction"
                  expandLabel="Focus Mode"
                  onExpand={() => {}}
                  buttonTone="card-light"
                  compact
                />
                <FactionShelfCardBody testId="fac-lab-shelfcard" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Summit-stub family: deeper <code>accent</code> gradient on the card face — dot-leader catalog IA with
                  compact document header (no edge mask).
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V · Shelf · sleeve perforation</span>
              <FactionLabPlate plateKind="shelfcardSleeve">
                <div className={labStyles.facShelfSleeveStack}>
                  <ArchitecturalNodeHeader
                    title="Faction"
                    expandLabel="Focus Mode"
                    onExpand={() => {}}
                    buttonTone="card-light"
                    compact
                  />
                  <FactionShelfCardBody testId="fac-lab-shelfcard-sleeve" />
                </div>
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Same rosy gradient as IV; dashed border on the shell. Holes: <code>mask-image</code> on the outer{" "}
                  <code>factionLabPlate_shelfcardSleeve</code> (full paint + gradient) so notches read against the lab
                  page; <code>facShelfSleeveStack</code> is layout-only; vertical padding + <code>mask-clip</code>:{" "}
                  content-box insets the repeat.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>VI · Protocol · ORDO LUNARIS · compact</span>
              <FactionLabPlate plateKind="protocolOrdoCompact">
                <FactionProtocolOrdoCompactBody testId="fac-lab-protocol-ordo-compact" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Same warm concrete + coral chrome as VII, scaled for the node width: single decree, one-line meta,
                  short footer; type sized for legibility on 340px (mono meta ~8px, body ~10.5px) — no scroll.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>VII · Protocol · ORDO LUNARIS</span>
              <FactionLabPlate plateKind="protocolOrdo">
                <FactionProtocolOrdoBody testId="fac-lab-protocol-ordo" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Full protocol layout (decrees I–II, margin boxes, footer strip); static multiply glow; no pointer
                  tracking. Plate uses overflow hidden — no internal scrollbars.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>VIII · Classified · Silent Synod</span>
              <FactionLabPlate plateKind="protocolSynod">
                <FactionSilentSynodBody testId="fac-lab-protocol-synod" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Legible brief: cream field + blood accent; large title + ref column, lead line, two fact cells,
                  standing order, footer + OMEGA stamp. Denser dossier / sigil / pillar list removed so type stays
                  readable on 340px.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>IX · Archive · 091 internal</span>
              <FactionLabPlate plateKind="protocolArchive091">
                <FactionArchive091Body testId="fac-lab-protocol-archive-091" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Dark void archive: side rails + star sigils, meta strip with blink, Playfair letterhead, protocol +
                  metrics table, pill tags, ritual line (non-interactive). Arch centerpiece removed for vertical space.
                  CSS noise grain; no canvas / pointer parallax.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>X · Protocol · Lattice induction</span>
              <FactionLabPlate plateKind="protocolLattice">
                <FactionLatticeInductionBody testId="fac-lab-protocol-lattice" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Legible notice: masthead + ~11px body, row-based stats (no micro three-up grid), one obligation line,
                  taller footer copy (~8px mono). Lighter scanlines; avatar + coord strip omitted for space.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>XI · Terminal · AEON Conclave</span>
              <FactionLabPlate plateKind="protocolAeonConclave">
                <FactionAeonConclaveBody testId="fac-lab-protocol-aeon-conclave" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Reference: TERMINAL // AEON-9 — pale field, ink + crimson accent, Geist Mono rails; classified header,
                  stacked letterhead, sticky-style meta column + numbered paragraphs, static black insert with concentric
                  orbs (no animation / no pointer FX), signature + seal. Floating action omitted; type scaled for 340px
                  legibility.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>XII · Protocol · AEON classified</span>
              <FactionLabPlate plateKind="protocolAeonProtocol">
                <FactionAeonProtocolClassifiedBody testId="fac-lab-protocol-aeon-protocol" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Reference: THE AEON PROTOCOL // CLASSIFIED — warm concrete, red + mint aura, SVG grain overlay,
                  corner crosshairs, index + header stack, subject rule with marker, ~11px body, legible 2×2 grid, stamp +
                  registry, static CTA strip (no invert / no hover redact).
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>XIII · Protocol · Indigo Bloom</span>
              <FactionLabPlate plateKind="protocolIndigoBloom">
                <FactionIndigoBloomV13Body testId="fac-lab-protocol-indigo-bloom-xiii" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Reference: Symphony of Anemone — midnight / cobalt / orange; vertical meta rail; static seal + section
                  divider + footer; <strong>editable</strong> body fields: <code>orgNamePrimary</code>,{" "}
                  <code>orgNameAccent</code>, <code>subtitle</code>, <code>context</code>, <code>document</code> (charter
                  prose). <strong>Structured roster</strong> (read-only demo): <code>parseFactionRoster(DEMO_FACTION_ROSTER)</code>{" "}
                  → same rows as <code>hgArch.{FACTION_ROSTER_HG_ARCH_KEY}</code> in{" "}
                  <code>faction-roster-schema.ts</code>. No cursor-follower / star JS.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>XIV · Terminal · Fleet charter</span>
              <FactionLabPlate plateKind="protocolTerminalFleet">
                <FactionTerminalFleetV14Body testId="fac-lab-protocol-terminal-fleet-xiv" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Stripped mono plate: <strong>editable</strong> <code>orgNamePrimary</code>, <code>context</code>,{" "}
                  <code>subtitle</code>, <code>document</code> + read-only <strong>stacked roster cards</strong> from{" "}
                  <code>DEMO_FACTION_ROSTER</code> (<code>hgArch.{FACTION_ROSTER_HG_ARCH_KEY}</code>). No signal strip, meta
                  rail, charter/buffer chrome, or cmd footer.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>XV · Ocular · Mandate dossier</span>
              <FactionLabPlate plateKind="protocolOcularMandate">
                <FactionOcularMandateV15Body testId="fac-lab-protocol-ocular-mandate-xv" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Reference: THE OCULAR MANDATE — dark grid, vertical protocol rail, Inter <strong>striped</strong> display
                  lines + Space Mono fields. <strong>Editable</strong> <code>context</code>, <code>orgNamePrimary</code>,{" "}
                  <code>orgNameAccent</code>, <code>subtitle</code>, <code>document</code>; static evidence frame; roster
                  via <code>variant=&quot;ocular&quot;</code> + <code>hgArch.{FACTION_ROSTER_HG_ARCH_KEY}</code>. No Unsplash, no
                  mouse/interval JS.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>XVI · Synthesis · Archive ledger</span>
              <FactionLabPlate plateKind="protocolSynthesisArchive">
                <FactionSynthesisArchiveV16Body testId="fac-lab-protocol-synthesis-archive-xvi" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Reference: SYNTHESIS / ARCHIVE-01 — warm gray field, electric blue type, glass pills (hover invert +
                  scale), Playfair display title, JetBrains meta, <strong>12-column</strong> sub-strip (3 + 3 + 6, mission
                  right-aligned), SVG target watermark (opacity 0.1). <strong>Editable</strong> <code>context</code>,{" "}
                  <code>orgNameAccent</code> (meta right), <code>orgNamePrimary</code>, <code>subtitle</code> (mission),{" "}
                  <code>document</code>; roster ledger <code>variant=&quot;synthesis&quot;</code> +{" "}
                  <code>hgArch.{FACTION_ROSTER_HG_ARCH_KEY}</code>. SYS time via <code>data-time</code> + CSS (static); no{" "}
                  <code>setInterval</code> / pointer parallax. Container queries stack strip/ledger on narrow plate.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>XVII · Essentialist · Identification protocol</span>
              <FactionLabPlate plateKind="protocolEssentialistId">
                <FactionEssentialistIdV17Body testId="fac-lab-protocol-essentialist-id-xvii" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Reference: Essentialist Identification Protocol — same <strong>faction</strong> shape as other plates:{" "}
                  <strong>editable</strong> <code>context</code>, <code>orgNameAccent</code>, <code>orgNamePrimary</code>,{" "}
                  <code>subtitle</code> (charter class), <code>document</code> (charter prose); read-only jurisdiction grid
                  (demo); <code>variant=&quot;essentialist&quot;</code> roster from <code>hgArch.{FACTION_ROSTER_HG_ARCH_KEY}</code>;
                  decorative seal void + barcode + registry line. CSS glare only — no pointer 3D tilt.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>XVIII · Bureau · Clandestine circulation brief</span>
              <FactionLabPlate plateKind="protocolClandestineBrief">
                <FactionClandestineBriefV18Body testId="fac-lab-protocol-clandestine-brief-xviii" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Merge of XII (concrete classified sheet, aura, grain, crosshairs, index stack, subject marker, stamp +
                  registry, CTA strip), XI (clearance bar + status dot), and XV (grid field, Inter-style striped display
                  type, authorized capsule). <strong>Editable</strong> <code>orgNamePrimary</code>,{" "}
                  <code>orgNameAccent</code>, <code>subtitle</code>, <code>context</code>, <code>document</code>; roster via{" "}
                  <code>variant=&quot;clandestine&quot;</code> + <code>hgArch.{FACTION_ROSTER_HG_ARCH_KEY}</code>. Light mode
                  only; CSS-only — no live clock / pointer JS.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>XIX · Ocular · Mandate dossier (light)</span>
              <FactionLabPlate plateKind="protocolOcularMandateLight">
                <FactionOcularMandateLightV19Body testId="fac-lab-protocol-ocular-mandate-light-xix" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Light counterpart to XV: same dossier stack (jurisdiction, authorized stamp, directive, charter, evidence
                  frame, footer slug) without the vertical protocol rail. Title is one Inter line on{" "}
                  <code>orgNamePrimary</code> only (fold <code>orgNameAccent</code> into that string in production if both
                  exist). <strong>Editable</strong> <code>context</code>, <code>subtitle</code>, <code>document</code>; roster{" "}
                  <code>variant=&quot;ocularLight&quot;</code> + <code>hgArch.{FACTION_ROSTER_HG_ARCH_KEY}</code>. CSS-only.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>XX · Archive · 091 internal (readable)</span>
              <FactionLabPlate plateKind="protocolArchive091Readable">
                <FactionArchive091ReadableV20Body testId="fac-lab-protocol-archive-091-readable-xx" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Readable successor to IX: left rail only (IX had both sides), grain, letterhead, protocol sections — larger type, blue-tinted
                  frame, slim mono plate header + focus icon (lab-native, not canvas{" "}
                  <code>nodeHeader</code>). No serial/registry footer.{" "}
                  <strong>Editable</strong> <code>orgNamePrimary</code>, <code>orgNameAccent</code> (letterhead uses same
                  v11 guest-check markers as character cards: <code>charSkShellV11</code> + <code>charSkDisplayName</code> /{" "}
                  <code>charSkRole</code>), <code>document</code> (no separate <code>context</code> strip in lab — fold
                  registry copy into <code>document</code> or another field in production if needed).
                  Fiction metrics table replaced by an interactive <code>hgArch.{FACTION_ROSTER_HG_ARCH_KEY}</code> roster
                  (add unlinked rows, edit label/role, remove). Linked character rows still carry <code>characterItemId</code>{" "}
                  in data; no item picker in lab yet. Lab state only. CSS grain only.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section aria-labelledby="sec-location">
          <h2 id="sec-location" className={labStyles.sectionTitle}>
            Location
          </h2>
          <p className={labStyles.sectionHint}>
            Same <code>bodyHtml</code> contract as seeded canvas nodes:{" "}
            <code>data-hg-canvas-role=&quot;lore-location&quot;</code> +{" "}
            <code>data-hg-lore-location-variant</code>, fields <code>name</code> / <code>context</code> /{" "}
            <code>detail</code>, optional <code>ref</code> on v3, and notes in{" "}
            <code>data-hg-lore-location-notes-cell</code>. Previews use sample copy; production seeds live in{" "}
            <code>getLoreNodeSeedBodyHtml(&quot;location&quot;, …)</code>.{" "}
            V4 is a lab-only grayscale ORDO coordinate slab (<code>protocolOrdoCompactMono</code>) — static specimen. V5
            is a dense field-mapped slab (extra header + stamp fiction). V6 is lean with legacy rich HTML in one surface;
            V7 matches that layout but uses <code>HeartgardenDocEditor</code> (hgDoc) for <strong>notes</strong> only.
            Vector search still indexes whatever lands in <code>items.contentText</code> (see{" "}
            <code>buildVaultEmbedDocument</code> in <code>vault-chunk.ts</code>), not separate LAT/ELV/etc. columns.
          </p>
          <div className={labStyles.grid}>
            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V2 · Postcard band</span>
              <LabCard headerTitle="Location" tapeVariant="clear" tapeRotation={-2}>
                <div data-hg-canvas-role="lore-location" data-hg-lore-location-variant="v2">
                  <div className={cardStyles.postcardBand} aria-hidden />
                  <div className={cardStyles.locHeader} contentEditable={false}>
                    <div
                      className={cardStyles.locName}
                      data-hg-lore-location-field="name"
                      contentEditable={false}
                    >
                      Old Harbor Kiln No. 4
                    </div>
                    <div
                      className={cardStyles.locMetaLine}
                      data-hg-lore-location-optional="true"
                      contentEditable={false}
                    >
                      <span data-hg-lore-location-field="context" contentEditable={false}>
                        Kestrel Free City
                      </span>
                    </div>
                    <div
                      className={cardStyles.locMetaLine}
                      data-hg-lore-location-optional="true"
                      contentEditable={false}
                    >
                      <span className={cardStyles.locMetaKey}>Detail</span>
                      <span data-hg-lore-location-field="detail" contentEditable={false}>
                        Dock ward · industrial brick
                      </span>
                    </div>
                  </div>
                  <div
                    className={cardStyles.notesBlock}
                    data-hg-lore-location-notes-cell="true"
                    contentEditable={false}
                  >
                    <span className={cardStyles.fieldLabel}>Notes</span>
                    <div
                      className={cardStyles.notesText}
                      data-hg-lore-location-notes="true"
                      contentEditable={false}
                    >
                      <p>
                        Color band suggests landscape / atmosphere without an image asset. Strip uses the
                        same full-bleed inset as the v3 survey bar.
                      </p>
                    </div>
                  </div>
                </div>
              </LabCard>
              <ul className={labStyles.spec}>
                <li>
                  <code>v2</code> seed: optional <code>context</code> line without a key (reads as subtitle).
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V3 · Survey tag</span>
              <LabLocationV3SurveyTagPreview />
              <ul className={labStyles.spec}>
                <li>
                  <code>v3</code> seed order: strip → <code>ref</code> → header → notes (matches{" "}
                  <code>lore-node-seed-html</code>).
                </li>
                <li>Optional hero image in this lab only — canvas seeds stay HTML + strip until a cover field exists.</li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V4 · Ordo · coordinate slab (mono)</span>
              <FactionLabPlate plateKind="protocolOrdoCompactMono">
                <FactionProtocolOrdoCompactBody testId="loc-lab-ordo-coordinate-mono" brandLabel="LOCATION" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Grayscale ORDO LUNARIS compact plate moved here as a location-oriented preview: clearance, live clock,
                  and LAT/LON in the header rail, charter copy below. Same <code>FactionLabPlate</code> width as faction
                  specimens; not wired to <code>lore-location</code> HTML until product adopts this IA.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V5 · Ordo · coordinate slab (mono, field-mapped)</span>
              <FactionLabPlate plateKind="protocolOrdoCompactMono">
                <LocationOrdoCoordinateSlabV5Body testId="loc-lab-ordo-coordinate-mono-v5" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Same chrome as V4, but the slab is a real <code>lore-location</code> shape: masthead reads{" "}
                  <code>LOCATION</code> (mono, like V4); <code>ref</code> / <code>context</code> in the two-line stamp;
                  <code>name</code> drives the grotesk stack; <code>context</code> also drives the footer strip;{" "}
                  <code>detail</code> as a secondary line; notes sit inline in the column (no extra panel) with the same Geist
                  / line-height rhythm as canvas <code>nodeBody</code> / hgDoc prose. LAT/LON are deterministic from the
                  ref (lab only).
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V6 · Ordo · coordinate slab (mono, lean)</span>
              <FactionLabPlate plateKind="protocolOrdoCompactMono">
                <LocationOrdoCoordinateSlabV6Body testId="loc-lab-ordo-coordinate-mono-v6" />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Same plate as V4–V5; DOM carries only <code>name</code>, <code>context</code>, <code>detail</code>,{" "}
                  <code>ref</code>, <code>notes</code> — no duplicate stamps, charter/LAT/survey lines, or footer grid.
                  The slab body uses <code>BufferedContentEditable</code> (rich HTML like canvas nodes); no header REF
                  rail. Search indexing uses the item&apos;s text blob + title, not per-field keys.
                </li>
              </ul>
            </div>

            <div className={labStyles.cell}>
              <span className={labStyles.variantLabel}>V7 · Ordo · coordinate slab (mono, hgDoc notes)</span>
              <FactionLabPlate plateKind="protocolOrdoCompactMono">
                <LocationOrdoCoordinateSlabV7LabBody />
              </FactionLabPlate>
              <ul className={labStyles.spec}>
                <li>
                  Same lean slab as V6 (structured <code>name</code> / <code>context</code> / <code>detail</code> + footer
                  ref), but <code>notes</code> use <code>HeartgardenDocEditor</code> — TipTap hgDoc (slash menu, block
                  schema) with V6-matched Geist sizing on the plate.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function LoreEntityNodeLab() {
  return (
    <VigilThemeProvider>
      <LoreEntityNodeLabInner />
    </VigilThemeProvider>
  );
}
