/**
 * Location lore nodes: canonical canvas `bodyHtml` holds three structured lines
 * (name required; context + detail optional) plus long-form notes. Focus mode
 * projects to a single scroll surface; notes are hidden on the canvas (CSS).
 */

const DEFAULT_NOTES_HTML = "<p><br></p>";

function parseWrapped(html: string): HTMLElement | null {
  if (typeof DOMParser === "undefined") return null;
  try {
    const doc = new DOMParser().parseFromString(`<div id="__hg_loc_doc">${html}</div>`, "text/html");
    return doc.getElementById("__hg_loc_doc");
  } catch {
    return null;
  }
}

function takeInnerHtml(root: ParentNode, selector: string, fallback = "<br>"): string {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) return fallback;
  const html = (el.innerHTML || "").trim();
  return html || fallback;
}

/** Plain text for graph title — required line is `name`. */
export function plainPlaceNameFromLocationBodyHtml(bodyHtml: string): string {
  const root = parseWrapped(bodyHtml);
  if (!root) return "";
  const modern = root.querySelector<HTMLElement>('[data-hg-lore-location-field="name"]');
  if (modern) {
    const t = (modern.textContent || "").trim();
    return t || "";
  }
  const legacy = root.querySelector<HTMLElement>('[class*="locName"]');
  if (legacy) {
    const t = (legacy.textContent || "").trim();
    return t || "";
  }
  return "";
}

function extractNameHtml(root: ParentNode): string {
  const el = root.querySelector<HTMLElement>('[data-hg-lore-location-field="name"]');
  if (el) {
    const raw = (el.innerHTML || "").trim();
    return raw || "<br>";
  }
  const legacy = root.querySelector<HTMLElement>('[class*="locName"]');
  if (legacy) {
    const raw = (legacy.innerHTML || "").trim();
    return raw || "<br>";
  }
  return "<br>";
}

function extractContextHtml(root: ParentNode): string {
  const el = root.querySelector<HTMLElement>('[data-hg-lore-location-field="context"]');
  if (el) {
    const raw = (el.innerHTML || "").trim();
    return raw || "<br>";
  }
  const lines = root.querySelectorAll<HTMLElement>('[class*="locHeader"] [class*="locMetaLine"]');
  if (lines.length === 0) return "<br>";
  const first = lines[0]!;
  const spans = first.querySelectorAll("span");
  if (spans.length >= 2) {
    const val = spans[spans.length - 1] as HTMLElement;
    const raw = (val.innerHTML || "").trim();
    return raw || "<br>";
  }
  const raw = (first.innerHTML || "").trim();
  return raw || "<br>";
}

function extractDetailHtml(root: ParentNode): string {
  const el = root.querySelector<HTMLElement>('[data-hg-lore-location-field="detail"]');
  if (el) {
    const raw = (el.innerHTML || "").trim();
    return raw || "<br>";
  }
  const lines = root.querySelectorAll<HTMLElement>('[class*="locHeader"] [class*="locMetaLine"]');
  if (lines.length < 2) return "<br>";
  const second = lines[1]!;
  const spans = second.querySelectorAll("span");
  if (spans.length >= 2) {
    const val = spans[spans.length - 1] as HTMLElement;
    const raw = (val.innerHTML || "").trim();
    return raw || "<br>";
  }
  const raw = (second.innerHTML || "").trim();
  return raw || "<br>";
}

function extractRefHtml(root: ParentNode): string {
  const el = root.querySelector<HTMLElement>('[data-hg-lore-location-field="ref"]');
  if (el) {
    const raw = (el.innerHTML || "").trim();
    return raw || "<br>";
  }
  const legacy = root.querySelector<HTMLElement>('[class*="plaqueCorner"]');
  if (legacy) {
    const raw = (legacy.innerHTML || "").trim();
    return raw || "<br>";
  }
  return "<br>";
}

function extractNotesHtml(root: ParentNode): string {
  const el = root.querySelector<HTMLElement>('[data-hg-lore-location-notes="true"]');
  if (el) return takeInnerHtml(root, '[data-hg-lore-location-notes="true"]', DEFAULT_NOTES_HTML);
  return takeInnerHtml(root, '[class*="notesText"]', DEFAULT_NOTES_HTML);
}

function hasRefInTemplate(root: ParentNode): boolean {
  return !!root.querySelector('[data-hg-lore-location-field="ref"], [class*="plaqueCorner"]');
}

/**
 * Build focus document HTML from canonical location body (modern or legacy).
 */
