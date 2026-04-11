import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function mustExist(pathFromRoot) {
  const fullPath = resolve(root, pathFromRoot);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing file: ${pathFromRoot}`);
  }
  return fullPath;
}

function read(pathFromRoot) {
  const fullPath = mustExist(pathFromRoot);
  return readFileSync(fullPath, "utf8");
}

function mustContain(pathFromRoot, needle) {
  const text = read(pathFromRoot);
  if (!text.includes(needle)) {
    throw new Error(`Expected ${pathFromRoot} to contain "${needle}"`);
  }
}

function mustNotContain(pathFromRoot, needle) {
  const text = read(pathFromRoot);
  if (text.includes(needle)) {
    throw new Error(`Expected ${pathFromRoot} to NOT contain "${needle}"`);
  }
}

function run() {
  // Default/task hgDoc renderer must not silently fall back to legacy HTML when bodyDoc is missing.
  mustContain(
    "src/components/foundation/ArchitecturalNodeCard.tsx",
    "if (documentVariant === \"hgDoc\")",
  );
  mustContain(
    "src/components/foundation/ArchitecturalNodeCard.tsx",
    "value={bodyDoc ?? EMPTY_HG_DOC}",
  );
  mustNotContain(
    "src/components/foundation/ArchitecturalNodeCard.tsx",
    "documentVariant === \"hgDoc\" && bodyDoc != null",
  );

  // hgDoc command routing must not fall through to legacy execCommand inside hg surfaces.
  mustContain(
    "src/components/foundation/ArchitecturalCanvasApp.tsx",
    "const runHgDocFormat = useCallback(",
  );
  mustContain(
    "src/components/foundation/ArchitecturalCanvasApp.tsx",
    "if (target?.closest(\"[data-hg-doc-editor]\")) return true;",
  );

  // Keep the deprecation annotation near the legacy editor implementation.
  mustContain(
    "src/components/editing/BufferedContentEditable.tsx",
    "Legacy rich-text editor surface.",
  );

  console.log("Editor cutover check passed.");
}

try {
  run();
} catch (error) {
  console.error("Editor cutover check failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

