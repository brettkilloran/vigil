#!/usr/bin/env node

const MAX_INPUT_BYTES = 1024 * 1024;
const SENTINEL_RE = /REVIEW_AUDIT_WRITTEN:\s*(heartgarden\/docs\/REVIEW_[^\s]+\.md)/;

function gatherText(value, out) {
  if (value == null) return;
  if (typeof value === "string") return out.push(value);
  if (Array.isArray(value)) return value.forEach((v) => gatherText(v, out));
  if (typeof value === "object") Object.values(value).forEach((v) => gatherText(v, out));
}

async function readStdinWithCap(maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    total += buf.length;
    if (total > maxBytes) throw new Error("stdin too large");
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function emitFollowup(auditPath) {
  process.stdout.write(
    JSON.stringify({
      followup_message:
        `The /review-heavy Codex subagent wrote ${auditPath}. ` +
        `Now run the fix pass by following .cursor/skills/review-heavy/FIX_PASS.md exactly. ` +
        `Do NOT apply RISKY or NET_NEW items without explicit user approval.`,
    }),
  );
}

async function main() {
  const timer = setTimeout(() => process.exit(0), 5000);
  try {
    const raw = await readStdinWithCap(MAX_INPUT_BYTES);
    if (!raw.trim()) return;
    const payload = JSON.parse(raw);
    const allText = [];
    gatherText(payload, allText);
    const match = allText.join("\n").match(SENTINEL_RE);
    if (!match) return;
    emitFollowup(match[1]);
  } catch {
    // fail-open
  } finally {
    clearTimeout(timer);
  }
}

main();