export function locationBodyToFocusDocumentHtml(bodyHtml: string): string {
  const root = parseWrapped(bodyHtml);
  if (!root) return bodyHtml;

  const name = extractNameHtml(root);
  const context = extractContextHtml(root);
  const detail = extractDetailHtml(root);
  const notes = extractNotesHtml(root);
  const showRef = hasRefInTemplate(root);
  const ref = showRef ? extractRefHtml(root) : "";

  const refBlock = showRef
    ? `<div data-hg-lore-location-focus-row="ref">
<span data-hg-lore-location-focus-label="true">Reference</span>
<div data-hg-lore-location-focus-field="ref" data-placeholder="Optional code" contenteditable="true" spellcheck="false">${ref}</div>
</div>`
    : "";

  return `<div data-hg-location-focus-doc="v1">
<div data-hg-lore-location-focus-meta="true" contenteditable="false">
<div data-hg-lore-location-focus-row="name">
<span data-hg-lore-location-focus-label="true">Place</span>
<div data-hg-lore-location-focus-field="name" data-placeholder="Place name" contenteditable="true" spellcheck="false">${name}</div>
</div>
<div data-hg-lore-location-focus-row="context">
<span data-hg-lore-location-focus-label="true">Context</span>
<div data-hg-lore-location-focus-field="context" data-placeholder="Region, polity, parent place (optional)" contenteditable="true" spellcheck="false">${context}</div>
</div>
<div data-hg-lore-location-focus-row="detail">
<span data-hg-lore-location-focus-label="true">Detail</span>
<div data-hg-lore-location-focus-field="detail" data-placeholder="District, site type, layer (optional)" contenteditable="true" spellcheck="false">${detail}</div>
</div>
${refBlock}
</div>
<div data-hg-lore-location-focus-notes-shell="true" contenteditable="false">
<span data-hg-lore-location-focus-label="true">Notes</span>
<div data-hg-lore-location-focus-notes="true" contenteditable="true" spellcheck="false">${notes}</div>
</div>
</div>`;
}

function setInnerHtml(root: ParentNode, selector: string, html: string) {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.innerHTML = html.trim() ? html : "<br>";
}

function mergeIntoModernTemplate(
  templateRoot: ParentNode,
  name: string,
  context: string,
  detail: string,
  ref: string | undefined,
  notes: string,
) {
  setInnerHtml(templateRoot, '[data-hg-lore-location-field="name"]', name);
  setInnerHtml(templateRoot, '[data-hg-lore-location-field="context"]', context);
  setInnerHtml(templateRoot, '[data-hg-lore-location-field="detail"]', detail);
  if (ref !== undefined) {
    setInnerHtml(templateRoot, '[data-hg-lore-location-field="ref"]', ref);
  }
  setInnerHtml(templateRoot, '[data-hg-lore-location-notes="true"]', notes);
}

function mergeIntoLegacyTemplate(
  templateRoot: ParentNode,
  name: string,
  context: string,
  detail: string,
  ref: string | undefined,
  notes: string,
) {
  setInnerHtml(templateRoot, '[class*="locName"]', name);

  const lines = templateRoot.querySelectorAll<HTMLElement>('[class*="locHeader"] [class*="locMetaLine"]');
  if (lines.length >= 1) {
    const first = lines[0]!;
    const ctxField = first.querySelector<HTMLElement>('[data-hg-lore-location-field="context"]');
    if (ctxField) {
      ctxField.innerHTML = context.trim() ? context : "<br>";
    } else {
      const spans = first.querySelectorAll("span");
      if (spans.length >= 2) {
        const val = spans[spans.length - 1] as HTMLElement;
        val.innerHTML = context.trim() ? context : "<br>";
      } else {
        first.innerHTML = context.trim() ? context : "<br>";
      }
    }
  }
  if (lines.length >= 2) {
    const second = lines[1]!;
    const detailField = second.querySelector<HTMLElement>('[data-hg-lore-location-field="detail"]');
    if (detailField) {
      detailField.innerHTML = detail.trim() ? detail : "<br>";
    } else {
      const spans = second.querySelectorAll("span");
      if (spans.length >= 2) {
        const val = spans[spans.length - 1] as HTMLElement;
        val.innerHTML = detail.trim() ? detail : "<br>";
      } else {
        second.innerHTML = detail.trim() ? detail : "<br>";
      }
    }
  }

  if (ref !== undefined) {
    const refEl =
      templateRoot.querySelector<HTMLElement>('[data-hg-lore-location-field="ref"]') ??
      templateRoot.querySelector<HTMLElement>('[class*="plaqueCorner"]');
    if (refEl) refEl.innerHTML = ref.trim() ? ref : "<br>";
  }

  const notesEl = templateRoot.querySelector<HTMLElement>('[data-hg-lore-location-notes="true"]');
  if (notesEl) {
    notesEl.innerHTML = notes;
  } else {
    setInnerHtml(templateRoot, '[class*="notesText"]', notes);
  }
}

/**
 * Merge focus document edits back into canonical location body HTML.
 */
export function focusDocumentHtmlToLocationBody(focusHtml: string, canonicalTemplateHtml: string): string {
  const focusRoot = parseWrapped(focusHtml);
  const templateRoot = parseWrapped(canonicalTemplateHtml);
  if (!focusRoot || !templateRoot) return canonicalTemplateHtml;

  const name = takeInnerHtml(focusRoot, '[data-hg-lore-location-focus-field="name"]', "<br>");
  const context = takeInnerHtml(focusRoot, '[data-hg-lore-location-focus-field="context"]', "<br>");
  const detail = takeInnerHtml(focusRoot, '[data-hg-lore-location-focus-field="detail"]', "<br>");
  const notes = takeInnerHtml(focusRoot, '[data-hg-lore-location-focus-notes="true"]', DEFAULT_NOTES_HTML);
  const refField = focusRoot.querySelector('[data-hg-lore-location-focus-field="ref"]');
  const ref = refField ? takeInnerHtml(focusRoot, '[data-hg-lore-location-focus-field="ref"]', "<br>") : undefined;

  if (templateRoot.querySelector('[data-hg-lore-location-field="name"]')) {
    mergeIntoModernTemplate(templateRoot, name, context, detail, ref, notes);
  } else {
    mergeIntoLegacyTemplate(templateRoot, name, context, detail, ref, notes);
  }

  return templateRoot.innerHTML;
}
