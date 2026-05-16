#!/usr/bin/env node
"use strict";
/* HARTHMERE_FIXTURE_ATTACHMENT_SANITY_V1 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
let ok = true;

function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  if (detail) for (const line of (Array.isArray(detail) ? detail : String(detail).split("\n")).filter(Boolean)) console.log(`  - ${line}`);
}

console.log("== Harthmere fixture attachment / lamp support sanity tests v1 ==");
console.log(`Root: ${root}`);
console.log();

if (!fs.existsSync(assetsPath)) {
  fail("harthmere_assets.ts exists", `Missing ${assetsPath}`);
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
pass("harthmere_assets.ts exists");

const text = fs.readFileSync(assetsPath, "utf8");
const lines = text.split(/\r?\n/);

const placementRe = /P\(\s*["']([^"']+)["']\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["'](?:\s*,\s*([^)]+))?\)/;

const lightingPlacements = [];
for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  const m = line.match(placementRe);
  if (!m) continue;
  const asset = m[1];
  const name = m[6];
  const district = m[7];
  const yExpr = (m[8] || "").trim();
  const haystack = `${asset} ${name}`.toLowerCase();
  if (/(lamp|lantern|chandelier|torch|beacon|candle)/i.test(haystack)) {
    lightingPlacements.push({
      line: i + 1,
      asset,
      name,
      district,
      yExpr,
      text: line.trim(),
      haystack,
    });
  }
}

if (lightingPlacements.length >= 15) {
  pass("lighting fixture placements are detected for attachment/support auditing");
} else {
  fail("lighting fixture placements are detected for attachment/support auditing", `found ${lightingPlacements.length}`);
}

const supportWords = /(mounted|wall|hanging|hang|ceiling|beam|hook|post|pole|bracket|chain|supported|on |over |from |beside|entry|entrance|ground|floor|counter|table|platform|bridge|path|road|pier|dock|grave|altar|fountain|brazier|marker|marking|beacon|witchlight)/i;
const floatingFailures = [];
const ceilingFailures = [];
const groundFailures = [];
const weakAttachmentWarnings = [];

for (const p of lightingPlacements) {
  const high = /GROUND_Y\s*\+\s*(?:[1-9]|\d+\.\d+)/.test(p.yExpr) || /chandelier|wall|hanging|lantern_wall|church_lantern/i.test(p.asset);
  const groundAsset = /obj_lamp_ground|brazier|ground/i.test(p.asset);
  const wallAsset = /wall|lantern_wall|obj_lamp_wall|church_lantern/i.test(p.asset);
  const chandelier = /chandelier/i.test(p.asset + " " + p.name);
  const hasSupport = supportWords.test(p.name);

  if (chandelier && !/(hanging|ceiling|beam|chain|hook)/i.test(p.name)) {
    ceilingFailures.push(`line ${p.line}: ${p.name} (${p.asset}) must say what ceiling/beam/chain supports it`);
  }

  if (groundAsset && p.yExpr && /GROUND_Y\s*\+\s*(?:1|2|3|4|5|\d+\.\d+)/.test(p.yExpr)) {
    groundFailures.push(`line ${p.line}: ${p.name} (${p.asset}) is a ground fixture but has elevated y=${p.yExpr}`);
  }

  if (wallAsset && !/(wall|mounted|entry|attached|beside|on |bracket)/i.test(p.name)) {
    weakAttachmentWarnings.push(`line ${p.line}: ${p.name} (${p.asset}) should name wall/entry/bracket attachment`);
  }

  if (high && !hasSupport) {
    floatingFailures.push(`line ${p.line}: ${p.name} (${p.asset}) y=${p.yExpr || "<default>"} needs wall/ceiling/beam/hook/post/counter/ground support wording`);
  }
}

if (floatingFailures.length) {
  fail("elevated lamps/lanterns/chandeliers declare visible attachment/support", floatingFailures.slice(0, 40));
} else {
  pass("elevated lamps/lanterns/chandeliers declare visible attachment/support");
}

if (ceilingFailures.length) {
  fail("ceiling fixtures explicitly connect to ceiling/beam/hook/chain", ceilingFailures);
} else {
  pass("ceiling fixtures explicitly connect to ceiling/beam/hook/chain");
}

if (groundFailures.length) {
  fail("ground lamps remain grounded instead of floating", groundFailures);
} else {
  pass("ground lamps remain grounded instead of floating");
}

if (weakAttachmentWarnings.length) {
  fail("wall/entry lanterns describe their client/anchor attachment", weakAttachmentWarnings.slice(0, 40));
} else {
  pass("wall/entry lanterns describe their client/anchor attachment");
}

const mustHavePatterns = [
  ["Copper Kettle chandelier connects to ceiling beam", /Main tavern chandelier hanging from ceiling beam/i],
  ["tavern wall lanterns are mounted", /Wall-mounted lantern/i],
  ["Noble Rise wall lamps are mounted", /Wall lamp mounted beside Reeve Hall balcony/i],
  ["ground lamps are named as ground/entrance/fountain/brazier fixtures", /Gate brazier lamp|Fountain lamp|entrance lamp|fog lamp/i],
];

for (const [label, pattern] of mustHavePatterns) {
  if (pattern.test(text)) pass(label);
  else fail(label, `Missing pattern ${pattern}`);
}

console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
