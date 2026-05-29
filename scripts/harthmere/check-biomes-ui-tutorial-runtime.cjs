#!/usr/bin/env node
// Runtime smoke for tutorialMissionMap.

const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = process.argv[2] || process.cwd();
let ts;
try { ts = require(path.join(ROOT, "node_modules/typescript")); }
catch { console.log("SKIP typescript not installed"); process.exit(0); }

function compile(src) {
  return ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}
function loadFile(abs) {
  const raw = fs.readFileSync(abs, "utf8");
  const js = compile(raw);
  const m = new Module(abs);
  m.filename = abs.replace(/\.ts$/, ".js");
  m.paths = Module._nodeModulePaths(path.dirname(m.filename));
  m._compile(js, m.filename);
  return m.exports;
}

// Compile uniqueIds first, then patch require resolution for the tutorial map.
const uniqueIdsAbs = path.join(ROOT, "src/client/components/biomes_ui/uniqueIds.ts");
const mapAbs = path.join(ROOT, "src/client/components/biomes_ui/tutorial/tutorialMissionMap.ts");
const uniqueIdsExports = loadFile(uniqueIdsAbs);

const mapRaw = fs.readFileSync(mapAbs, "utf8");
const mapJs = compile(mapRaw);
// Replace "../uniqueIds" require with a literal we control.
const mapJsPatched = mapJs.replace(
  /require\(["']\.\.\/uniqueIds["']\)/g,
  "(globalThis.__UI_IDS__)"
);
globalThis.__UI_IDS__ = uniqueIdsExports;
const m = new Module(mapAbs);
m.filename = mapAbs.replace(/\.ts$/, ".js");
m._compile(mapJsPatched, m.filename);
const map = m.exports;

let ok = true;
function check(label, cond) {
  if (cond) console.log("OK   " + label);
  else { console.log("FAIL " + label); ok = false; }
}

const LIVE = [
  ["jackie","dialog"], ["road_marker","location"], ["muckwad_patch","destroy"],
  ["building_spot","place_voxel"], ["wardrobe","wearing"], ["jump_run","running_jump"],
  ["selfie_overlook","photo"], ["crafting_stop","craft_muck_buster"],
];
for (const [t, tr] of LIVE) {
  const cues = map.cuesForStep(t, tr);
  check(`cuesForStep('${t}','${tr}') returns >= 1 cue`, cues.length > 0);
  for (const c of cues) {
    check(`  cue id "${c.uniqueId}" well-formed`, /^[a-z0-9._]+$/i.test(c.uniqueId));
  }
}
check("cuesForStep with unknown pair returns []", map.cuesForStep("jackie", "photo").length === 0);
const openMapCues = map.cuesForAuthoredTutorialStep({
  questId: "fountain_buttons_first",
  objective: "Open the map and confirm the Grove marker is visible.",
  trigger: "open_tab",
  markerId: "the_grove",
});
check("authored open-map step flashes the open-menu prompt", openMapCues.some((c) => c.uniqueId === "hud.prompt.open_menu"));
check("authored open-map step flashes the map tab", openMapCues.some((c) => c.uniqueId === "tab.map"));
const statusCues = map.cuesForAuthoredTutorialStep({
  questId: "road_ready_bag_check",
  objective: "Check the health, stamina, and quick-action bars before walking away.",
  trigger: "status_check",
  markerId: "grove_hud_compass_ring",
});
check("authored status-check step flashes health/stamina HUD", statusCues.some((c) => c.uniqueId === "hud.vitals.health") && statusCues.some((c) => c.uniqueId === "hud.vitals.stamina"));

let captionsOk = true;
for (const entry of map.MISSION_HIGHLIGHTS) {
  for (const cue of entry.cues) {
    if (cue.caption && cue.caption.length > 30) {
      captionsOk = false;
      console.log("  long caption:", cue.caption);
    }
  }
}
check("all captions <= 30 chars", captionsOk);

console.log("\nRESULT: " + (ok ? "PASS" : "FAIL"));
process.exit(ok ? 0 : 1);
