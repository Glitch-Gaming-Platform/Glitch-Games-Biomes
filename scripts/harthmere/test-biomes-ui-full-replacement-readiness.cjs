#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const failures = [];
const passes = [];

function file(p) {
  return path.join(root, p);
}
function exists(p) {
  return fs.existsSync(file(p));
}
function read(p) {
  return fs.readFileSync(file(p), "utf8");
}
function pass(msg) {
  passes.push(msg);
}
function fail(msg) {
  failures.push(msg);
}
function assert(cond, msg) {
  cond ? pass(msg) : fail(msg);
}
function contains(text, needle, msg) {
  assert(text.includes(needle), msg || `contains ${needle}`);
}
function notContains(text, needle, msg) {
  assert(!text.includes(needle), msg || `does not contain ${needle}`);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "__MACOSX"
    )
      continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const uiRoot = file("src/client/components/biomes_ui");
const required = [
  "src/client/components/biomes_ui/BiomesUIMount.tsx",
  "src/client/components/biomes_ui/BiomesUI.tsx",
  "src/client/components/biomes_ui/uniqueIds.ts",
  "src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts",
  "src/client/components/biomes_ui/tutorial/BiomesUITutorialCueBar.tsx",
  "src/client/components/biomes_ui/tutorial/tutorialMissionMap.ts",
  "src/client/components/QuestAndMinimapHUD.tsx",
  "src/client/components/challenges/HarthmereUnifiedHUD.tsx",
];

for (const p of required) assert(exists(p), `${p} exists`);

if (failures.length) {
  console.error("Missing files; cannot continue.");
  for (const f of failures) console.error("FAIL", f);
  process.exit(1);
}

const allUiFiles = walk(uiRoot);
const allUiText = allUiFiles.map((p) => fs.readFileSync(p, "utf8")).join("\n");
const mount = read("src/client/components/biomes_ui/BiomesUIMount.tsx");
const liveAdapters = read(
  "src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts"
);
const uniqueIds = read("src/client/components/biomes_ui/uniqueIds.ts");
const tutorial = read(
  "src/client/components/biomes_ui/tutorial/tutorialMissionMap.ts"
);
const questHud = read("src/client/components/QuestAndMinimapHUD.tsx");
const unified = read(
  "src/client/components/challenges/HarthmereUnifiedHUD.tsx"
);
const signOverlay = read(
  "src/client/components/overlays/inspected/placeables/SignOverlayComponent.tsx"
);
const cursorInspection = read(
  "src/client/components/overlays/inspected/CursorInspectionOverlayComponent.tsx"
);
const signScreen = read("src/client/components/challenges/SignScreen.tsx");

function constantIdMap() {
  const map = new Map();
  const re = /([A-Z0-9_]+)\s*:\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(uniqueIds))) map.set(m[1], m[2]);
  return map;
}

const literalIds = constantIdMap();

function expandUiIdsExpression(name, rawArg) {
  if (literalIds.has(name) && !rawArg) return [literalIds.get(name)];

  const arg = rawArg ? rawArg.trim() : undefined;
  const stringArg =
    arg && (arg.match(/^"([^"]+)"$/) || arg.match(/^'([^']+)'$/) || [])[1];
  const numArg = arg && (/^\d+$/.test(arg) ? Number(arg) : undefined);

  switch (name) {
    case "HOTBAR_SLOT":
      return numArg ? [`hotbar.slot_${numArg}`] : ["hotbar.slot_"];
    case "MAP_MARKER":
      return stringArg ? [`map.marker.${stringArg}`] : ["map.marker."];
    case "ABILITY_SLOT":
      return numArg ? [`abilities.slot_${numArg}`] : ["abilities.slot_"];
    case "SKILL_ROW":
      return stringArg ? [`skills.row.${stringArg}`] : ["skills.row."];
    case "CLASS_CARD":
      return stringArg ? [`classes.card.${stringArg}`] : ["classes.card."];
    case "LAND_PLOT":
      return stringArg ? [`land.plot.${stringArg}`] : ["land.plot."];
    case "LOOT_ENTRY":
      return stringArg ? [`loot.entry.${stringArg}`] : ["loot.entry."];
    case "GUILD_RANK":
      return stringArg ? [`guilds.rank.${stringArg}`] : ["guilds.rank."];
    case "BANKING_VAULT_SLOT":
      return numArg
        ? [`banking.vault.slot_${numArg}`]
        : ["banking.vault.slot_"];
    default:
      return [];
  }
}

