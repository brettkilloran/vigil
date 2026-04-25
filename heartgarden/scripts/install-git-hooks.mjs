/**
 * Writes heartgarden/pre-commit into the real repo's .git/hooks (works when heartgarden/ is not the git root).
 * Skip with SKIP_INSTALL_GIT_HOOKS=1 or when not inside a git work tree (e.g. some CI).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.SKIP_INSTALL_GIT_HOOKS === "1") {
  process.stdout.write("[install-git-hooks] SKIP_INSTALL_GIT_HOOKS=1, skipping.\n");
  process.exit(0);
}

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

let hooksDirRel;
try {
  hooksDirRel = execFileSync("git", ["rev-parse", "--git-path", "hooks"], {
    cwd: appRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  process.stdout.write("[install-git-hooks] Not a git checkout; skipping hook install.\n");
  process.exit(0);
}

const hooksDir = path.resolve(appRoot, hooksDirRel);
const hookPath = path.join(hooksDir, "pre-commit");

const script = `#!/bin/sh
if [ "$SKIP_SECRET_HOOK" = "1" ]; then
  exit 0
fi
ROOT="$(git rev-parse --show-toplevel)"
if [ -d "$ROOT/heartgarden" ]; then
  cd "$ROOT/heartgarden" && pnpm run secrets:protect
else
  echo "[pre-commit] heartgarden/ not found at repo root; skip secrets:protect" >&2
  exit 0
fi
`;

fs.mkdirSync(hooksDir, { recursive: true });
fs.writeFileSync(hookPath, script.replace(/\r\n/g, "\n"), "utf8");
try {
  fs.chmodSync(hookPath, 0o755);
} catch {
  /* Windows may ignore mode */
}
process.stdout.write(`[install-git-hooks] wrote ${hookPath}\n`);
