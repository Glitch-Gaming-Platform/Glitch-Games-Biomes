#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const failures = [];
const passes = [];

function file(rel) {
  return path.join(root, rel);
}
function read(rel) {
  return fs.readFileSync(file(rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(file(rel));
}
function assert(condition, message) {
  (condition ? passes : failures).push(message);
}
function contains(text, needle, message) {
  assert(text.includes(needle), message || `contains ${needle}`);
}
function containsAny(text, needles, message) {
  assert(needles.some((needle) => text.includes(needle)), message);
}

assert(exists("src/client/components/biomes_ui/BiomesUIVitalsPanel.tsx"), "BiomesUIVitalsPanel exists");
assert(exists("src/client/components/biomes_ui/BiomesUIMount.tsx"), "BiomesUIMount exists");
assert(exists("src/client/components/biomes_ui/theme/biomesUITheme.ts"), "Biomes UI runtime theme exists");
assert(exists("src/client/components/biomes_ui/uniqueIds.ts"), "uniqueIds exists");

if (!failures.length) {
  const vitals = read("src/client/components/biomes_ui/BiomesUIVitalsPanel.tsx");
  const mount = read("src/client/components/biomes_ui/BiomesUIMount.tsx");
  const theme = read("src/client/components/biomes_ui/theme/biomesUITheme.ts");
  const uniqueIds = read("src/client/components/biomes_ui/uniqueIds.ts");

  contains(vitals, "useHarthmereCombatState", "vitals reads live combat/player health state");
  contains(vitals, "useHarthmereMultiplayerCombatState", "vitals reads live multiplayer mana state");
  contains(vitals, "useHarthmereReputationState", "vitals reads live reputation state");
  contains(vitals, "getHarthmereCombinedPublicTitle", "vitals shows the live public reputation title");
  contains(vitals, "UI_IDS.HUD_VITALS", "vitals root uses canonical highlight id");
  contains(vitals, "UI_IDS.HUD_VITALS_HEALTH", "health bar uses canonical highlight id");
  contains(vitals, "UI_IDS.HUD_VITALS_MANA", "mana bar uses canonical highlight id");
  contains(vitals, "UI_IDS.HUD_VITALS_LIKEABILITY", "likeability chip uses canonical highlight id");
  contains(vitals, "UI_IDS.HUD_VITALS_NOTORIETY", "notoriety chip uses canonical highlight id");
  contains(vitals, "UI_IDS.HUD_VITALS_LEGAL", "law chip uses canonical highlight id");
  contains(vitals, "signedStandingPercent", "likeability and law use signed -10000..10000 percent scale");
  contains(vitals, "notorietyPercent", "notoriety uses 0..10000 percent scale");

  contains(mount, "BiomesUIVitalsPanel", "BiomesUIMount imports/renders the vitals panel");
  contains(mount, "<BiomesUIVitalsPanel />", "BiomesUIMount renders vitals alongside the new UI");

  contains(theme, ".biomes-ui-vitals-panel", "theme includes vitals panel styling");
  contains(theme, ".biomes-ui-vitals-bar__fill--health", "theme includes health bar fill styling");
  contains(theme, ".biomes-ui-vitals-bar__fill--mana", "theme includes mana bar fill styling");
  contains(theme, ".biomes-ui-vitals-chip", "theme includes standing chip styling");
  contains(theme, "@media (max-width: 768px)", "theme has mobile breakpoint support");

  contains(uniqueIds, "HUD_VITALS", "uniqueIds exposes hud vitals root id");
  contains(uniqueIds, "HUD_VITALS_HEALTH", "uniqueIds exposes health id");
  contains(uniqueIds, "HUD_VITALS_MANA", "uniqueIds exposes mana id");
  contains(uniqueIds, "HUD_VITALS_LIKEABILITY", "uniqueIds exposes likeability id");
  contains(uniqueIds, "HUD_VITALS_NOTORIETY", "uniqueIds exposes notoriety id");
  contains(uniqueIds, "HUD_VITALS_LEGAL", "uniqueIds exposes law id");
}

console.log(`Biomes UI vitals current: ${passes.length} passed, ${failures.length} failed.`);
if (failures.length) {
  for (const failure of failures) console.error("FAIL", failure);
  process.exit(1);
}
for (const pass of passes) console.log("PASS", pass);
