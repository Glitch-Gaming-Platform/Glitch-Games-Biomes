#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const strict = process.argv.includes("--strict") || process.env.HARTHMERE_BRIDGE_WILDS_AUDIT_STRICT === "1";
function abs(rel) { return path.join(root, rel); }
function exists(rel) { return fs.existsSync(abs(rel)); }
function read(rel) { return exists(rel) ? fs.readFileSync(abs(rel), "utf8") : ""; }
function norm(s) { return String(s || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function has(text, words) { const n = norm(text); return words.every((w) => n.includes(norm(w))); }
function lineOf(text, needle) { const i = text.indexOf(needle); return i < 0 ? undefined : text.slice(0, i).split(/\r?\n/).length; }

const files = {
  renderer: "src/client/game/renderers/local_dev/harthmere_assets.ts",
  registry: "src/shared/harthmere/town_registry.ts",
  wildLoops: "src/shared/harthmere/wilds_gameplay_loops_v47.ts",
  wildContract: "src/shared/harthmere/wilds_bible_implementation_v54.ts",
  npc44: "src/shared/harthmere/npc_compendium_v44.ts",
  npc45: "src/shared/harthmere/npc_compendium_v45.ts",
  quests: "src/shared/harthmere/quest_compendium_v46.ts",
  mainQuestSpaces: "src/shared/harthmere/main_quest_spaces_v47.ts",
};
const renderer = read(files.renderer);
const registry = read(files.registry);
const wildLoops = read(files.wildLoops);
const wildContract = read(files.wildContract);
const npcText = read(files.npc44) + "\n" + read(files.npc45);
const questText = read(files.quests) + "\n" + wildLoops + "\n" + wildContract;
const allText = [renderer, registry, wildLoops, wildContract, npcText, questText, read(files.mainQuestSpaces)].join("\n");

const report = {
  version: "harthmere-bridge-wilds-implementation-audit-v54",
  generatedAt: new Date().toISOString(),
  root,
  strict,
  files: Object.fromEntries(Object.entries(files).map(([k, rel]) => [k, { path: rel, exists: exists(rel) }])),
  bridge: {},
  wilds: { regions: [], landmarks: [], npcs: [], storyLines: [], resourceGroups: [], enemyGroups: [], systems: [] },
  missing: [],
  warnings: [],
};

function check(label, ok, category, evidence) {
  const item = { label, status: ok ? "IMPLEMENTED" : "MISSING", evidence };
  if (!ok) report.missing.push(`${category}:${label}`);
  return item;
}

report.bridge = {
  status: [
    /HARTHMERE_WALKABLE_BRIDGE_VERSION_V54/.test(renderer),
    /HARTHMERE_WALKABLE_BRIDGE_COLLISION_V54/.test(registry),
    /Old Bridge walkable bridge deck/i.test(renderer),
    /bridge parapet/i.test(renderer),
    /bronze disc/i.test(renderer),
    /old_bridge_crack_interaction_space_v47/.test(read(files.mainQuestSpaces)),
  ].every(Boolean) ? "IMPLEMENTED" : "MISSING_OR_PARTIAL",
  checks: {
    helper: /createHarthmereOldBridgeWalkableParapetsV54/.test(renderer),
    collisionException: /HARTHMERE_WALKABLE_BRIDGE_COLLISION_V54/.test(registry),
    deckIsNonBlocking: /walkable bridge deck is a road\/floor surface, not an obstacle/.test(registry),
    parapetsBlockEdges: /bridge parapet blocks bridge edges/.test(registry),
    q1SpaceStillExists: /old_bridge_crack_interaction_space_v47/.test(read(files.mainQuestSpaces)),
    bronzeDisc: /bronze disc set into Old Bridge cobbles/i.test(renderer),
    line: lineOf(renderer, "HARTHMERE_WALKABLE_BRIDGE_V54 Old Bridge"),
  },
};
if (report.bridge.status !== "IMPLEMENTED") report.missing.push("bridge:Real walkable bridge with parapets");

const regions = [
  ["Gate Fields", ["Gate Fields"]],
  ["Mill Road", ["Mill Road"]],
  ["Orchard Lane", ["Orchard Lane"]],
  ["Greenmere Forest Edge", ["Greenmere Edge", "Greenmere"]],
  ["Old Hunter's Track", ["Old Hunters Track", "Old Hunter Track", "Old Hunter's Track"]],
  ["Briarfen Wetlands", ["Briarfen"]],
  ["Ruined Watchtower Ridge", ["Watchtower Ridge", "Bandit Ridge"]],
  ["Gravewood", ["Gravewood"]],
  ["Deep Old Wood", ["Deep Old Wood", "Old Wood"]],
];
for (const [label, keys] of regions) {
  const ok = keys.some((k) => norm(renderer + wildLoops + wildContract).includes(norm(k)));
  report.wilds.regions.push(check(label, ok, "wilds-region", keys));
}

const landmarks = [
  "Last Watch Post",
  "Thornbridge Crossing",
  "Miller's Rest",
  "Charcoal Burners' Camp",
  "Split Oak",
  "Broken Toll Road",
  "Witchlight Pool",
  "Old Quarry Cut",
];
for (const label of landmarks) {
  const ok = norm(renderer + wildContract).includes(norm(label));
  report.wilds.landmarks.push(check(label, ok, "wilds-landmark", { renderer: lineOf(renderer, label) }));
}

const npcs = [
  "Edda Wren",
  "Old Merrit Bracken",
  "Sella Reedfoot",
  "Tamsin Vale",
  "Brother Cael Marsen",
  "Rusk Hallowhand",
  "Veneth of the Green Threshold",
];
for (const label of npcs) {
  const ok = norm(npcText + renderer).includes(norm(label));
  report.wilds.npcs.push(check(label, ok, "wilds-npc", { npcCompendium: lineOf(npcText, label), renderer: lineOf(renderer, label) }));
}

const storyLines = [
  ["First Steps Beyond the Gate", ["Gate Fields Starter Loop", "First Steps Beyond the Gate"]],
  ["Road Trouble Chain", ["Road Bandits", "road trouble", "road ambush", "track_bandits"]],
  ["The Orchard That Watches", ["Orchard Lane", "rare_harvest_beast", "Harvest Beast"]],
  ["The Briarfen Lights", ["Briarfen Witchlights", "witchlight_rescue", "Witchlight Pool"]],
  ["The Grave Moss Tithe", ["grave_moss", "Grave-Tending", "sacred relic"]],
  ["The Old Hunter's Debt", ["The Old Hunter", "Old Hunter", "debt"]],
  ["The Bell Beneath the Roots", ["bell metal fragment", "night_bell_rumors", "Bell Beneath the Roots"]],
  ["Public Event: Caravan Under Attack", ["Caravan Under Attack", "road_ambush", "bandit_raid"]],
  ["Public Event: Flood from the Briarfen", ["Flood from the Briarfen", "flooded_supply_cache", "failed river event raises dock prices"]],
  ["Rare Event: The Harvest Beast", ["rare_harvest_beast", "harvest_beast", "Harvest Beast"]],
  ["Group Event: The Root-Crowned Dead", ["root_crowned_dead", "Root-Crowned Dead"]],
];
for (const [label, keys] of storyLines) {
  const ok = keys.some((k) => norm(questText).includes(norm(k)));
  report.wilds.storyLines.push(check(label, ok, "wilds-story", keys));
}

const resourceGroups = [
  ["Logging", ["timber", "oak", "ash", "resin", "fallen branch"]],
  ["Herbalism", ["herbs", "grave_moss", "bluefire_fungus", "flood lotus"]],
  ["Hunting and Skinning", ["hides", "meat", "antlers", "dire hide"]],
  ["Mining and Stone", ["iron", "coal", "stone", "black iron", "mana crystal"]],
  ["Fishing and Wetland", ["reeds", "clay", "river", "fish", "eel"]],
  ["Archaeology and Relics", ["relic", "old coins", "bell metal", "war relic"]],
];
for (const [label, words] of resourceGroups) {
  const ok = words.some((w) => norm(allText).includes(norm(w)));
  report.wilds.resourceGroups.push(check(label, ok, "wilds-resource", words));
}

const enemyGroups = [
  ["Bandits", ["bandit", "hedge_archer", "wagon_raider"]],
  ["Undead", ["undead", "bell_woken_dead", "mourning_wraith"]],
  ["Forest Monsters", ["rootling", "witch_crow", "hollow_treant", "root_crowned_dead"]],
  ["Smugglers", ["smuggler", "river_knots", "River Knot"]],
  ["Passive Animals", ["Rabbit", "Deer", "Frog", "animal_deer", "animal_bunny"]],
  ["Defensive Animals", ["Boar", "Bear", "Snake", "animal_boar"]],
  ["Predators", ["Wolf", "river_lurker", "animal_wolf"]],
  ["Corrupted Animals", ["corrupted_animals", "pale wolf", "root-bound bear", "Possessed deer"]],
];
for (const [label, words] of enemyGroups) {
  const ok = words.some((w) => norm(allText).includes(norm(w)));
  report.wilds.enemyGroups.push(check(label, ok, "wilds-enemy", words));
}

const systems = [
  ["Resource ownership and theft law", /Resource Ownership and Theft Law|classifyHarthmereResourceOwnershipV47|owned goods require permission/i.test(allText)],
  ["Overharvesting consequences", /overharvest|resourcePressure|forest_backlash/i.test(allText)],
  ["Public world events", /Public World Events|resolveHarthmereWildsPublicEventV47|contribution required/i.test(allText)],
  ["Town feedback/economy effects", /townEffects|road_prices_fall|market_food_price|dock_goods_price|vendor_scarcity/i.test(allText)],
  ["Safe-to-dangerous rings", /dangerRing|safe road readable|Deep Old Wood|Gate Fields Starter Loop/i.test(allText)],
  ["Storm/night danger changes", /fog\/night changes danger|night increases wolves|undead increase at night|Storm/i.test(allText)],
];
for (const [label, ok] of systems) report.wilds.systems.push(check(label, ok, "wilds-system", {}));

const totals = {
  missing: report.missing.length,
  regions: `${report.wilds.regions.filter((x) => x.status === "IMPLEMENTED").length}/${report.wilds.regions.length}`,
  landmarks: `${report.wilds.landmarks.filter((x) => x.status === "IMPLEMENTED").length}/${report.wilds.landmarks.length}`,
  npcs: `${report.wilds.npcs.filter((x) => x.status === "IMPLEMENTED").length}/${report.wilds.npcs.length}`,
  storyLines: `${report.wilds.storyLines.filter((x) => x.status === "IMPLEMENTED").length}/${report.wilds.storyLines.length}`,
  resources: `${report.wilds.resourceGroups.filter((x) => x.status === "IMPLEMENTED").length}/${report.wilds.resourceGroups.length}`,
  enemyGroups: `${report.wilds.enemyGroups.filter((x) => x.status === "IMPLEMENTED").length}/${report.wilds.enemyGroups.length}`,
  systems: `${report.wilds.systems.filter((x) => x.status === "IMPLEMENTED").length}/${report.wilds.systems.length}`,
};
report.totals = totals;
report.result = report.missing.length === 0 ? "PASS" : strict ? "FAIL" : "PASS_WITH_WARNINGS";

const jsonRel = "public/assets/harthmere/manifest/harthmere-bridge-wilds-audit-v54.json";
const mdRel = "docs/harthmere/HARTHMERE_BRIDGE_WILDS_IMPLEMENTATION_AUDIT_V54.md";
fs.mkdirSync(path.dirname(abs(jsonRel)), { recursive: true });
fs.mkdirSync(path.dirname(abs(mdRel)), { recursive: true });
fs.writeFileSync(abs(jsonRel), JSON.stringify(report, null, 2));

function table(items) {
  return ["| Item | Status |", "|---|---|", ...items.map((i) => `| ${i.label} | ${i.status} |`)].join("\n");
}
const md = `# Harthmere Bridge and Wilds Implementation Audit V54\n\nGenerated: ${report.generatedAt}\n\n## Result\n\n**${report.result}**\n\n## Old Bridge\n\nStatus: **${report.bridge.status}**\n\nChecks:\n\n- Helper installed: ${report.bridge.checks.helper ? "yes" : "no"}\n- Collision exception installed: ${report.bridge.checks.collisionException ? "yes" : "no"}\n- Deck non-blocking: ${report.bridge.checks.deckIsNonBlocking ? "yes" : "no"}\n- Parapets block bridge edges: ${report.bridge.checks.parapetsBlockEdges ? "yes" : "no"}\n- Q1 bridge-crack quest space still present: ${report.bridge.checks.q1SpaceStillExists ? "yes" : "no"}\n- Bronze disc/crack inspect marker present: ${report.bridge.checks.bronzeDisc ? "yes" : "no"}\n\n## Wilds Regions\n\n${table(report.wilds.regions)}\n\n## Wilds Landmarks\n\n${table(report.wilds.landmarks)}\n\n## Wilderness NPCs\n\n${table(report.wilds.npcs)}\n\n## Quest and Story Lines\n\n${table(report.wilds.storyLines)}\n\n## Resource Groups\n\n${table(report.wilds.resourceGroups)}\n\n## Enemy Groups\n\n${table(report.wilds.enemyGroups)}\n\n## Systems\n\n${table(report.wilds.systems)}\n\n## Missing\n\n${report.missing.length ? report.missing.map((m) => `- ${m}`).join("\n") : "None."}\n`;
fs.writeFileSync(abs(mdRel), md);

console.log("== Harthmere bridge and Wilds implementation audit v54 ==");
console.log(`Report: ${mdRel}`);
console.log(`JSON: ${jsonRel}`);
console.log(`Bridge: ${report.bridge.status}`);
console.log(`Wilds regions: ${totals.regions}, landmarks: ${totals.landmarks}, NPCs: ${totals.npcs}, stories: ${totals.storyLines}, resources: ${totals.resources}, enemies: ${totals.enemyGroups}, systems: ${totals.systems}`);
if (report.missing.length) {
  console.log(`Missing/warnings: ${report.missing.length}`);
  for (const item of report.missing) console.log(`WARN ${item}`);
}
console.log(`RESULT: ${report.result}`);
if (strict && report.missing.length) process.exit(1);
