#!/usr/bin/env node
"use strict";
/* HARTHMERE_WALL_FIXTURE_ATTACHMENT_SANITY_V2 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
let ok = true;

function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  const lines = Array.isArray(detail) ? detail : String(detail || "").split("\n");
  for (const line of lines.filter(Boolean)) console.log(`  - ${line}`);
}

console.log("== Harthmere wall/client fixture attachment sanity tests v2 ==");
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

const placements = [];
for (let i = 0; i < lines.length; i += 1) {
  const m = lines[i].match(placementRe);
  if (!m) continue;
  const [_, asset, x, z, yaw, scale, name, district, yExpr] = m;
  placements.push({
    line: i + 1,
    asset,
    name,
    district,
    yExpr: (yExpr || "").trim(),
    text: lines[i].trim(),
    haystack: `${asset} ${name}`.toLowerCase(),
  });
}

// This test is deliberately NOT for freestanding signs, signposts, plaza banners,
// laundry cloth, signal braziers, or pier signs. Those can be valid world props
// without being attached to a wall. This test targets fixtures that claim or imply
// wall/client attachment: wall lanterns, mounted torches, wall shelves/bookcases,
// windows, wall plaques, and explicit "mounted/attached/against wall" props.
function isWallClientFixture(p) {
  const h = p.haystack;
  if (/(obj_sign_post|signpost|wayfinding sign|notice|event notice|muster notice|processional start sign|ferry.*sign|property marker|supply marker|plaza banner|laundry|cloth marker|signal brazier)/i.test(h)) {
    return false;
  }
  return Boolean(
    /(lantern_wall|church_lantern|torch_mounted|wall-mounted|wall mounted|mounted on|mounted beside|wall bracket|wall post|against .*wall|against .*side|attached to|wall lamp|wall lantern|wall shelf|wall bookcase|window|plaque)/i.test(h)
  );
}

const wallFixtures = placements.filter(isWallClientFixture);

if (wallFixtures.length >= 8) {
  pass("wall/client-attached fixture placements are detected");
} else {
  fail("wall/client-attached fixture placements are detected", `found ${wallFixtures.length}`);
}

const anchorPattern = /(wall|mounted|against|attached|beside|on |onto|bracket|post|pillar|beam|fence|gate|entry|entrance|balcony|chapel|hall|tower|warehouse|shop|tavern|crypt|cemetery|counter|board|kiosk|roof|window|facade|frame|side)/i;
const failures = [];

for (const p of wallFixtures) {
  if (!anchorPattern.test(p.name)) {
    failures.push(`line ${p.line}: ${p.name} (${p.asset}) in ${p.district} should name its wall/client/anchor object`);
  }
}

if (failures.length) {
  fail("wall/client fixtures name their wall, bracket, side, or anchor object", failures.slice(0, 60));
} else {
  pass("wall/client fixtures name their wall, bracket, side, or anchor object");
}

const requiredPatterns = [
  ["tavern wall lanterns explicitly mounted", /Wall-mounted lantern/i],
  ["Noble wall lamps explicitly mounted", /Wall lamp mounted beside Reeve Hall balcony/i],
  ["crypt torch has wall bracket", /Crypt disturbance warning torch mounted on crypt wall bracket/i],
  ["Underways breadcrumb has wall post", /Green torchlight breadcrumb toward Underways stair mounted on Underways stair wall post/i],
  ["Mudden Underways torch has wall bracket", /Matching green torch at Mudden Underways connection mounted on Mudden Underways wall bracket/i],
  ["wall/client fixtures include explicit anchor language", /mounted|wall bracket|wall post|against|attached|wall-mounted/i],
];

for (const [label, pattern] of requiredPatterns) {
  if (pattern.test(text)) pass(label);
  else fail(label, `Missing ${pattern}`);
}

// Guard against the exact mistake that started this: a fixture with a wall/mounted
// asset name but generic/floating description.
const suspicious = placements.filter((p) =>
  /(lantern_wall|church_lantern|torch_mounted)/i.test(p.asset) &&
  !/(wall|mounted|bracket|post|attached|against|beside)/i.test(p.name)
);
if (suspicious.length) {
  fail("mounted torch/lantern assets never have floating/generic descriptions", suspicious.map((p) => `line ${p.line}: ${p.name} (${p.asset})`));
} else {
  pass("mounted torch/lantern assets never have floating/generic descriptions");
}

console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