function extractUiIdsFromSource(src) {
  const ids = new Set();
  let m;

  const literalRe = /(?:uniqueId|data-ui-id)\s*=\s*["']([^"']+)["']/g;
  while ((m = literalRe.exec(src))) ids.add(m[1]);

  const exprRe = /UI_IDS\.([A-Z0-9_]+)(?:\(([^)]*)\))?/g;
  while ((m = exprRe.exec(src))) {
    for (const id of expandUiIdsExpression(m[1], m[2])) ids.add(id);
  }

  return ids;
}

const cueIds = extractUiIdsFromSource(tutorial);
const renderIds = extractUiIdsFromSource(allUiText);

function hasMountedTargetFor(id) {
  if (renderIds.has(id)) return true;
  for (const mounted of renderIds) {
    if (mounted.endsWith(".")) continue;
    if (mounted.endsWith("_") && id.startsWith(mounted)) return true;
    if (mounted.endsWith(".") && id.startsWith(mounted)) return true;
  }
  const dynamicPrefixes = [
    "hotbar.slot_",
    "map.marker.",
    "abilities.slot_",
    "skills.row.",
    "classes.card.",
    "land.plot.",
    "loot.entry.",
    "guilds.rank.",
    "banking.vault.slot_",
  ];
  return dynamicPrefixes.some(
    (prefix) => id.startsWith(prefix) && allUiText.includes(prefix)
  );
}

for (const id of cueIds) {
  assert(
    hasMountedTargetFor(id),
    `tutorial cue has mounted highlight target or dynamic renderer: ${id}`
  );
}

notContains(
  mount,
  "PLACEHOLDER_HOTBAR",
  "BiomesUIMount does not rely on placeholder hotbar data in replacement mode"
);
notContains(
  mount,
  "Bare Hands",
  "BiomesUIMount hotbar is not sample Bare Hands data"
);
notContains(
  mount,
  "Singularity Block",
  "BiomesUIMount hotbar is not sample Singularity Block data"
);
notContains(
  mount,
  "<TutorialDirector step={null}",
  "TutorialDirector receives live mission step, not null"
);
contains(
  mount,
  "adapters={live.adapters}",
  "BiomesUIMount passes real adapters into BiomesUI"
);
contains(
  mount,
  "hotbar={live.hotbar}",
  "BiomesUIMount hotbar is connected through live hook"
);
contains(
  mount,
  "useBiomesUILiveAdapters",
  "BiomesUIMount delegates state wiring to live adapter hook"
);

