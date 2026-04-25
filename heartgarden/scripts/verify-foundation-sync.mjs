import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function mustExist(pathFromRoot) {
  const fullPath = resolve(root, pathFromRoot);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing file: ${pathFromRoot}`);
  }
  return fullPath;
}

function mustContain(pathFromRoot, needle) {
  const fullPath = mustExist(pathFromRoot);
  const text = readFileSync(fullPath, "utf8");
  if (!text.includes(needle)) {
    throw new Error(`Expected ${pathFromRoot} to contain "${needle}"`);
  }
}

function run() {
  // App entrypoint should continue to render the foundation shell.
  mustContain(
    "app/_components/VigilApp.tsx",
    'import { ArchitecturalCanvasApp } from "@/src/components/foundation/architectural-canvas-app";'
  );
  mustContain("app/_components/VigilApp.tsx", "<ArchitecturalCanvasApp />");

  // The app shell should use the same node component as Storybook.
  mustContain(
    "src/components/foundation/ArchitecturalCanvasApp.tsx",
    'import { ArchitecturalNodeCard } from "@/src/components/foundation/architectural-node-card";'
  );

  // Storybook stories should exist for the key card shell.
  // (Stories were reorganized into product-ui/canvas/ in commit 6397947.)
  mustExist(
    "src/components/product-ui/canvas/ArchitecturalNodeCard.stories.tsx"
  );
  mustExist(
    "src/components/product-ui/canvas/ArchitecturalCanvasApp.stories.tsx"
  );
  mustExist(
    "src/components/product-ui/canvas/ArchitecturalFolderCard.stories.tsx"
  );
  mustExist("src/components/foundation/LoreImportLandModeRadios.stories.tsx");

  // App popover reuses the same land-mode block as Storybook.
  mustContain(
    "src/components/foundation/ArchitecturalLoreImportUploadPopover.tsx",
    "LoreImportLandModeRadios"
  );

  console.log("Foundation sync check passed.");
}

try {
  run();
} catch (error) {
  console.error("Foundation sync check failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
