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
function count(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

const required = [
  "src/client/components/biomes_ui/BiomesUI.tsx",
  "src/client/components/biomes_ui/BiomesUIMount.tsx",
  "src/client/components/biomes_ui/BiomesUIFlags.ts",
  "src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts",
  "src/client/components/biomes_ui/theme/biomesUITheme.ts",
  "src/client/components/biomes_ui/highlight/HighlightRegistry.ts",
  "src/client/components/biomes_ui/highlight/HighlightOverlay.tsx",
  "src/client/components/biomes_ui/hotbar/BiomesHotbar.tsx",
  "src/client/components/biomes_ui/nav/BiomesNav.tsx",
  "src/client/components/biomes_ui/nav/RovingGrid.tsx",
  "src/client/components/biomes_ui/tutorial/BiomesUITutorialCueBar.tsx",
  "src/client/components/QuestAndMinimapHUD.tsx",
  "src/client/components/BiomesChrome.tsx",
  "src/client/components/challenges/HarthmereUnifiedHUD.tsx",
  "src/client/game/renderers/local_dev/harthmere_assets.ts",
];

for (const p of required) assert(exists(p), `${p} exists`);

if (failures.length) {
  console.error("Missing required files; cannot continue.");
  for (const f of failures) console.error("FAIL", f);
  process.exit(1);
}

const biomesUI = read("src/client/components/biomes_ui/BiomesUI.tsx");
const mount = read("src/client/components/biomes_ui/BiomesUIMount.tsx");
const flags = read("src/client/components/biomes_ui/BiomesUIFlags.ts");
const types = read("src/client/components/biomes_ui/BiomesUITypes.ts");
const adapters = read(
  "src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts"
);
const quest = read("src/client/components/QuestAndMinimapHUD.tsx");
const chrome = read("src/client/components/BiomesChrome.tsx");
const unified = read(
  "src/client/components/challenges/HarthmereUnifiedHUD.tsx"
);
const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const theme = read("src/client/components/biomes_ui/theme/biomesUITheme.ts");
const shortcuts = read(
  "src/client/components/biomes_ui/shortcuts/BiomesShortcuts.ts"
);
const hotbar = read("src/client/components/biomes_ui/hotbar/BiomesHotbar.tsx");
const nav = read("src/client/components/biomes_ui/nav/BiomesNav.tsx");
const grid = read("src/client/components/biomes_ui/nav/RovingGrid.tsx");
const cueBar = read(
  "src/client/components/biomes_ui/tutorial/BiomesUITutorialCueBar.tsx"
);

notContains(
  biomesUI,
  'import "./theme/biomes_ui.css"',
  "BiomesUI does not import global CSS directly"
);
notContains(
  biomesUI,
  "import './theme/biomes_ui.css'",
  "BiomesUI does not import global CSS directly, single-quote form"
);
contains(
  biomesUI,
  "installBiomesUITheme",
  "BiomesUI installs runtime theme instead of global CSS import"
);
contains(theme, 'document.createElement("style")', "theme injects a style tag");
contains(
  theme,
  "BIOMES_UI_THEME_ID",
  "theme exposes stable id constant for idempotency tests"
);
contains(
  theme,
  "document.getElementById(BIOMES_UI_THEME_ID)",
  "theme injection is idempotent by id"
);

contains(
  flags,
  "biomes_ui_replace_legacy",
  "replacement flag reads/writes localStorage key"
);
contains(
  flags,
  "biomes-ui-flags-changed",
  "replacement flag dispatches change event"
);
contains(
  flags,
  "NEXT_PUBLIC_BIOMES_UI_REPLACE_LEGACY",
  "replacement flag supports NEXT_PUBLIC env"
);
contains(
  flags,
  "useBiomesUIReplaceLegacyFlag",
  "replacement flag has React hook"
);

assert(
  /forceEnabled\??\s*:\s*boolean/.test(mount) ||
    /forceEnabled\s*=\s*false/.test(mount),
  "BiomesUIMount exposes forceEnabled prop"
);
contains(
  mount,
  "useBiomesUILiveAdapters",
  "BiomesUIMount uses live adapters instead of placeholder data"
);
contains(
  mount,
  "hotbar={live.hotbar}",
  "BiomesUIMount passes live hotbar into BiomesUI"
);
contains(
  mount,
  "adapters={live.adapters}",
  "BiomesUIMount passes adapters into BiomesUI"
);
contains(
  mount,
  "step={live.tutorialStep}",
  "TutorialDirector receives live tutorial step"
);
notContains(
  mount,
  "PLACEHOLDER_HOTBAR",
  "BiomesUIMount no longer declares placeholder hotbar data"
);
notContains(
  mount,
  "Bare Hands",
  "BiomesUIMount no longer uses sample item labels"
);
notContains(
  mount,
  "Singularity Block",
  "BiomesUIMount no longer uses sample block labels"
);

contains(adapters, "useClientContext", "live adapters read ClientContext");
contains(
  adapters,
  'reactResources.use("/ecs/c/inventory", userId)',
  "live adapters read ECS inventory"
);
contains(
  adapters,
  'reactResources.use("/hotbar/index")',
  "live adapters read hotbar index"
);
contains(
  adapters,
  "InventoryChangeSelectionEvent",
  "live hotbar selection publishes InventoryChangeSelectionEvent"
);
contains(
  adapters,
  "throwInventoryItem",
  "live hotbar drop delegates to real throwInventoryItem helper"
);
contains(
  types,
  'BIOMES_UI_RECIPES_SHORTCUT = "R"',
  "R remains the native Recipes shortcut"
);
contains(
  types,
  'BIOMES_UI_RECIPES_KEY_CODE = "KeyR"',
  "native Recipes key code remains KeyR"
);
notContains(
  adapters,
  'KeyR: "daily"',
  "replacement mode does not route R to Today"
);
notContains(
  adapters,
  "BIOMES_UI_OPEN_MENU_KEY_CODE",
  "obsolete replacement-menu KeyR ownership is removed"
);
notContains(
  adapters,
  'KeyE: "daily"',
  "E no longer opens the replacement menu tab"
);
notContains(
  adapters,
  'KeyE: "inventory"',
  "E no longer opens replacement inventory"
);
contains(
  adapters,
  "pointerLockManager.unlock",
  "opening new UI releases pointer lock for mouse use"
);
contains(
  adapters,
  "pointerLockManager.focusAndLock",
  "closing new UI can restore pointer lock"
);
contains(
  adapters,
  "BIOMES_UI_OPEN_TAB_EVENT",
  "replacement bridge exposes an open-tab event"
);

contains(
  quest,
  "useBiomesUIReplaceLegacyFlag",
  "QuestAndMinimapHUD reads replacement flag"
);
contains(
  quest,
  "<BiomesUIMount forceEnabled={replaceLegacy}",
  "QuestAndMinimapHUD force-mounts new UI in replacement mode"
);
contains(
  quest,
  "<HarthmereUnifiedHUD hideLegacyVisuals={replaceLegacy}",
  "QuestAndMinimapHUD hides only legacy visuals, not controllers"
);
assert(
  count(quest, /<MiniMapHUD\s*\/>/g) >= 2,
  "QuestAndMinimapHUD keeps MiniMapHUD in normal and replacement branches"
);
assert(
  /replaceLegacy[\s\S]{0,600}<MiniMapHUD\s*\/>/.test(quest),
  "replacement branch still renders the live MiniMapHUD"
);
contains(
  quest,
  'RulesetToggleable name="minimap"',
  "MiniMapHUD remains behind minimap ruleset toggle"
);

contains(
  chrome,
  "useBiomesUIReplaceLegacyFlag",
  "BiomesChrome reads replacement flag"
);
assert(
  /!replaceLegacyBiomesUI\s*&&\s*showHotbar\s*&&\s*<HotBar/.test(chrome),
  "BiomesChrome hides old HotBar visual in replacement mode while preserving the HUD visibility toggle"
);
contains(
  chrome,
  "<ShortcutsHUD recipesOnly={replaceLegacyBiomesUI}",
  "replacement mode keeps only the native Recipes shortcut mounted"
);

assert(
  /HarthmereUnifiedHUD:\s*React\.FunctionComponent<\{\s*hideLegacyVisuals\??:\s*boolean\s*;?\s*\}>/.test(
    unified
  ) && /hideLegacyVisuals\s*=\s*true/.test(unified),
  "HarthmereUnifiedHUD accepts hideLegacyVisuals prop"
);
contains(
  unified,
  "const runtimeControllers",
  "HarthmereUnifiedHUD separates runtime controllers from visual panels"
);
contains(
  unified,
  "const legacyVisualsHidden = true",
  "HarthmereUnifiedHUD permanently retires duplicate legacy visuals"
);
contains(
  unified,
  "if (legacyVisualsHidden)",
  "HarthmereUnifiedHUD has replacement-mode visual hiding branch"
);
contains(
  unified,
  "if (legacyVisualsHidden) {\n        // Replacement mode keeps all Harthmere runtime hooks/controllers alive",
  "legacy HUD hotkey handler yields to BiomesUI in replacement mode"
);

const controllerNames = [
  "SnapshotMissionRuntimeController",
  "SnapshotGroveBibleRuntimeController",
  "SnapshotCompletePortRuntimeController",
  "SnapshotProductionPortRuntimeController",
  "SnapshotLiveDiagnosticsRuntimeController",
  "HarthmereDeathRuntimeController",
  "SnapshotCombatRuntimeController",
];

for (const name of controllerNames) {
  contains(
    unified,
    `<${name} />`,
    `runtime controller remains mounted: ${name}`
  );
}

const hiddenBranchMatch = unified.match(
  /if \(legacyVisualsHidden\) \{[\s\S]*?return \([\s\S]*?<>[\s\S]*?\{runtimeControllers\}[\s\S]*?<HarthmereVendorTradePanel \/>[\s\S]*?<\/>([\s\S]*?)\);[\s\S]*?\}/
);
assert(
  Boolean(hiddenBranchMatch),
  "hidden legacy branch still returns runtimeControllers and critical vendor panel"
);
notContains(
  hiddenBranchMatch ? hiddenBranchMatch[0] : "",
  "<CompactStatusCluster",
  "hidden legacy branch does not render old status cluster"
);
notContains(
  hiddenBranchMatch ? hiddenBranchMatch[0] : "",
  "<SnapshotMissionMapHUD",
  "hidden legacy branch does not render old mission map HUD"
);
notContains(
  hiddenBranchMatch ? hiddenBranchMatch[0] : "",
  "<SnapshotGroveMapHUD",
  "hidden legacy branch does not render old Grove map HUD"
);
notContains(
  hiddenBranchMatch ? hiddenBranchMatch[0] : "",
  "<SnapshotCombatMapHUD",
  "hidden legacy branch does not render old combat map HUD"
);

assert(
  !/this\.findCombatLifeByEcsNpcSnapshot\s*\(/.test(assets),
  "harthmere_assets no longer directly calls missing findCombatLifeByEcsNpcSnapshot"
);

contains(
  shortcuts,
  "if (e.repeat) return",
  "tab shortcuts ignore repeated keydown"
);
contains(
  shortcuts,
  "e.metaKey || e.ctrlKey || e.altKey",
  "tab shortcuts ignore modifier shortcuts"
);
contains(
  shortcuts,
  "isTypingInInput()",
  "tab shortcuts do not steal chat/input typing"
);
notContains(
  hotbar,
  'toLowerCase() === "e"',
  "hotbar does not capture E/interact"
);
notContains(
  adapters,
  'KeyR: "daily"',
  "replacement key bridge leaves R to native Recipes"
);

contains(
  cueBar,
  "UI_IDS.CUE_SPRINT",
  "tutorial cue bar exposes sprint highlight target"
);
contains(
  cueBar,
  "UI_IDS.CUE_JUMP",
  "tutorial cue bar exposes jump highlight target"
);
contains(
  cueBar,
  "UI_IDS.CAMERA_BUTTON",
  "tutorial cue bar exposes camera highlight target"
);
contains(
  cueBar,
  "UI_IDS.RECIPE_LIST",
  "tutorial cue bar exposes recipe list highlight target"
);
contains(
  cueBar,
  "UI_IDS.RECIPE_MUCK_BUSTER",
  "tutorial cue bar exposes muck buster recipe highlight target"
);

contains(biomesUI, "Escape", "BiomesUI closes active tab with Escape");
contains(biomesUI, "isTypingInInput", "BiomesUI guards shortcuts while typing");
contains(hotbar, "/^[1-9]$/.test(e.key)", "hotbar supports number keys 1-9");
contains(hotbar, "ArrowLeft", "hotbar supports ArrowLeft");
contains(hotbar, "ArrowRight", "hotbar supports ArrowRight");
contains(hotbar, "Enter", "hotbar supports Enter/use");
contains(hotbar, 'e.key.toLowerCase() === "q"', "hotbar supports Q/drop");
contains(hotbar, "iconIsImage", "hotbar renders real item icon URLs as images");
contains(nav, 'role="tablist"', "nav rail has tablist role");
contains(nav, "ArrowRight", "nav rail supports ArrowRight");
contains(nav, "ArrowLeft", "nav rail supports ArrowLeft");
contains(nav, "Home", "nav rail supports Home");
contains(nav, "End", "nav rail supports End");
contains(nav, 'role="tab"', "nav buttons have tab role");
contains(grid, 'role="grid"', "RovingGrid uses grid role");
contains(grid, "PageDown", "RovingGrid supports PageDown");
contains(grid, "PageUp", "RovingGrid supports PageUp");
contains(grid, "ctrlKey", "RovingGrid supports Ctrl+Home/End behavior");

console.log(
  `Biomes UI replacement edge-case contract: ${passes.length} passed, ${failures.length} failed.`
);
if (failures.length) {
  for (const f of failures) console.error("FAIL", f);
  process.exit(1);
}
for (const p of passes) console.log("PASS", p);
