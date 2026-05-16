#!/usr/bin/env node
"use strict";
/* HARTHMERE_BELLBOUND_MISSING_DETAILS_EXPANSION_TEST_V2 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
let ok = true;

function pass(label) {
  console.log(`OK ${label}`);
}
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  const items = Array.isArray(detail) ? detail : String(detail || "").split("\n");
  for (const item of items.filter(Boolean).slice(0, 100)) {
    console.log(`  - ${item}`);
  }
}

console.log("== Harthmere Bellbound missing-detail expansion tests v2 ==");
console.log(`Root: ${root}`);
console.log("");

if (!fs.existsSync(assetsPath)) {
  fail("harthmere_assets.ts exists", `Missing ${assetsPath}`);
  console.log("\nRESULT: FAIL");
  process.exit(1);
}
pass("harthmere_assets.ts exists");

const src = fs.readFileSync(assetsPath, "utf8");
const marker = "// HARTHMERE_BELLBOUND_MISSING_DETAILS_EXPANSION_V2";
const markerIndex = src.indexOf(marker);
const ambientIndex = src.indexOf("// Ambient NPCs and animals", markerIndex);
const block = markerIndex >= 0 && ambientIndex > markerIndex ? src.slice(markerIndex, ambientIndex) : "";

function check(label, condition, detail) {
  if (condition) pass(label);
  else fail(label, detail || label);
}
function has(pattern) {
  return pattern.test(src);
}

check("Bellbound missing-details expansion marker exists", markerIndex >= 0, "Missing HARTHMERE_BELLBOUND_MISSING_DETAILS_EXPANSION_V2");
check("no new actors are added in missing-details expansion block", markerIndex >= 0 && !block.includes("A("), "Found A( actor placement inside expansion block");

check("stable/tack interior support exists without NPCs", has(/stable tack ledger table[\s\S]*Stable lead rope coil[\s\S]*Mount feed and travel permit ledger[\s\S]*Stable tack cabinet/i));
check("guard command, jail, and armory interiors exist without NPCs", has(/Guard Barracks command table[\s\S]*Gate patrol roster[\s\S]*Town Watch wall shield[\s\S]*Barracks prisoner holding cell[\s\S]*Guard armory evidence chest/i));

const eightColumns = [
  "column one on floor showing wyrm over river mural",
  "column two on floor showing robed bell-ringer mural",
  "column three on floor showing wyrm landing on stone mural",
  "column four on floor showing great bell ringing mural",
  "column five on floor showing wyrm falling asleep mural",
  "column six on floor showing buried dragon mural",
  "column seven on floor showing chapel built over binding mural",
  "column eight on floor showing town growing around chapel mural",
];
const missingColumns = eightColumns.filter((needle) => !src.includes(needle));
check("Q6 antechamber has all eight Bellbinder mural columns", missingColumns.length === 0, missingColumns);

check("Q6 has founding mural reader and bell-notation descent stair", has(/Bellbinder founding mural reader stand[\s\S]*Bell-notation spiral stair floor marker[\s\S]*Carved bell-tone notation[\s\S]*Undercroft stair torch mounted/i));
check("Q7 has Sleepwalkers, Failed Apprentice, hidden alcove, and First Choir stage props", has(/Sleepwalkers encounter circle[\s\S]*Failed Apprentice alcove wall[\s\S]*Broken apprentice handbell[\s\S]*Hidden alcove cabinet[\s\S]*Choir-Singer's Ring[\s\S]*First Choir boss triad floor sigil/i));
check("Q10 has sealed tomb door, bell-clapper mechanism, four ritual bell stations, and Founder's Seal", has(/sealed bronze door with bell-clapper mechanism[\s\S]*Bell-clapper door mechanism[\s\S]*Group ritual bell station one[\s\S]*Group ritual bell station two[\s\S]*Group ritual bell station three[\s\S]*Group ritual bell station four[\s\S]*Founder's Seal medallion/i));
check("Q11 has bronze descent corridor, Compact, Bell-Mad, and Threshold Wyrm-Voice staging", has(/Bronze descent corridor[\s\S]*Compact Saboteurs ambush[\s\S]*Compact smuggling payoff crate[\s\S]*Bell-Mad tragedy wave threshold[\s\S]*Threshold Wyrm-Voice resonance pillar/i));
check("Q11 path ritual stations exist for Rebind, Slay, and Wake", has(/Rebind path Hammer ritual station[\s\S]*Rebind path Tuning Fork ritual station[\s\S]*Rebind path Chain ritual station[\s\S]*Rebind path Stole chant lectern[\s\S]*Rebind path Ring seal ritual station[\s\S]*Slay path three-stroke[\s\S]*Wake path greeting handbell/i));
check("Q12 Wyrm's Bed reads as a vast dragon chamber without adding boss actor", has(/Wyrm's Bed vast chamber floor ring marker[\s\S]*coiled dragon tail bronze-stone silhouette[\s\S]*Thaedryn low candle-flame eye glow[\s\S]*ribbed mural wall showing thousands of bell spirals/i));

const pLines = block.split(/\r?\n/).filter((line) => /\bP\("/.test(line));
check("missing-details expansion adds enough no-NPC staging placements", pLines.length >= 50, `found ${pLines.length}`);

const badElevated = pLines.filter((line) =>
  /GROUND_Y\s*\+\s*(?:0\.[4-9]|1\.)/.test(line) &&
  !/(supported|mounted|hanging|against|on floor|set into floor|floor channel|suspended|anchor|pit|rim|plinth|shelf|table|wall|ceiling|face|bracket|stand|lectern|station|channel)/i.test(line)
);
check("new elevated props describe believable support", badElevated.length === 0, badElevated);

const forbidden = pLines.filter((line) => /townsperson|animal_|npc_|guard_actor|dragon_actor/i.test(line));
check("missing-details expansion does not sneak NPC, animal, or boss actor assets into P placements", forbidden.length === 0, forbidden);

console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
process.exit(ok ? 0 : 1);
