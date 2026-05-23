#!/usr/bin/env node
// HARTHMERE_HUD_MAP_NAVIGATION_V111:
// Guards the black Systems menu, keyboard traversal, tutorial item row
// highlighting, and both map surfaces after the 2026-05-22 onboarding bug pass.
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
let failures = 0;
function ok(cond, msg) {
  if (cond) console.log(`OK ${msg}`);
  else { failures += 1; console.error(`FAIL ${msg}`); }
}

const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const minimap = read("src/client/components/MiniMapHUD.tsx");
const quests = read("src/client/components/challenges/LocalDevHarthmereQuests.tsx");
const runtime = read("src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx");
const inventory = read("src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx");
const shared = read("src/shared/harthmere/snapshot_grove_content_v75.ts");

ok(runtime.includes("snapshot-grove-mission-critical-v111"), "runtime version is bumped to v111 for the black-menu/map usability pass");
ok(runtime.includes("snapshot-grove-black-menu-highlight-v111"), "tutorial highlight broadcasts include v111 metadata for debug dumps");
ok(/detail:\s*\{ labels, chips/.test(runtime), "tutorial highlight event carries both nav labels and raw guidance chips");

ok(/SYSTEM_MENU_SELECTABLE_QUERY_V111/.test(hud), "Systems menu defines a single selectable-query for every tab");
for (const selector of ["button:not", "a[href]", "input:not", "select:not", "textarea:not", "[role='button']", "[tabindex]"]) {
  ok(hud.includes(selector), `Systems menu keyboard selector includes ${selector}`);
}
ok(/data-harthmere-system-menu-v111="true"/.test(hud), "black Systems menu root is tagged for v111 navigation");
ok(/data-harthmere-system-content-v111="true"/.test(hud), "black Systems menu scroll/content body is tagged for tests");
ok(/onSystemMenuKeyboardNavigationV111/.test(hud), "black Systems menu owns a scoped arrow/return keyboard handler");
for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Enter"]) {
  ok(hud.includes(`"${key}"`), `black Systems menu supports ${key}`);
}
ok(/event\.key === "Enter" \|\| event\.key === " "/.test(hud), "Return/Space activation is explicitly handled");
ok(/isTextEntryElementV111\(event\.target\)/.test(hud), "keyboard handler refuses to steal arrows/Return from text inputs");
ok(/root\.contains\(event\.target as Node\)/.test(hud), "keyboard handler is scoped inside the menu so chat Return remains separate");
ok(/focusHarthmereSystemMenuElementV111/.test(hud), "arrow navigation moves real focus between menu items");
ok(/scrollIntoView\(\{ block: "nearest"/.test(hud), "focused menu controls scroll into view instead of hiding offscreen");
ok(/harthmereSystemsMenuJumpV111/.test(hud), "focused black-menu items get a visible jump animation");
ok(/data-harthmere-system-tutor-target-v111/.test(hud), "black-menu header shows when the current tutorial targets the active tab");
ok(/tabLabelToTutorNavLabelV111/.test(hud), "bottom HUD tutor labels are mapped into right-panel tabs");

ok(/HARTHMERE_INVENTORY_TUTORIAL_ITEM_HIGHLIGHT_V111/.test(inventory), "inventory has a v111 tutorial item highlight section");
ok(/SNAPSHOT_GROVE_QUESTS_V75/.test(inventory), "inventory resolves active tutorial objective text without a runtime import cycle");
for (const itemId of ["road_ration", "minor_healing_salve", "mudroot", "wild_berries", "softwood_log", "rough_stone", "cloth_scrap", "scrap_metal", "iron_key_blank"]) {
  ok(inventory.includes(`"${itemId}"`), `inventory tutorial highlight can target ${itemId}`);
}
ok(/data-harthmere-tutorial-item-highlight-v111/.test(inventory), "inventory rows/material rows expose tutorial item highlight data attributes");
ok(/data-harthmere-inventory-tutorial-items-v111/.test(inventory), "inventory panel explains which item the active tutorial needs");
ok(/highlighted=\{tutorialItemIdsV111\.has\(item\.itemId\)\}/.test(inventory), "backpack item rows receive active tutorial highlight state");

ok(/SnapshotGroveMiniMapQuestMarkersV111/.test(minimap), "minimap renders independent Snapshot Grove quest/item pins");
ok(/MiniMap>\s*\n\s*<SnapshotGroveMiniMapQuestMarkersV111/.test(minimap), "minimap overlay is mounted as a child of MiniMap");
ok(/quest\.markerIds/.test(minimap), "minimap iterates over every marker in the active quest, not just the selected step");
ok(/data-snapshot-grove-minimap-item-v111/.test(minimap), "minimap item/pickup pins have testable data attributes");
ok(/data-snapshot-grove-minimap-active-v111/.test(minimap), "minimap active objective pin has a testable data attribute");
ok(/snapshotGroveMiniMapPulseV111/.test(minimap), "active minimap quest pin visibly pulses");
ok(/worldToMinimapClippedCanvasCoordinates/.test(minimap), "minimap item pins use the same world-to-minimap projection as native markers");

ok(/groveQuestMarkerRowsV111/.test(quests), "center map builds per-step active quest marker rows");
ok(/groveMapMarkerIsQuestItemV111/.test(quests), "center map classifies lesson item/pickup/resource markers");
ok(/activeGroveItemMarkerIdsV111/.test(quests), "center map tracks active/future item markers separately");
ok(/data-snapshot-grove-center-map-item-v111/.test(quests), "center map item pins have testable data attributes");
ok(/data-snapshot-grove-center-map-item-list-v111/.test(quests), "center map shows an active lesson item-stop list");
ok(/data-snapshot-grove-center-map-item-row-v111/.test(quests), "center map item rows are individually testable");
ok(/Lesson item \/ pickup/.test(quests), "center map legend explains item/pickup pins");

// Parse all Grove quests and enforce that item-like steps have both a marker
// and a HUD/item path. This catches future quest-authoring regressions.
function extractArray(block, field) {
  const re = new RegExp(`${field}:\\s*\\[([\\s\\S]*?)\\],`);
  const match = block.match(re);
  return match ? [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
}
function findQuestBlocks(content) {
  const blocks = [];
  const start = content.indexOf("export const SNAPSHOT_GROVE_QUESTS_V75");
  const arrayStart = content.indexOf("[", start);
  const arrayEnd = content.indexOf("export const SNAPSHOT_GROVE_PLAYER_BUILDER_PRESETS_V75", arrayStart);
  const chunk = content.slice(arrayStart + 1, arrayEnd > 0 ? arrayEnd : content.length);
  let depth = 0, objStart = -1, inString = false, escaped = false;
  for (let i = 0; i < chunk.length; i++) {
    const ch = chunk[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") { if (depth === 0) objStart = i; depth += 1; }
    else if (ch === "}") {
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
ok(questBlocks.length >= 25, "v111 quest authoring test parses all Grove quests");
const itemStepRe = /food|ration|item|sample|root|berry|berries|stick|stone|bolt|key|crate|satchel|basket|bin|bandage|salve|medicine|workbench|drop/i;
for (const { id, block } of questBlocks) {
  const objectives = extractArray(block, "objectives");
  const triggers = extractArray(block, "triggers");
  const markers = extractArray(block, "markerIds");
  objectives.forEach((objective, index) => {
    if (!itemStepRe.test(objective)) return;
    ok(Boolean(markers[index]), `${id} item-like step ${index + 1} has a map marker`);
    ok(Boolean(triggers[index]), `${id} item-like step ${index + 1} has a trigger`);
    const markerId = markers[index];
    const markerResolves = markerId && (shared.includes(`id: "${markerId}"`) || (markerId.startsWith("npc_") && shared.includes(`id: "${markerId.slice(4)}"`)));
    ok(markerResolves, `${id} item-like step ${index + 1} marker ${markerId} resolves`);
  });
}

if (failures) {
  console.error(`v111 HUD/map/navigation check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log("v111 HUD/map/navigation check passed");
