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

const marker = text.indexOf("harthmere-fix-attacker-declaration-v1");
const attackerDecl = text.indexOf("const attacker =", marker);
const attackerMatch = text.indexOf('debugHarthmereRenderer("renderer.combat_event.attacker_match"', marker);
const pulse = text.indexOf('this.startCombatPulse(attacker, "attack"', marker);

check("fix marker exists", marker >= 0);
check("attackerOffsetMatch is declared", text.includes("const attackerOffsetMatch = this.findCombatLifeByOffset(detail.attackerOffset);"));
check("const attacker appears after marker", attackerDecl > marker);
check("attacker debug appears after const attacker", attackerMatch > attackerDecl);
check("attacker pulse appears after const attacker", pulse > attackerDecl);
check("no this.debugHarthmereRenderer calls remain", !text.includes("this.debugHarthmereRenderer("));
check("robust physical sanitize remains", text.includes("harthmere-robust-physical-combat-sanitize-v2"));
check("physical marker still set", text.includes("detailAny.harthmereNoSparkBasic = true"));

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
