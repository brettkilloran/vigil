#!/usr/bin/env node

const MAX_INPUT_BYTES = 1024 * 1024; // 1MB cap
const SENTINEL_RE = /REVIEW_AUDIT_WRITTEN:\s*(heartgarden\/docs\/REVIEW_[^\s]+\.md)/;

function gatherText(value, out) {
  if (value == null) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) gatherText(v, out);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value)) gatherText(v, out);
  }
}

async function readStdinWithCap(maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    total += buf.length;
    if (total > maxBytes) {
      throw new Error("stdin too large");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function emitFollowup(auditPath) {
  const followup = {
    followup_message:
      `The /review Codex subagent wrote ${auditPath}. ` +
      `Now run the fix pass by following .cursor/skills/review/FIX_PASS.md exactly. ` +
      `Do NOT apply RISKY or NET_NEW items without explicit user approval. ` +
      `Use fresh Codex subagents for classifier, fixer, and verifier roles. ` +
      `Enforce baseline-relative gates with npm run check and npm run test:unit as specified in FIX_PASS.md. ` +
      `If verifier output is unparseable or indicates net-new functionality, product-goal drift, or medium/high regression risk, stop and escalate.`,
  };
  process.stdout.write(JSON.stringify(followup));
}

async function main() {
  const timer = setTimeout(() => {
    process.exit(0);
  }, 5000);

  try {
    const raw = await readStdinWithCap(MAX_INPUT_BYTES);
    if (!raw.trim()) return;

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }

    const allText = [];
    gatherText(payload, allText);
    const merged = allText.join("\n");
    const match = merged.match(SENTINEL_RE);
    if (!match) return;

    const auditPath = match[1];
    emitFollowup(auditPath);
  } catch {
    // fail-open by design
  } finally {
    clearTimeout(timer);
  }
}

main();
