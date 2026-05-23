#!/usr/bin/env node
// HARTHMERE_HUD_MAP_NAVIGATION_V112:
// Guards the black Systems menu after the no-debug-text UX pass. The menu must
// autofocus a real selectable control, keep arrow/Return inside the panel, and
// never surface authoring/debug language to players.
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
const inventory = read("src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx");
const shared = read("src/shared/harthmere/snapshot_grove_content_v75.ts");

ok(/SYSTEM_MENU_SELECTABLE_QUERY_V111/.test(hud), "Systems menu still has a single selectable-query for every tab");
ok(/data-harthmere-system-menu-v111="true"/.test(hud), "black Systems menu root remains test-tagged");
ok(/data-harthmere-systems-auto-focus-v112="true"/.test(hud), "black Systems menu opts into v112 autofocus");
ok(/findHarthmereSystemsMenuInitialFocusV112/.test(hud), "black Systems menu has a deterministic initial-focus helper");
ok(/data-harthmere-auto-focus-v112/.test(hud) && /data-harthmere-tutorial-item-highlight-v111/.test(hud), "autofocus prefers quest/item affordances before generic buttons");
ok(/requestAnimationFrame/.test(hud) && /focusHarthmereSystemMenuElementV111/.test(hud), "menu focuses and scrolls a real visible element after render");
for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Enter"]) {
  ok(hud.includes(`"${key}"`), `black Systems menu supports ${key}`);
}
ok(/isTextEntryElementV111\(event\.target\)/.test(hud), "keyboard handler still refuses to steal arrows/Return from text inputs");
ok(/root\.contains\(event\.target as Node\)/.test(hud), "keyboard handler remains scoped inside the menu so chat Return stays separate");
ok(!hud.includes("Tutorial target in this tab"), "black menu does not show authoring/debug tutorial text");
ok(!hud.includes("Use arrows to jump through"), "black menu does not show implementation instructions as player copy");

ok(/HARTHMERE_INVENTORY_TUTORIAL_ITEM_HIGHLIGHT_V111/.test(inventory), "inventory still has the tutorial item highlight system");
ok(/data-harthmere-auto-focus-v112=\{highlighted/.test(inventory), "highlighted backpack rows become autofocus targets");
ok(/data-harthmere-primary-action-v112=\{highlighted/.test(inventory), "highlighted item primary actions can receive focus first");
ok(/tabIndex=\{highlighted \? 0/.test(inventory), "highlighted item rows are keyboard focusable");
ok(/setTab\("backpack"\)/.test(inventory), "inventory switches back to backpack when the needed item is there");
ok(/setTab\("wallet"\)/.test(inventory), "inventory switches to wallet/materials when the needed material is there");
ok(!inventory.includes("Tutorial item target"), "inventory does not show debug tutorial target copy");
ok(!inventory.includes("Tutorial needs this item"), "item rows do not show debug tutorial copy");
for (const itemId of ["road_ration", "minor_healing_salve", "mudroot", "wild_berries", "softwood_log", "rough_stone", "cloth_scrap", "scrap_metal", "iron_key_blank"]) {
  ok(inventory.includes(`"${itemId}"`), `inventory highlight can target ${itemId}`);
}

ok(/SnapshotGroveMiniMapQuestMarkersV111/.test(minimap), "minimap still renders independent Snapshot Grove quest/item pins");
ok(/data-snapshot-grove-minimap-item-v111/.test(minimap), "minimap item/pickup pins remain testable");
ok(/data-snapshot-grove-minimap-active-v111/.test(minimap), "minimap active objective pin remains testable");
ok(/groveQuestMarkerRowsV111/.test(quests), "center map still builds per-step active quest marker rows");
ok(/data-snapshot-grove-center-map-item-v111/.test(quests), "center map item pins remain testable");
ok(/data-snapshot-grove-center-map-item-list-v111/.test(quests), "center map keeps active lesson item-stop list support");

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
ok(questBlocks.length >= 25, "v112 quest authoring test parses all Grove quests");
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
  console.error(`v112 HUD/map/navigation check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log("v112 HUD/map/navigation check passed");
