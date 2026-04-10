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

const mustExist = [
  "react/package.json",
  "react-dom/package.json",
  "storybook/package.json",
  "@storybook/nextjs/package.json",
  "react-refresh/package.json",
  "webpack/package.json",
  "html-webpack-plugin/package.json",
];

let bad = false;
for (const rel of mustExist) {
  const abs = path.join(root, "node_modules", rel);
  if (!existsSync(abs)) {
     
    console.error(`Missing: node_modules/${rel}`);
    bad = true;
  }
}

if (!bad) {
  for (const name of ["react", "react-dom"]) {
    try {
      require.resolve(name, { paths: [root] });
    } catch {
       
      console.error(`Cannot resolve package: ${name}`);
      bad = true;
    }
  }
}

if (bad) {
   
  console.error("\nFix: stop dev servers, then from vigil/ run: npm run reinstall\n");
  process.exit(1);
}

 
console.log("Storybook doctor: node_modules looks OK for react, storybook, webpack.");