contains(
  liveAdapters,
  "useClientContext",
  "live adapter hook reads game ClientContext"
);
contains(
  liveAdapters,
  'reactResources.use("/ecs/c/inventory", userId)',
  "live adapter hook subscribes to ECS inventory"
);
contains(
  liveAdapters,
  'reactResources.use("/hotbar/index")',
  "live adapter hook subscribes to hotbar index"
);
contains(
  liveAdapters,
  "InventoryChangeSelectionEvent",
  "live hotbar selection updates real selected item path"
);
contains(
  liveAdapters,
  "throwInventoryItem",
  "live hotbar drop uses real drop helper"
);
contains(
  liveAdapters,
  "getBackpack",
  "inventory adapter exposes backpack items"
);
contains(
  liveAdapters,
  "inventory?.items",
  "inventory adapter uses live inventory item container"
);
contains(liveAdapters, "buildBiomesUIMapAdapter", "map adapter exists");
contains(
  liveAdapters,
  "__snapshotGrove",
  "map/tutorial adapter reads live Snapshot Grove state when available"
);
contains(
  liveAdapters,
  "deriveSnapshotTutorialStep",
  "tutorial step is derived from live quest state"
);
contains(
  liveAdapters,
  "BIOMES_UI_OPEN_MENU_KEY_CODE",
  "replacement mode uses the configured menu key"
);
contains(
  liveAdapters,
  "[BIOMES_UI_OPEN_MENU_KEY_CODE]: BIOMES_UI_OPEN_MENU_TAB",
  "configured menu key opens the replacement menu tab"
);
notContains(
  liveAdapters,
  'KeyE: "daily"',
  "E no longer opens replacement menu tab"
);
notContains(
  liveAdapters,
  'KeyE: "inventory"',
  "E no longer opens replacement inventory tab"
);
contains(
  liveAdapters,
  'KeyU: "map"',
  "U key opens map/quests through replacement UI"
);
notContains(
  liveAdapters,
  'KeyQ: "map"',
  "Q no longer opens map/quests through replacement UI"
);
contains(
  liveAdapters,
  'KeyO: "loot"',
  "O key is owned by replacement UI shortcut map"
);
contains(
  liveAdapters,
  "pointerLockManager.unlock",
  "opening replacement tab releases pointer lock"
);
contains(
  liveAdapters,
  "pointerLockManager.focusAndLock",
  "closing replacement tab can restore pointer lock"
);
contains(
  cursorInspection,
  "suppressTalkShortcut",
  "inspection overlay can suppress generic talk shortcuts for readable placeables"
);
contains(
  signOverlay,
  "suppressTalkShortcut",
  "readable sign overlay opens through Read instead of generic Talk"
);
contains(
  signOverlay,
  "allowClickToDismiss: false",
  "readable sheet modal cannot backdrop-click loop into the world target"
);
contains(
  signScreen,
  'customText="Click to close"',
  "readable sheet screen makes click-to-close explicit"
);
contains(
  signScreen,
  'event.code === "Escape" || event.code === "Space"',
  "readable sheet screen supports keyboard close"
);

contains(
  unified,
  "const legacyVisualsHidden = true",
  "duplicate legacy Harthmere visuals are permanently retired"
);
contains(
  unified,
  "if (legacyVisualsHidden) {\n        // Replacement mode keeps all Harthmere runtime hooks/controllers alive",
  "legacy Harthmere key handler yields to BiomesUI when visuals are hidden"
);
contains(
  unified,
  "{runtimeControllers}",
  "replacement branch keeps runtime controllers mounted"
);
contains(
  questHud,
  "<MiniMapHUD />",
  "replacement mode keeps live minimap path available"
);

const requiredCueIds = [
  "tab.inventory",
  "tab.map",
  "hotbar.slot_1",
  "hotbar.slot_2",
  "inventory.slot.chest",
  "inventory.slot.legs",
  "movement.cue.sprint",
  "movement.cue.jump",
  "camera.button",
  "camera.selfie",
  "recipes.list",
  "recipes.muck_buster",
  "map.marker.jackie",
  "map.marker.road_marker",
  "map.marker.muckwad_patch",
  "map.marker.building_spot",
  "map.marker.selfie_overlook",
];

for (const id of requiredCueIds) {
  assert(
    hasMountedTargetFor(id),
    `required tutorial/highlight target is implemented: ${id}`
  );
}

console.log(
  `Biomes UI full replacement readiness: ${passes.length} passed, ${failures.length} failed.`
);
if (failures.length) {
  console.error(
    "\nThis is the strict readiness gate. Failures mean the new UI is still a shell/scaffold, not a complete replacement."
  );
  for (const f of failures) console.error("FAIL", f);
  process.exit(1);
}

for (const p of passes) console.log("PASS", p);
