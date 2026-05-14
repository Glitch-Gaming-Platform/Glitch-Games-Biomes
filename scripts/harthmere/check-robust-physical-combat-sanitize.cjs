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

check("robust sanitize version exists", text.includes("harthmere-robust-physical-combat-sanitize-v2"));
check("Training Dagger Strike can classify physical via dagger/strike", text.includes("dagger|strike|slash|swing"));
check("physical clips can classify physical", text.includes("harthmereHasPhysicalClip"));
check("explicit spark remains magic", text.includes("harthmereIsExplicitMagicAction"));
check("magic clips are stripped from physical attacks", text.includes("basicmagic|heavymagic|spark|spell|arcane"));
check("no this.debugHarthmereRenderer calls remain", !text.includes("this.debugHarthmereRenderer("));
check("physical marker is set", text.includes("detailAny.harthmereNoSparkBasic = true"));

console.log("");
console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(ok ? 0 : 1);
