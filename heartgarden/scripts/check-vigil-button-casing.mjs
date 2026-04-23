#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([".git", ".next", "node_modules", "storybook-static"]);
const CSS_EXTS = new Set([".css"]);

async function walk(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), out);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!CSS_EXTS.has(ext)) continue;
    out.push(path.join(dir, entry.name));
  }
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function findViolations(fileText) {
  const violations = [];
  const ruleRe = /([^{}]*vigil-btn[^{}]*)\{([^{}]*)\}/gim;
  let match;
  while ((match = ruleRe.exec(fileText)) !== null) {
    const selector = match[1] ?? "";
    const body = match[2] ?? "";
    if (/text-transform\s*:\s*uppercase\b/i.test(body)) {
      violations.push({
        selector: selector.replace(/\s+/g, " ").trim(),
        index: match.index,
      });
    }
  }
  return violations;
}

async function main() {
  const files = [];
  await walk(ROOT, files);
  const errors = [];

  for (const absPath of files) {
    const text = await readFile(absPath, "utf8");
    const relPath = path.relative(ROOT, absPath).replace(/\\/g, "/");
    const violations = findViolations(text);
    for (const v of violations) {
      errors.push({
        file: relPath,
        line: lineNumberAt(text, v.index),
        selector: v.selector,
      });
    }
  }

  if (errors.length === 0) {
    console.log("OK: no `.vigil-btn` selectors force uppercase text.");
    return;
  }

  console.error("Found forbidden uppercase casing on `.vigil-btn` selectors:");
  for (const err of errors) {
    console.error(`- ${err.file}:${err.line} :: ${err.selector}`);
  }
  console.error(
    "\nUse `text-transform: none` on the shared `.vigil-btn` base and keep uppercase for non-button labels only.",
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("check-vigil-button-casing failed:", error);
  process.exit(1);
});
