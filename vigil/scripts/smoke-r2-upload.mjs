/**
 * One-shot: presign (via Vercel CLI curl) → PUT 1×1 PNG → GET public URL.
 * Run from repo root: node vigil/scripts/smoke-r2-upload.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const bodyPath = join(root, "r2-smoke-presign.json");
writeFileSync(bodyPath, JSON.stringify({ contentType: "image/png", filename: "smoke.png" }));

const dataArg = `@${bodyPath.replaceAll("\\", "/")}`;
const quoted = JSON.stringify(dataArg);
const cmd = `npx vercel curl /api/upload/presign -- --request POST --header "Content-Type: application/json" --data ${quoted} -s`;
const out = execSync(cmd, {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 2_000_000,
  shell: true,
});

unlinkSync(bodyPath);

function extractPresignJson(text) {
  const start = text.indexOf('{"ok"');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
const jsonStr = extractPresignJson(out);
if (!jsonStr) {
  console.error("No presign JSON in vercel curl output:\n", out.slice(0, 1200));
  process.exit(1);
}
const { ok, uploadUrl, publicUrl, error, code } = JSON.parse(jsonStr);
if (!ok) {
  console.error("Presign failed:", code, error);
  process.exit(1);
}

// Minimal valid PNG (1×1 transparent)
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const put = await fetch(uploadUrl, {
  method: "PUT",
  headers: { "Content-Type": "image/png" },
  body: png,
});
if (!put.ok) {
  console.error("PUT failed:", put.status, await put.text().catch(() => ""));
  process.exit(1);
}

const get = await fetch(publicUrl, { method: "GET" });
const ct = get.headers.get("content-type") || "";
const buf = Buffer.from(await get.arrayBuffer());
if (!get.ok) {
  console.error("GET publicUrl failed:", get.status, ct);
  process.exit(1);
}
if (!ct.includes("image/") && !buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
  console.error("Unexpected response (not PNG):", ct, "len", buf.length);
  process.exit(1);
}

console.log("R2 smoke OK: presign → PUT → GET publicUrl", buf.length, "bytes");
