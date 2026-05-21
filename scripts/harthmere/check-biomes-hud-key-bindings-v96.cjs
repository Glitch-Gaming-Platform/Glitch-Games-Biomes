#!/usr/bin/env node
/* BIOMES_HUD_KEY_BINDINGS_V96_STATIC_CHECK
 * Dependency-free check for the local-dev HUD key wiring. This catches the UI bugs the screenshots exposed
 * even when the full repo test harness/node_modules are not installed.
 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const fail = (message) => {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
};
const ok = (message) => console.log(`OK ${message}`);

const bindings = read("src/shared/harthmere/harthmere_hud_key_bindings_v96.ts");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const combat = read("src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx");
const inventory = read("src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx");
const gathering = read("src/client/components/challenges/LocalDevHarthmereGatheringSystem.tsx");
const quests = read("src/client/components/challenges/LocalDevHarthmereQuests.tsx");

const expected = [
  ["inventory", "KeyI", "inventory"],
  ["crafting", "KeyC", "world"],
  ["map", "KeyM", "map"],
  ["quests", "KeyJ", "quests"],
  ["tasks", "KeyK", "journal"],
  ["mail", "KeyY", "world"],
  ["notifications", "KeyN", "journal"],
  ["codex", "KeyV", "dialogue"],
  ["settings", "Escape", "world"],
];

for (const [action, code, target] of expected) {
  const actionRe = new RegExp(`action:\\s*"${action}"`);
  const codeRe = new RegExp(`code:\\s*"${code}"`);
  const clickRe = new RegExp(`onAction\\("${action}"\\)`);
  if (!actionRe.test(bindings)) fail(`missing action ${action} in central HUD bindings`); else ok(`central binding includes ${action}`);
  if (!codeRe.test(bindings)) fail(`missing key code ${code} for ${action}`); else ok(`${action} uses ${code}`);
  if (!clickRe.test(hud)) fail(`bottom action bar does not call ${action}`); else ok(`bottom action bar calls ${action}`);
  if (target !== "map" && target !== "quests") {
    const targetRe = new RegExp(`targetTab:\\s*"${target}"`);
    if (!targetRe.test(bindings)) fail(`${action} does not target ${target}`); else ok(`${action} targets ${target}`);
  }
}

if (/export function reduceHarthmereHudStateForActionV97/.test(hud)) ok("HUD action reducer is exported for unit testing"); else fail("HUD action reducer export missing");
if (/initialAction=\{focusAction\}/.test(hud)) ok("systems panel receives the triggering action context"); else fail("systems panel is missing action-context highlighting");
if (/focusAction:\s*action/.test(hud) && /state\.focusAction === action/.test(hud)) ok("shared-tab key actions preserve distinct entry context and still toggle closed when repeated"); else fail("HUD reducer does not preserve shared-tab key context");
if (/hudMapRegionForPlayerPositionV97/.test(quests) && /The Grove field map/.test(quests)) ok("quest map adapts to the player's current region"); else fail("quest map still does not adapt to The Grove vs Harthmere");

if (/HarthmereCombatNameplateHUD/.test(hud)) fail("central combat nameplate panel still exists"); else ok("removed center-screen enemy health panel");
if (/HarthmereEnemyHealthBarsHUD/.test(hud)) ok("enemy HP bars are actor-anchored HUD overlays"); else fail("missing actor-anchored enemy HP bars");
if (/heavy:\s*"KeyN"|code === "KeyN"/.test(combat)) fail("combat still steals KeyN from notifications"); else ok("combat no longer steals KeyN from notifications");
if (/heavy:\s*"KeyH"/.test(combat)) ok("heavy attack moved to H to avoid notification conflict"); else fail("heavy attack was not moved to KeyH");
if (/harthmereResourceIconForItemV96/.test(inventory) && /🪵|⛏️|🌿|🦴/.test(inventory)) ok("inventory resource icons are item-specific"); else fail("inventory material icons still look generic");
if (/harthmereGatheringResourceIconV96/.test(gathering)) ok("gathering storage shows resource-specific icons"); else fail("gathering storage still lacks resource icons");

const iconPaths = [
  "/hud/icon-32-heart.png",
  "/hud/icon-16-heart-filled-bordered.png",
  "/hud/icon-16-heart-bordered.png",
  "/assets/harthmere/png/icons/quaternius_rpg_items/Sword.png",
  "/hud/permissions-claim.png",
  "/hud/wand-of-grouping.png",
  "/hud/icon-current-location-24.png",
  "/hud/player-marker-small.png",
  "/hud/icon-32-challenges.png",
  "/hud/nav/inventory.png",
  "/hud/nav/map.png",
  "/hud/nav/crafting.png",
  "/hud/nav/challenges.png",
  "/hud/nav/inbox.png",
  "/hud/nav/notifications.png",
  "/hud/nav/collections-closed.png",
  "/hud/nav/settings.png",
];
for (const publicPath of iconPaths) {
  const filePath = path.join(root, "public", publicPath.replace(/^\//, ""));
  if (fs.existsSync(filePath)) ok(`icon asset exists ${publicPath}`); else fail(`missing HUD icon asset ${publicPath}`);
}

if (process.exitCode) process.exit(process.exitCode);
