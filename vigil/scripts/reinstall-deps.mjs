/**
 * Removes `node_modules` and runs `npm ci` for a clean tree.
 * Use when Storybook/Webpack report ENOENT inside packages (corrupt install).
 *
 * Close dev servers, Storybook, and IDE terminals that lock files under
 * `node_modules` (Windows EBUSY) before running.
 */
import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(root, "node_modules");

process.chdir(root);

if (existsSync(nm)) {
  // eslint-disable-next-line no-console -- CLI progress
  console.error("Removing node_modules…");
  try {
    rmSync(nm, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console -- CLI diagnostics
    console.error(
      "\nCould not delete node_modules (EBUSY/EPERM). Close Next.js, Storybook, test runners, and other terminals using this folder, then retry.\n",
    );
    throw err;
  }
}

const r = spawnSync("npm", ["ci"], { stdio: "inherit", shell: true, cwd: root });
process.exit(r.status ?? 1);
