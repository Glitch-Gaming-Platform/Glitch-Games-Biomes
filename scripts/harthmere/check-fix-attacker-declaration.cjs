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

const marker = text.indexOf("harthmere-rebuilt-combat-effect-handler");
const handlerEnd = text.indexOf("\n  private faceCombatActorToward", marker);
const handler = text.slice(marker, handlerEnd);
const attackerDecl = handler.indexOf("const attacker = resolveCombatActor");
const attackerMatch = handler.indexOf(
  'debugHarthmereRenderer("renderer.combat_event.attacker_match"'
);
const pulse = handler.search(/this\.startCombatPulse\(\s*attacker,\s*"attack"/);

check("rebuilt handler marker exists", marker >= 0);
check(
  "attacker resolver is declared",
  handler.includes("const resolveCombatActor")
);
check("const attacker appears after resolver", attackerDecl >= 0);
check(
  "attacker debug appears after const attacker",
  attackerMatch > attackerDecl
);
check("attacker pulse appears after const attacker", pulse > attackerDecl);
check(
  "no this.debugHarthmereRenderer calls remain",
  !text.includes("this.debugHarthmereRenderer(")
);
check(
  "robust physical sanitize remains",
  text.includes("harthmere-robust-physical-combat-sanitize")
);
check(
  "physical marker still set",
  text.includes("detail.harthmereNoSparkBasic = true")
);

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
