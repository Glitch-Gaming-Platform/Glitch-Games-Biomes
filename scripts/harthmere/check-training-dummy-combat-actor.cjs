#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const rel = "src/client/game/renderers/local_dev/harthmere_assets.ts";
const full = path.join(root, rel);
const text = fs.readFileSync(full, "utf8");

let ok = true;
function check(label, condition) {
  console.log(`${condition ? "OK" : "FAIL"} ${label}`);
  if (!condition) ok = false;
}

check(
  "training dummy visual proxy marker exists",
  text.includes("harthmere-training-dummy-visual-proxy")
);
check(
  "training dummy label exists",
  text.includes('"Guard Yard Training Dummy"')
);
check(
  "training dummy combat offset 9001 resolves through the proxy",
  /if \(offset === 9001\)[\s\S]{0,320}Guard Yard Training Dummy/.test(text)
);
check(
  "proxy prefers an existing animated guard actor",
  /offset === 9001[\s\S]{0,260}Guard patrol around yard/.test(text)
);
check(
  "rebuilt combat effect handler still exists",
  text.includes("harthmere-rebuilt-combat-effect-handler")
);
check(
  "physical effect route debug still exists",
  text.includes("renderer.combat_event.effect_route")
);

const proxy9001 = [...text.matchAll(/offset === 9001/g)].length;
check("only one 9001 visual proxy branch", proxy9001 === 1);

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
