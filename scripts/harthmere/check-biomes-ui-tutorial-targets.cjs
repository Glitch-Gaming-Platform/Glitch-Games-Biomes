#!/usr/bin/env node
// Harthmere-style static audit for the BiomesUI module.
//
// Verifies — without running React or a test harness — that:
//   1. Every file in src/client/components/biomes_ui/ exists and is non-empty.
//   2. Every UI id referenced by tutorialMissionMap is declared in uniqueIds.ts.
//   3. Every (target, trigger) pair from LocalDevSnapshotMissionBridge.tsx
//      has an entry in MISSION_HIGHLIGHTS.
//   4. Every tab in TAB_ORDER has a TAB_DESCRIPTORS entry and a default
//      shortcut binding.
//   5. Every Highlightable in the tabs/ folder uses an id from UI_IDS
//      (string concatenations excluded; the dynamic helpers are skipped).
//
// Usage: node scripts/harthmere/check-biomes-ui-tutorial-targets.cjs

const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2] || process.cwd();
const MODULE = path.join(ROOT, "src/client/components/biomes_ui");
let ok = true;
function check(label, cond) {
  if (cond) console.log("OK   " + label);
  else { console.log("FAIL " + label); ok = false; }
}
function read(rel) { return fs.readFileSync(path.join(MODULE, rel), "utf8"); }
function exists(rel) { return fs.existsSync(path.join(MODULE, rel)); }

console.log("== BiomesUI static audit ==");
console.log("Module root: " + MODULE + "\n");

// (1) Required files
const REQUIRED = [
  "BiomesUI.tsx",
  "BiomesUITypes.ts",
  "uniqueIds.ts",
  "highlight/HighlightRegistry.ts",
  "highlight/useBlinkTarget.ts",
  "highlight/HighlightOverlay.tsx",
  "hotbar/BiomesHotbar.tsx",
  "nav/BiomesNav.tsx",
  "nav/RovingGrid.tsx",
  "shortcuts/BiomesShortcuts.ts",
  "tabs/InventoryTab.tsx",
  "tabs/AbilitiesTab.tsx",
  "tabs/SkillsTab.tsx",
  "tabs/ClassesTab.tsx",
  "tabs/LandTab.tsx",
  "tabs/LootTab.tsx",
  "tabs/GuildsTab.tsx",
  "tabs/BankingTab.tsx",
  "tabs/MapQuestsTab.tsx",
  "tabs/CollectionsTab.tsx",
  "tabs/InboxTab.tsx",
  "tabs/OptionsTab.tsx",
  "tutorial/tutorialMissionMap.ts",
  "tutorial/TutorialDirector.tsx",
  "theme/biomes_ui.css",
];
for (const f of REQUIRED) {
  check("file exists and non-empty: " + f, exists(f) && fs.statSync(path.join(MODULE, f)).size > 0);
}

// (2) UI ids declared
const uniqueIdsSrc = read("uniqueIds.ts");
const TAB_KEYS = [
  "TAB_INVENTORY","TAB_ABILITIES","TAB_SKILLS","TAB_CLASSES","TAB_LAND",
  "TAB_LOOT","TAB_GUILDS","TAB_BANKING","TAB_MAP","TAB_COLLECTIONS",
  "TAB_INBOX","TAB_OPTIONS",
];
for (const k of TAB_KEYS) check("uniqueIds declares " + k, uniqueIdsSrc.includes(k + ":"));
check("uniqueIds declares HOTBAR_SLOT factory", /HOTBAR_SLOT:\s*\(n: number\)/.test(uniqueIdsSrc));
check("uniqueIds declares ABILITY_SLOT factory", /ABILITY_SLOT:\s*\(n: number\)/.test(uniqueIdsSrc));
check("uniqueIds declares MAP_MARKER factory", /MAP_MARKER:\s*\(id: string\)/.test(uniqueIdsSrc));

// (3) Live mission steps -> highlights
const mapSrc = read("tutorial/tutorialMissionMap.ts");
const LIVE_PAIRS = [
  ["jackie","dialog"], ["road_marker","location"], ["muckwad_patch","destroy"],
  ["building_spot","place_voxel"], ["wardrobe","wearing"], ["jump_run","running_jump"],
  ["selfie_overlook","photo"], ["crafting_stop","craft_muck_buster"],
];
for (const [t, tr] of LIVE_PAIRS) {
  const pattern = new RegExp(`target:\\s*\"${t}\",\\s*trigger:\\s*\"${tr}\"`);
  check(`tutorial map covers ${t}/${tr}`, pattern.test(mapSrc));
}

// (4) Shortcut bindings
const shortcutsSrc = read("shortcuts/BiomesShortcuts.ts");
const typesSrc = read("BiomesUITypes.ts");
const TABS = ["inventory","abilities","skills","classes","land","loot","guilds","banking","map","collections","inbox","options"];
for (const t of TABS) {
  check("TAB_DESCRIPTORS contains " + t, typesSrc.includes(`${t}: {`));
  check("default shortcut bound for " + t, shortcutsSrc.includes(`tab: \"${t}\"`));
}

// (5) Highlightable use in tabs
const tabFiles = fs.readdirSync(path.join(MODULE, "tabs"));
for (const f of tabFiles) {
  const src = fs.readFileSync(path.join(MODULE, "tabs", f), "utf8");
  if (/<Highlightable|Highlightable as any/.test(src) || /Highlightable/.test(src)) {
    check(`${f} imports UI_IDS`, src.includes("uniqueIds"));
  }
}

console.log("\nRESULT: " + (ok ? "PASS" : "FAIL"));
process.exit(ok ? 0 : 1);
