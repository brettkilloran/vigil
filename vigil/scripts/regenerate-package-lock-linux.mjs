/**
 * Rewrites `vigil/package-lock.json` using npm 10 with `--os linux --cpu x64`.
 *
 * Why: `npm install` on Windows can omit Linux optional dependency entries (e.g.
 * `@emnapi/*` for `@img/sharp-wasm32`). Ubuntu `npm ci` then errors with
 * "Missing: … from lock file".
 *
 * Run from `vigil/`: `npm run lockfile:regenerate-linux`
 * Then: `npm run verify:package-lock-ci` and commit `package-lock.json`.
 */
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Pin to npm 10.x — aligns with Node 22 on GitHub Actions `setup-node`. */
const NPM_CI_VERSION = "10.9.2";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgSrc = join(root, "package.json");
const lockDest = join(root, "package-lock.json");

const tmp = mkdtempSync(join(tmpdir(), "heartgarden-lock-"));
const pkgTmp = join(tmp, "package.json");
const lockTmp = join(tmp, "package-lock.json");

try {
  copyFileSync(pkgSrc, pkgTmp);
  const env = { ...process.env, SKIP_INSTALL_GIT_HOOKS: "1" };
  /** One shell line: Windows may resolve `npx` to `npx.ps1` (not spawn-able as a binary). */
  const cmd = `npx -y npm@${NPM_CI_VERSION} install --package-lock-only --os linux --cpu x64 --ignore-scripts`;
  const r = spawnSync(cmd, { stdio: "inherit", cwd: tmp, env, shell: true });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
  if (!existsSync(lockTmp)) {
    // eslint-disable-next-line no-console -- CLI diagnostics
    console.error("Expected package-lock.json in temp dir; npm did not create it.");
    process.exit(1);
  }
  copyFileSync(lockTmp, lockDest);
  // eslint-disable-next-line no-console -- CLI progress
  console.log(`\nWrote ${lockDest}`);
  // eslint-disable-next-line no-console -- CLI progress
  console.log("Next: npm run verify:package-lock-ci  →  git diff package-lock.json  →  commit");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
