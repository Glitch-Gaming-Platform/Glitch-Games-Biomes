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

check("training dummy marker exists", text.includes("harthmere-training-dummy-combat-actor-v1"));
check("training dummy label exists", text.includes('"Guard Yard Training Dummy"'));
check("training dummy has combat offset 9001", /"Guard Yard Training Dummy"[\s\S]*?,\s*9001\s*\)/.test(text));
check("uses animated townsperson_guard GLTF asset", text.includes('A("townsperson_guard"'));
check("rebuilt combat effect handler still exists", text.includes("harthmere-rebuilt-combat-effect-handler-v1"));
check("physical effect route debug still exists", text.includes("renderer.combat_event.effect_route"));

const duplicate9001 = [...text.matchAll(/,\s*9001\s*\)/g)].length;
check("only one 9001 combat placement", duplicate9001 === 1);

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
