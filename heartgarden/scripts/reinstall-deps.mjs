/**
 * Removes `node_modules` and runs `pnpm install --frozen-lockfile` for a clean tree.
 * Use when Storybook/Webpack report ENOENT inside packages (corrupt install).
 *
 * Close dev servers, Storybook, and IDE terminals that lock files under
 * `node_modules` (Windows EBUSY) before running.
 */

import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(root, "node_modules");

process.chdir(root);

if (existsSync(nm)) {
  console.error("Removing node_modules…");
  try {
    rmSync(nm, {
      force: true,
      maxRetries: 5,
      recursive: true,
      retryDelay: 200,
    });
  } catch (err) {
    console.error(
      "\nCould not delete node_modules (EBUSY/EPERM). Close Next.js, Storybook, test runners, and other terminals using this folder, then retry.\n"
    );
    throw err;
  }
}

const r = spawnSync("pnpm", ["install", "--frozen-lockfile"], {
  cwd: root,
  shell: true,
  stdio: "inherit",
});
process.exit(r.status ?? 1);
