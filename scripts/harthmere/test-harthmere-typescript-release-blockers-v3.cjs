#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
let ok = true;
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.error(`FAIL ${label}`); ok = false; }
}
for (const rel of [
  "src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx",
  "src/client/components/challenges/LocalDevHarthmereEconomySystem.tsx",
  "src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx",
]) {
  const src = read(rel);
  check(`${rel} inventory system literal is preserved`, src.includes('system: "inventory" as const'));
  check(`${rel} has no widened inventory system strings`, !/system: "inventory"(?!\s+as const)\s*,/.test(src));
}
const cval = read("src/client/components/CvalHUD.tsx");
const reactJsonBlock = /<ReactJson[\s\S]*?\/?>/.exec(cval)?.[0] || "";
check("CvalHUD no longer passes unsupported name prop", !/\bname=/.test(reactJsonBlock));
check("CvalHUD keeps supported vscode theme", cval.includes('theme="vscode"'));
if (!ok) process.exit(1);
console.log("RESULT: PASS");
