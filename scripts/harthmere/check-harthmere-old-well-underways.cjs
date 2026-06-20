#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const file = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");

const checks = [
  ["version constant exists", /HARTHMERE_OLD_WELL_UNDERWAYS_VERSION/],
  ["base old drain still exists", /Old drain iron hatch[\s\S]*Mounted Underways warning torch[\s\S]*Old drain marker/],
  ["Old Well ring and grate landmark exist", /Old Well cracked circular stone ring landmark[\s\S]*Old Well iron grate covering barred shaft[\s\S]*Rusty chain wrapped around Old Well grate/],
  ["barred well fencing exists", /North iron bar fence around Old Well shaft[\s\S]*South iron bar fence around Old Well shaft[\s\S]*West iron bar fence around Old Well shaft[\s\S]*East iron bar fence around Old Well shaft/],
  ["mossy stones and carved pillar exist", /Mossy displaced stone from cracked Old Well rim[\s\S]*Moss-grown stone beside Old Well grate[\s\S]*Old carved Harthmere drain pillar[\s\S]*Rubbing of old drain carvings pinned to pillar/],
  ["bronze bell clues exist", /Bronze bell fragment faintly ringing beside Old Well[\s\S]*Second bronze bell shard half-buried near drain marker/],
  ["green candle and torch breadcrumbing exists", /Green-tinged candle at whispering well edge[\s\S]*Green-tinged candle at sealed drain edge[\s\S]*Green torchlight breadcrumb toward Underways stair/],
  ["hidden drain stair and dungeon proxy exist", /Hidden drain stair revealed by Old Well quest phase[\s\S]*Underways dungeon entrance proxy behind old drain stair[\s\S]*Wet stone boundary wall at Underways breach/],
  ["drain breach and exit breadcrumb exist", /Drain breach broken masonry event anchor[\s\S]*Exit breadcrumb torch inside Underways breach[\s\S]*Damp cloth marker for Underways exit breadcrumb/],
  ["discovery and clue boards exist", /Hidden map marker sign unlocked after Old Well discovery[\s\S]*Old Well warning note supported on discovery sign[\s\S]*Temple Green clue board pointing to missing bell underways[\s\S]*Father Aldren chapel rubbing supported on clue board/],
  ["supported investigation props exist", /Safety rope tied beside hidden drain stair[\s\S]*Old bucket lowered into whispering well[\s\S]*Lore notes from old archive supported on stone ledge[\s\S]*Investigation candle cluster supported beside lore notes/],
  ["Mudden connection exists", /Mudden tunnel connection grate tied to Old Well Underways[\s\S]*Matching green torch at Mudden Underways connection/],
  ["Temple connection exists", /Temple vigil candle aligned with Old Well missing bell clue[\s\S]*Temple prayer note naming the Old Well/],
  ["child dare and night bell anchors exist", /Child dare event warning near Old Well[\s\S]*Child dare note supported on Old Well warning post[\s\S]*Night bell event candle at Old Well[\s\S]*Second night bell event candle at Old Well/],
  ["undead emergence anchor exists", /Phase-safe collapsed stone marker for undead emergence[\s\S]*Sealed coffin prop for ancient spirit emergence event/],
  ["Father Aldren investigation actor exists", /Father Aldren investigating Old Well missing bell clue/],
  ["Nessa Underways access actor exists", /Nessa Crowe Underways access contact at hidden drain stair/],
  ["gravekeeper and old woman witness exist", /Gravekeeper watching Old Well stones[\s\S]*Old woman witness hearing well whispers/],
  ["child dare and ghostly cue actors exist", /Child dare event NPC near barred Old Well[\s\S]*Ghostly audio cue ancient spirit silhouette/],
  ["night bell crow reaction exists", /Crow reacting to night bell whisper/],
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
  /Old Well[^\n]+Blocks path/i,
  /Old Well[^\n]+Doorway blocker/i,
  /Old Well[^\n]+Critical service/i,
  /Old Well[^\n]+unreachable/i,
];
for (const pattern of forbidden) {
  if (pattern.test(src)) {
    failed += 1;
    console.log("FAIL old well patch introduced an explicitly named blocker");
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
