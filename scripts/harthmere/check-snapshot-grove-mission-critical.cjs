#!/usr/bin/env node
// SNAPSHOT_GROVE_MISSION_CRITICAL:
// Guards the usability failures caught by the 2026-05-22 mission debug dump:
// missing/vanishing map markers, objectives pointing at cleared resources,
// HUD hints without selectable highlights, item pickup steps not counting in
// inventory, keyboard navigation gaps, and player/avatar builder still using
// only the flatter variant GLTF path.
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
let failures = 0;
function ok(cond, msg) {
  if (cond) console.log(`OK ${msg}`);
  else { failures += 1; console.error(`FAIL ${msg}`); }
}
function failIf(cond, msg) { ok(!cond, msg); }

const runtime = read("src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx");
const shared = read("src/shared/harthmere/snapshot_grove_content.ts");
const triggerContract = read("src/shared/harthmere/snapshot_grove_trigger_contract.ts");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const player = read("src/client/game/resources/player_mesh.ts");

ok(runtime.includes("snapshot-grove-mission-critical"), "runtime version is bumped to mission-critical current");
ok(
  /import\s*\{[\s\S]*\bgrantHarthmereItem\b[\s\S]*\}\s*from\s*"@\/client\/components\/challenges\/LocalDevHarthmereInventorySystem"/.test(runtime),
  "runtime can grant practice items through the real Harthmere inventory system"
);
ok(
  /function snapshotGrovePracticeItemForObjective\(/.test(runtime) &&
    runtime.includes("snapshotGrovePracticeItemFixtureForObjective"),
  "runtime maps mission objective text through the shared trigger contract"
);
ok(/function grantSnapshotGrovePracticeItem\(/.test(runtime), "runtime grants the practice pickup item when the contextual action is used");
ok(/itemId:\s*"mudroot"/.test(triggerContract), "Sticky Medicine/root-sample objectives grant/count a mudroot practice item");
ok(/itemId:\s*"road_ration"/.test(triggerContract), "Food lesson objectives grant/count a road ration item");
ok(/itemId:\s*"minor_healing_salve"/.test(triggerContract), "First-aid/medicine objectives grant/count a salve or practice bandage item");
for (const trigger of ["collect", "craft", "photo_post", "item_grant", "item_use", "item_update"]) {
  ok(new RegExp(`"${trigger}"`).test(runtime), `contextual practice action supports ${trigger} tutorial steps`);
}
ok(/grantedPracticeItem/.test(runtime), "practice action event records which item was granted for debug uploads");
ok(/kind: "snapshot_grove_practice_action"/.test(runtime), "practice actions use the existing GardenHose flow so quest progress advances consistently");

ok(/autoremoveWhenNear:\s*false/.test(runtime), "quest pins do not auto-remove just because the player walked near them");
ok(/All marked stops/.test(runtime), "mission HUD lists every marker/step, not just the current objective");
ok(/quest\.markerIds\.map/.test(runtime), "mission HUD iterates over every marker id in the quest definition");
ok(/snapshotGroveStepNavAidId\(stepIndex\)/.test(runtime), "each visible marker row can pin its own per-step nav aid");
ok(/snapshotGroveStepNavAidId\(objectiveIndex\)/.test(runtime), "active pin button refreshes the current step's nav aid id");
failIf(/position:\s*\[[0-9][^\n]*SNAPSHOT_GROVE_MARKER_Y/.test(shared), "no Grove static landmark uses the old non-live marker Y directly");
ok(/snapshotGroveMarkerPosition\(\[/.test(shared), "static landmarks are normalized through the live-marker position helper");

for (const chip of ["FOOD", "HEALTH", "GUILD", "STORAGE", "CRAFT", "ITEM"]) {
  ok(new RegExp(`highlights\\.add\\("${chip}"\\)`).test(runtime), `HUD highlights include ${chip} subitem guidance`);
}
for (const chip of ["FOOD", "ITEM", "QUEST_ITEM", "MATERIAL", "GEAR", "GUILD"]) {
  ok(new RegExp(`case "${chip}":`).test(runtime), `chip-to-nav mapping handles ${chip}`);
}
ok(/return \[\.\.\.highlights\]\.slice\(0, 6\)/.test(runtime), "HUD can show up to six guidance chips so food/guild/item substeps are not silently dropped");
ok(/Marked pickup:/.test(runtime), "HUD tells the player exactly what pickup item should appear/count for item objectives");

const legacySystemsPanelRetired =
  hud.includes("HARTHMERE_LEGACY_BIOMES_SYSTEMS_PANEL_RETIRED") &&
  hud.indexOf("return null;", hud.indexOf("HARTHMERE_LEGACY_BIOMES_SYSTEMS_PANEL_RETIRED")) > 0;
if (legacySystemsPanelRetired) {
  ok(legacySystemsPanelRetired, "retired Biomes Systems panel does not render stale current controls");
} else {
  ok(/data-harthmere-system-tablist="true"/.test(hud), "Biomes Systems panel has a current arrow-key navigable tablist");
  ok(/role="tablist"/.test(hud), "system panel tabs expose role=tablist");
  ok(/role="tab"/.test(hud), "system panel buttons expose role=tab");
  ok(/aria-selected=\{tab === entry\.id\}/.test(hud), "system panel tabs expose aria-selected state");
  ok(/data-harthmere-system-tab=\{entry\.id\}/.test(hud), "system panel tabs expose a stable data attribute for keyboard navigation tests");
  ok(/ArrowLeft/.test(hud) && /ArrowRight/.test(hud) && /ArrowUp/.test(hud) && /ArrowDown/.test(hud), "system panel tabs support arrow-key navigation in both axes");
  ok(/Home/.test(hud) && /End/.test(hud), "system panel tabs support Home/End keyboard shortcuts");
  ok(/nextButton\.focus\(\)/.test(hud), "system panel arrow navigation moves focus as well as changing content");
}

ok(/HARTHMERE_PLAYER_VOXEL_CONSTRUCTION/.test(player), "player mesh documents the voxel-construction current path");
ok(/addLocalDevPlayerBodyShellToObject\(\s*playerAnimatedMesh\.three,\s*id,\s*\{[\s\S]{0,120}applyInnerBodyConfig:\s*false/.test(player), "Harthmere variant-path players now receive the local-dev voxel body shell without double-scaling the GLTF");
ok(/harthmere-player-voxel-construction/.test(player), "player mesh tags the avatar for debug inspection as voxel-construction current");
ok(/options:\s*\{[\s\S]{0,220}applyInnerBodyConfig\?: boolean[\s\S]{0,220}\}\s*=\s*\{\}/.test(player), "player voxel body shell supports skipping duplicate inner-body scaling");

// Quest authoring coverage: every quest must have equal objective/trigger/marker lengths,
// all referenced markers must resolve to a landmark or NPC, and tutorial steps should not
// exceed the per-step nav aid range.
function extractArray(block, field) {
  const re = new RegExp(`${field}:\\s*\\[([\\s\\S]*?)\\],`);
  const match = block.match(re);
  return match ? [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
}
function findQuestBlocks(content) {
  const blocks = [];
  const start = content.indexOf("export const SNAPSHOT_GROVE_QUESTS");
  const arrayStart = content.indexOf("[", start);
  const arrayEnd = content.indexOf("export const SNAPSHOT_GROVE_PLAYER_BUILDER_PRESETS", arrayStart);
  const chunk = content.slice(arrayStart + 1, arrayEnd > 0 ? arrayEnd : content.length);
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < chunk.length; i++) {
    const ch = chunk[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && objStart >= 0) {
        const block = chunk.slice(objStart, i + 1);
        const idMatch = block.match(/id:\s*"([^"]+)"/);
        if (idMatch) blocks.push({ id: idMatch[1], block });
        objStart = -1;
      }
    }
  }
  return blocks;
}
const questBlocks = findQuestBlocks(shared);
ok(questBlocks.length >= 25, "current test parses the full Grove quest list, not just one tutorial");
for (const { id, block } of questBlocks) {
  const objectives = extractArray(block, "objectives");
  const triggers = extractArray(block, "triggers");
  const markers = extractArray(block, "markerIds");
  ok(objectives.length > 0, `${id} has at least one objective`);
  ok(objectives.length === triggers.length, `${id} has one trigger per objective (${triggers.length}/${objectives.length})`);
  ok(objectives.length === markers.length, `${id} has one marker per objective (${markers.length}/${objectives.length})`);
  ok(markers.length <= 12, `${id} stays inside the 12-step nav-aid ceiling`);
  for (const marker of markers) {
    const staticLandmark = shared.includes(`id: "${marker}"`);
    const npcMarker = marker.startsWith("npc_") && shared.includes(`id: "${marker.slice(4)}"`);
    ok(staticLandmark || npcMarker, `${id} marker ${marker} resolves to a static landmark or NPC`);
  }
}

if (failures) {
  console.error(`current mission-critical check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log("current mission-critical check passed");
