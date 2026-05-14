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

const blockRe = /\/\/\s*harthmere-fix-attacker-declaration-v1\s*\n\s*const\s+attackerOffsetMatch\s*=\s*this\.findCombatLifeByOffset\(detail\.attackerOffset\);\s*\n\s*const\s+attacker\s*=/g;
const blocks = [...text.matchAll(blockRe)];

const fixMarker = text.indexOf("harthmere-fix-attacker-declaration-v1");
const decl = text.indexOf("const attacker =", fixMarker);
const debug = text.indexOf('debugHarthmereRenderer("renderer.combat_event.attacker_match"', fixMarker);
const pulse = text.indexOf('this.startCombatPulse(attacker, "attack"', fixMarker);

check("de-dupe marker exists", text.includes("harthmere-dedupe-attacker-declaration-v1"));
check("exactly one attacker declaration block exists", blocks.length === 1);
check("attacker declaration appears before attacker debug", decl >= 0 && debug > decl);
check("attacker declaration appears before attacker pulse", decl >= 0 && pulse > decl);
check("no this.debugHarthmereRenderer calls remain", !text.includes("this.debugHarthmereRenderer("));
check("robust physical sanitizer remains", text.includes("harthmere-robust-physical-combat-sanitize-v2"));
check("physical no-spark marker remains", text.includes("detailAny.harthmereNoSparkBasic = true"));

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
