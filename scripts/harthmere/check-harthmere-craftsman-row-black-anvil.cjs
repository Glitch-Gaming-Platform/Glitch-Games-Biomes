#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const file = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const src = fs.readFileSync(file, "utf8");

const checks = [
  ["version constant exists", /HARTHMERE_CRAFTSMAN_ROW_BLACK_ANVIL_VERSION/],
  ["Black Anvil Smithy building shell remains present", /Black Anvil Smithy/],
  ["Carpenter and Tailor Workshop building shell remains present", /Carpenter and Tailor Workshop/],
  ["smithy exterior has readable repair/training sign", /Black Anvil Smithy sign with repair and blacksmith training notice/],
  ["anvil sign symbol marks the shop", /Black Anvil hanging sign symbol supported below smithy sign/],
  ["forge banner and lamps improve exterior identity", /Black Anvil red forge banner beside smithy entrance[\s\S]*Craftsman Row forge glow lamp west of smithy[\s\S]*Craftsman Row forge glow lamp east of smithy/],
  ["chimney stack reinforces forge silhouette", /Black Anvil broad smoke stack base on roof[\s\S]*Black Anvil smoke stack top above forge/],
  ["profession lane sign covers multiple crafts", /Profession trainer lane sign for carpentry tailoring leatherworking and work orders/],
  ["forge station has fire coal and quench support", /Bright forge fire glow supported in stone forge mouth[\s\S]*Coal block pile on smithy floor beside forge[\s\S]*Loose coal pieces on smithy floor beside forge[\s\S]*Water quench bucket on floor beside hot forge[\s\S]*Quench water barrel on floor beside forge/],
  ["repair station has whetstone chain and bench-supported jobs", /Whetstone repair station supported beside smith workbench[\s\S]*Chain links and wagon rim repair coil on floor[\s\S]*Pickaxe repair job supported on forge assembly bench[\s\S]*Beginner blade work order supported on forge assembly bench[\s\S]*Axe head work order supported on forge assembly bench/],
  ["smith workbench has supported ledger and recipe stack", /Repair ledger supported on smith tool workbench[\s\S]*Blacksmith recipe stack supported on tool workbench/],
  ["crafting order board is visible", /Crafting order board for daily profession work orders[\s\S]*Pinned crafting order supported on work order board[\s\S]*Pinned repair contract supported on work order board[\s\S]*Completed crafting orders drop crate on floor below board/],
  ["carpentry station is represented", /Carpenter saw bench supported on workshop floor[\s\S]*Cut lumber stack beside carpenter saw bench[\s\S]*Carpentry order supported on saw bench/],
  ["tailoring station is represented", /Tailoring and weaving table with cloth support[\s\S]*Folded brown cloth supported on tailoring table[\s\S]*Folded green cloth supported on tailoring table[\s\S]*Tailor recipe note supported on cloth table/],
  ["leatherworking station is represented", /Leather drying rack at workshop edge[\s\S]*Leather hide supported on drying rack[\s\S]*Practice shield leather strap job leaning beside rack/],
  ["alchemy prep side station is represented", /Alchemy prep side table for crafting reagents[\s\S]*Small reagent bottles supported on alchemy prep table[\s\S]*Crafting solvent vial supported on alchemy prep table[\s\S]*Wax seal candle supported on alchemy prep table/],
  ["event anchors exist for bible content", /Rare ore delivery crate for Black Anvil event[\s\S]*Apprentice strike notice event anchor beside workshop[\s\S]*Stolen tools clue crate for Craftsman Row event[\s\S]*Crafting fair seasonal cloth marker above workshop lane/],
  ["Master Osric Vale is placed", /Master Osric Vale blacksmith trainer repair service/],
  ["Apprentice Luth is placed", /Apprentice Luth tending forge work orders/],
  ["carpentry trainer is placed", /Carpentry profession trainer at saw bench/],
  ["tailoring trainer is placed", /Tailoring and weaving profession trainer/],
  ["leatherworker trainer is placed", /Leatherworker profession trainer by drying rack/],
  ["rare ore runner is placed", /Rare ore delivery runner for Black Anvil/],
  ["quartermaster inspection role exists", /Guard quartermaster inspecting weapon repairs/],
  ["existing moving quartermaster loop remains", /Quartermaster walking loop/],
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

const forbiddenBlockingNames = [
  /P\([^\n]+"Craftsman Row"[^\n]+"Blocked smithy doorway/i,
  /P\([^\n]+"Craftsman Row"[^\n]+"Doorway blocker/i,
  /A\([^\n]+"Craftsman Row"[^\n]+"Blocking forge entrance/i,
];
for (const pattern of forbiddenBlockingNames) {
  if (pattern.test(src)) {
    failed += 1;
    console.log("FAIL craftsman patch introduced an explicitly named blocker");
  }
}

if (failed) {
  console.log(`\nRESULT: FAIL (${failed} checks failed)`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
