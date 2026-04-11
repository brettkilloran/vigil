# Editor surface cutover (hgDoc / TipTap)

Canonical rich editor: `HeartgardenDocEditor` + `src/lib/hg-doc/*`.

## hgDoc surfaces (TipTap)

- Default and task note bodies (canvas card + focus overlay).
- Code-theme note bodies (canvas + focus).
- Media gallery captions / notes (focus gallery panel).
- Lore character and lore location **focus overlay** (structured fields + hgDoc notes via `LoreHybridFocusEditor`).

## Plain text (unchanged)

- Command palette search input, PIN fields, lore ask textarea, folder title `BufferedTextInput` / plain `BufferedContentEditable` plainText mode.

## Legacy HTML editor (remaining)

- **Lore character v11 canvas card** and **lore location canvas card** still use `BufferedContentEditable` on the full hybrid HTML shell until the credential/plaque markup is split into isolated React regions.
