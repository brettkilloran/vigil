/**
 * Quick sanity check for a broken `node_modules` tree (common cause of a blank Storybook UI).
 * Run: `node ./scripts/storybook-doctor.mjs` from `vigil/`.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));

const checks = [
  ["react", "react/package.json"],
  ["react-dom", "react-dom/package.json"],
  ["storybook", "storybook/package.json"],
  ["@storybook/nextjs", "@storybook/nextjs/package.json"],
  ["react-refresh", "react-refresh/package.json"],
  ["webpack", "webpack/package.json"],
  ["html-webpack-plugin", "html-webpack-plugin/package.json"],
];

let bad = false;
for (const [, rel] of checks) {
  const abs = path.join(root, "node_modules", rel);
  if (!existsSync(abs)) {
    // eslint-disable-next-line no-console -- CLI diagnostics
    console.error(`Missing: ${rel}`);
    bad = true;
  }
}

if (!bad) {
  for (const [name] of checks) {
    try {
      require.resolve(name, { paths: [root] });
    } catch {
      // eslint-disable-next-line no-console -- CLI diagnostics
      console.error(`Cannot resolve package: ${name}`);
      bad = true;
    }
  }
}

if (bad) {
  // eslint-disable-next-line no-console -- CLI diagnostics
  console.error("\nFix: stop dev servers, then from vigil/ run: npm run reinstall\n");
  process.exit(1);
}

// eslint-disable-next-line no-console -- CLI diagnostics
console.log("Storybook doctor: node_modules looks OK for react, storybook, webpack.");
