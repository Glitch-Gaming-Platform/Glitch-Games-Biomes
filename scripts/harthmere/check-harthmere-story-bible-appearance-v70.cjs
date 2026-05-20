#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repo = process.cwd();
const file = path.join(repo, "src/shared/harthmere/voxel_faces.ts");
const text = fs.readFileSync(file, "utf8");

function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${message}`);
  }
}

ok(text.includes("HARTHMERE_STORY_BIBLE_APPEARANCE_VERSION_V70"), "story bible appearance marker exists");
ok(text.includes("harthmere-story-bible-appearance-v70"), "story bible version string exists");
ok(text.includes("applyHarthmereStoryBibleAppearanceProfileV70(input, baseAppearance)"), "NPC generation applies story-bible profile after base appearance");
ok(text.includes("harthmereStoryBiblePlayerDefaultClothingV70(body)"), "player default clothing uses story-bible default");
ok(text.includes("bellbound_traveler_v70"), "player Bellbound Traveler preset exists");
ok(text.includes("bellbound_watch_v70"), "player Town Watch Ally preset exists");
ok(text.includes("bellbound_chapel_v70"), "player Chapel Initiate preset exists");
ok(text.includes("bellbound_mudden_v70"), "player Mudden Ward Survivor preset exists");
ok(text.includes("town_watch_red_black"), "Town Watch bible profile exists");
ok(text.includes("chapel_circle_verenine"), "Chapel/Faith bible profile exists");
ok(text.includes("merchant_compact_polished"), "Merchant Compact bible profile exists");
ok(text.includes("mudden_ward_scrap_layers"), "Mudden Ward bible profile exists");
ok(text.includes("wilds_warden_hunter"), "Wilds/Hunter bible profile exists");
ok(text.includes("wilds_moss_woman_veneth"), "Moss-Woman/Veneth bible profile exists");
ok(text.includes("craftsman_black_anvil"), "Black Anvil/crafter bible profile exists");

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("v70 Harthmere story-bible appearance check passed");
