/**
 * Simulates GitHub Actions `npm ci` in a clean temp directory (npm 10.x, no hooks).
 * Catches "package.json and package-lock.json … out of sync" before push.
 *
 * Run from `vigil/`: `npm run verify:package-lock-ci`
 */
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const NPM_CI_VERSION = "10.9.2";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgSrc = join(root, "package.json");
const lockSrc = join(root, "package-lock.json");

if (!existsSync(lockSrc)) {
  // eslint-disable-next-line no-console -- CLI diagnostics
  console.error("Missing package-lock.json — run npm install in vigil/ first.");
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "heartgarden-ci-verify-"));

try {
  copyFileSync(pkgSrc, join(tmp, "package.json"));
  copyFileSync(lockSrc, join(tmp, "package-lock.json"));
  const env = { ...process.env, SKIP_INSTALL_GIT_HOOKS: "1" };
  const cmd = `npx -y npm@${NPM_CI_VERSION} ci --ignore-scripts`;
  const r = spawnSync(cmd, { stdio: "inherit", cwd: tmp, env, shell: true });
  if (r.status !== 0) {
    // eslint-disable-next-line no-console -- CLI diagnostics
    console.error(
      "\nLockfile would fail GitHub Actions npm ci. From vigil/ run:\n  npm run lockfile:regenerate-linux\nThen commit package-lock.json.\n",
    );
    process.exit(r.status ?? 1);
  }
  // eslint-disable-next-line no-console -- CLI progress
  console.log("\nverify:package-lock-ci OK (clean npm ci with npm " + NPM_CI_VERSION + ").");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
