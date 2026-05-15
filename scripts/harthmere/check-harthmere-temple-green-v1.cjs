#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const file = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");

const checks = [
  ["version constant exists", /HARTHMERE_TEMPLE_GREEN_VERSION/],
  ["base chapel shell still exists", /Ivory chapel body[\s\S]*Blue-gray chapel roof[\s\S]*Empty bell-frame clue/],
  ["temple service sign and banners exist", /Temple Green healer resurrection charity sign[\s\S]*Blue chapel healing banner mounted by entry[\s\S]*White chapel resurrection banner mounted by entry/],
  ["chapel entry lanterns and windows exist", /Temple entry lantern left of healing path[\s\S]*Temple entry lantern right of healing path[\s\S]*Lower stained-glass chapel window west wall[\s\S]*Lower stained-glass chapel window east wall[\s\S]*Upper stained-glass lantern window above altar/],
  ["resurrection altar service exists", /Resurrection altar service table[\s\S]*Left resurrection altar candles supported on altar[\s\S]*Right resurrection altar candles supported on altar[\s\S]*Open resurrection rite book supported on altar[\s\S]*Condition cleansing vial supported on altar[\s\S]*Resurrection point candle ring marker/],
  ["charity station exists", /Charity turn-in table beside chapel aisle[\s\S]*Donation coins supported on charity table[\s\S]*Charity bread supported on charity table[\s\S]*Charity ledger supported on charity table[\s\S]*Charity food crate on floor beside table[\s\S]*Apple charity crate on floor/],
  ["lore archive exists", /Chapel lore archive bookcase against east wall[\s\S]*Missing Bell lore bookstand near archive[\s\S]*Missing Bell archive clue supported on bookstand[\s\S]*Archive books stacked on floor by bookcase/],
  ["candle vigil support exists", /Prayer candle shelf fixed to chapel wall[\s\S]*Left candle rack for candle vigil[\s\S]*Right candle rack for candle vigil/],
  ["infirmary/healing corner exists", /Injured traveler cot in chapel infirmary corner[\s\S]*Healing tincture supported beside injured traveler cot[\s\S]*Clean water bucket beside infirmary cot[\s\S]*Sister Maelle healer chair beside infirmary cot/],
  ["cemetery depth exists", /Cemetery path quiet zone sign[\s\S]*Funeral procession notice supported on cemetery sign[\s\S]*Low cemetery wall at chapel boundary[\s\S]*Second low cemetery wall at chapel boundary[\s\S]*Leaning old grave marker near chapel[\s\S]*Family grave marker near cemetery path/],
  ["funeral and gravekeeper props exist", /Funeral procession coffin staging prop[\s\S]*Funeral candle supported on grave edge[\s\S]*Second funeral candle supported on grave edge[\s\S]*Gravekeeper spare shovel leaning against cemetery wall[\s\S]*Gravekeeper flower water bucket on ground/],
  ["crypt disturbance breadcrumb exists", /Crypt disturbance sealed crypt breadcrumb[\s\S]*Crypt disturbance warning torch/],
  ["River Blessing and plague prayer event anchors exist", /River Blessing processional start sign[\s\S]*River Blessing event route note supported on sign[\s\S]*River Blessing blue processional banner[\s\S]*Plague prayer offering table[\s\S]*Flood fever cure vial supported on plague prayer table[\s\S]*Plague prayer candle supported on offering table/],
  ["missing bell clues exist", /Frayed missing-bell rope beside empty bell frame[\s\S]*Tiny bronze missing-bell shard on altar stair/],
  ["Ysabet apothecary anchor props exist", /Green Mortar Apothecary healer referral sign[\s\S]*Ysabet Fenlow treatment hours note supported on apothecary sign[\s\S]*Ysabet Fenlow remedy bottles supported on treatment table[\s\S]*Flood fever cure recipe supported on treatment table/],
  ["Sister Maelle actor exists", /Sister Maelle chapel healer and condition cleansing NPC/],
  ["choir children exist", /Choir child candle vigil singer left[\s\S]*Choir child candle vigil singer right/],
  ["injured traveler and charity steward actors exist", /Injured traveler waiting for Sister Maelle[\s\S]*Chapel charity steward receiving turn-ins/],
  ["pilgrim and gravekeeper actors exist", /Pilgrim placing plague prayer offering[\s\S]*Gravekeeper maintaining quiet cemetery path/],
  ["crypt witness and cemetery crow exist", /Crypt disturbance witness by sealed crypt marker[\s\S]*Cemetery crow watching missing bell graves/],
  ["River Blessing and chapel vendor actors exist", /River Blessing procession organizer[\s\S]*Chapel reputation vendor and blessing quartermaster/],
  ["Ysabet Fenlow named actor exists", /Ysabet Fenlow Green Mortar Apothecary alchemy healer NPC/],
];

let failed = 0;
for (const [label, pattern] of checks) {
  if (pattern.test(src)) {
    console.log(`OK ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL ${label}`);
  }
}

const forbidden = [
  /Temple Green[^\n]+Blocks path/i,
  /Temple Green[^\n]+Doorway blocker/i,
  /Temple Green[^\n]+Critical service blocked/i,
  /Temple Green[^\n]+unreachable/i,
];
for (const pattern of forbidden) {
  if (pattern.test(src)) {
    failed += 1;
    console.log("FAIL temple patch introduced an explicitly named blocker");
  }
}

const usedAssets = Array.from(src.matchAll(/\b[PA]\(\s*"([^"]+)"/g)).map((m) => m[1]);
const registered = new Set(Array.from(src.matchAll(/\b(?:gltf|fbx|obj)\(\s*"([^"]+)"/g)).map((m) => m[1]));
const missing = Array.from(new Set(usedAssets.filter((asset) => !registered.has(asset)))).sort();
if (missing.length) {
  failed += 1;
  console.log(`FAIL unregistered placement assets: ${missing.join(", ")}`);
}

if (failed) {
  console.log(`\nRESULT: FAIL (${failed} checks failed)`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
