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

const handlerStart = text.indexOf("harthmere-rebuilt-combat-effect-handler");
const handlerEnd = text.indexOf(
  "\n  private faceCombatActorToward",
  handlerStart
);
const handler = text.slice(handlerStart, handlerEnd);
const blocks = [
  ...handler.matchAll(/const\s+attacker\s*=\s*resolveCombatActor\(/g),
];

const decl = handler.indexOf("const attacker = resolveCombatActor");
const debug = handler.indexOf(
  'debugHarthmereRenderer("renderer.combat_event.attacker_match"'
);
const pulse = handler.search(/this\.startCombatPulse\(\s*attacker,\s*"attack"/);

check("rebuilt handler exists", handlerStart >= 0 && handlerEnd > handlerStart);
check("exactly one attacker declaration block exists", blocks.length === 1);
check(
  "attacker declaration appears before attacker debug",
  decl >= 0 && debug > decl
);
check(
  "attacker declaration appears before attacker pulse",
  decl >= 0 && pulse > decl
);
check(
  "no this.debugHarthmereRenderer calls remain",
  !text.includes("this.debugHarthmereRenderer(")
);
check(
  "robust physical sanitizer remains",
  text.includes("harthmere-robust-physical-combat-sanitize")
);
check(
  "physical no-spark marker remains",
  text.includes("detail.harthmereNoSparkBasic = true")
);

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
