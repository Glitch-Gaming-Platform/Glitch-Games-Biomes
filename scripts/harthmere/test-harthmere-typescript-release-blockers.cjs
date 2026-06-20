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
  const text = read(rel);
  check(`${rel} keeps inventory system literal`, text.includes('system: "inventory" as const'));
  check(`${rel} keeps local-player actor literal`, text.includes('actorId: "local-player" as const'));
  check(`${rel} has no widened actorId literal in new inventory logs`, !/actorId:\s*"local-player",/.test(text));
}
const cval = read("src/client/components/CvalHUD.tsx");
check("CvalHUD removes unsupported iconStyle prop", !/\biconStyle=/.test(cval));
check("CvalHUD removes unsupported displayDataTypes prop", !/\bdisplayDataTypes=/.test(cval));
check("CvalHUD removes unsupported displayObjectSize prop", !/\bdisplayObjectSize=/.test(cval));
check("CvalHUD removes unsupported quotesOnKeys prop", !/\bquotesOnKeys=/.test(cval));
check("CvalHUD removes unsupported indentWidth prop", !/\bindentWidth=/.test(cval));
check("CvalHUD keeps supported vscode theme", cval.includes('theme="vscode"'));

if (!ok) {
  console.error("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
