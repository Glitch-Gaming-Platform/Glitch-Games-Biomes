#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const rel = "src/client/components/challenges/LocalDevHarthmereCombat.tsx";
const full = path.join(root, rel);
const text = fs.readFileSync(full, "utf8");

let ok = true;

function check(name, condition) {
  console.log(`${condition ? "OK" : "FAIL"} ${name}`);
  if (!condition) ok = false;
}

check("fix marker exists", text.includes("harthmere-fix-bad-inline-const-v1"));
check("no invalid const after attackerOffset/targetOffset", !/attackerOffset,\s*\n\s*targetOffset,\s*\n\s*\/\/\s*harthmere-no-spark-basic-event-marker\s*\n\s*const\s+harthmerePhysicalAttack/.test(text));
check("no harthmereEventAttackerClipPriority reference remains", !text.includes("harthmereEventAttackerClipPriority"));
check("no harthmerePhysicalAttack reference remains", !/[^A-Z_]harthmerePhysicalAttack/.test(text));
check("inline physical attackerClipPriority exists", text.includes('entry.ability === "basic" || entry.ability === "heavy"'));
check("inline magic clip filter exists", text.includes("basicmagic|heavymagic|spark|spell|arcane"));

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
