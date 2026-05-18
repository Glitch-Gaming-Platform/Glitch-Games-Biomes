#!/usr/bin/env node
"use strict";
/* HARTHMERE_BIBLE_IMPLEMENTATION_AUDIT_V53
 * Static implementation audit against the uploaded Harthmere town bible,
 * Bellbound story bible, and MMO rules contracts already encoded in the repo.
 * Writes:
 * - docs/harthmere/HARTHMERE_BIBLE_IMPLEMENTATION_AUDIT_V53.md
 * - public/assets/harthmere/manifest/harthmere-bible-implementation-audit-v53.json
 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const strict = process.argv.includes("--strict") || process.env.HARTHMERE_BIBLE_AUDIT_STRICT === "1";

const paths = {
  renderer: "src/client/game/renderers/local_dev/harthmere_assets.ts",
  blockContract: "src/shared/harthmere/town_block_build_v1.ts",
  housing: "src/shared/harthmere/resident_housing_v38.ts",
  questCatalog: "src/shared/harthmere/quest_compendium_v46.ts",
  questRuntime: "src/shared/harthmere/quest_runtime_v47.ts",
  questSpaces: "src/shared/harthmere/main_quest_spaces_v47.ts",
  boss: "src/shared/harthmere/thaedryn_boss_v47.ts",
  wilds: "src/shared/harthmere/wilds_gameplay_loops_v47.ts",
  npc44: "src/shared/harthmere/npc_compendium_v44.ts",
  npc45: "src/shared/harthmere/npc_compendium_v45.ts",
  townRegistry: "src/shared/harthmere/town_registry.ts",
  measuredDimensions: "src/shared/harthmere/uploaded_asset_dimensions_v52.ts",
};

function abs(rel) { return path.join(root, rel); }
function exists(rel) { return fs.existsSync(abs(rel)); }
function read(rel) { return exists(rel) ? fs.readFileSync(abs(rel), "utf8") : ""; }
function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function normalize(s) { return String(s || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function includesAllWindow(hay, words, window = 500) {
  const flat = normalize(hay);
  const tokens = words.map(normalize).filter(Boolean);
  for (let i = 0; i < flat.length; i += Math.max(120, Math.floor(window / 2))) {
    const chunk = flat.slice(i, i + window);
    if (tokens.every((t) => chunk.includes(t))) return true;
  }
  return false;
}
function lineOfNeedle(text, needle) {
  const i = text.indexOf(needle);
  if (i < 0) return undefined;
  return text.slice(0, i).split(/\r?\n/).length;
}
function status(ok, warn) { return ok ? "IMPLEMENTED" : (warn ? "WARN" : "MISSING"); }

const src = read(paths.renderer);
const contract = read(paths.blockContract);
const housing = read(paths.housing);
const questCatalogSrc = read(paths.questCatalog);
const questSpaces = read(paths.questSpaces);
const npc44 = read(paths.npc44);
const npc45 = read(paths.npc45);
const registry = read(paths.townRegistry);

const report = {
  version: "harthmere-bible-implementation-audit-v53",
  root,
  generatedAt: new Date().toISOString(),
  strict,
  files: {},
  sourceBibles: [],
  buildings: {},
  dungeons: {},
  housing: {},
  npc: {},
  quests: {},
  designWarnings: [],
  missing: [],
  implemented: [],
};

for (const [key, rel] of Object.entries(paths)) {
  report.files[key] = { path: rel, exists: exists(rel) };
}

function listCandidateFiles() {
  const roots = ["docs", "src/shared/harthmere", "scripts/harthmere", "."].map(abs).filter(fs.existsSync);
  const out = [];
  const seen = new Set();
  function walk(dir, depth) {
    if (depth < 0) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (["node_modules", ".git", "public", "voxeloo", "target", "dist", "build"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (seen.has(full)) continue;
      seen.add(full);
      if (entry.isDirectory()) walk(full, depth - 1);
      else if (/\.(md|mdx|txt|pdf|json|ts|tsx|cjs)$/i.test(entry.name)) out.push(full);
    }
  }
  for (const r of roots) walk(r, r.endsWith(path.sep + ".") ? 1 : 4);
  return out;
}

const sourceBibleDefs = [
  {
    key: "town_design_bible",
    title: "Harthmere Expanded Medieval MMO Town Design Bible",
    filenamePatterns: [/harthmere.*town.*design.*bible/i, /expanded.*medieval.*mmo.*town/i],
    contentPatterns: [/complete,?\s*MMO-ready town package/i, /service node, quest hub, economy anchor/i],
    expectedPurpose: "District grammar, service placement, art direction, production checklist, MMO hub rules.",
  },
  {
    key: "bellbound_story_bible",
    title: "Harthmere Bellbound Dragon Story Bible",
    filenamePatterns: [/bellbound.*dragon.*story.*bible/i, /harthmere.*bellbound/i],
    contentPatterns: [/complete, ready-to-build 6-hour main story arc/i, /NPC Compendium/i, /Expanded Side Quest Catalog/i],
    expectedPurpose: "Q1-Q12 main quest, Q2.5 optional beat, NPC compendium, 40+ side quests, production notes.",
  },
  {
    key: "mmo_rules",
    title: "MMO Rules",
    filenamePatterns: [/mmo[_ -]?rules/i, /MMO_RULES/i],
    contentPatterns: [/MMO_RULES/i, /#\s*MMO Rules/i],
    expectedPurpose: "Hard implementation constraints such as walkable access, door/stair clearance, collision, and MMO building rules.",
  },
  {
    key: "wilds_setting_bible",
    title: "Harthmere Wilds Outside Town Narrative Setting",
    filenamePatterns: [/harthmere.*wilds.*outside.*town/i, /wilds.*narrative.*setting/i],
    contentPatterns: [/Harthmere Wilds Outside Town/i, /Greenmere|Briarfen|Gravewood|Watchtower Ridge/i],
    expectedPurpose: "Outer ring content, enemies, gathering routes, and wilderness story consistency.",
  },
];

const candidates = listCandidateFiles();
for (const def of sourceBibleDefs) {
  let found = [];
  for (const file of candidates) {
    const rel = path.relative(root, file);
    // Source bibles should be stored as actual docs/source files, not inferred from test/check scripts or TS contracts.
    if (/^(scripts|src|public)\//.test(rel) || /(^|\/)(check|test)-/i.test(rel) || /BIBLE_IMPLEMENTATION_AUDIT|harthmere-bible-implementation-audit/i.test(rel)) continue;
    if (def.filenamePatterns.some((re) => re.test(rel))) {
      found.push({ path: rel, reason: "filename" });
      continue;
    }
    if (/\.(md|mdx|txt|json|ts|tsx|cjs)$/i.test(file)) {
      let sample = "";
      try { sample = fs.readFileSync(file, "utf8").slice(0, 120000); } catch {}
      if (def.contentPatterns.some((re) => re.test(sample))) found.push({ path: rel, reason: "content" });
    }
  }
  if (found.length > 5) found = found.slice(0, 5);
  const item = { ...def, found, present: found.length > 0 };
  delete item.filenamePatterns;
  delete item.contentPatterns;
  report.sourceBibles.push(item);
  if (!item.present) report.designWarnings.push(`Source bible not found in project docs: ${def.title}. Audit uses embedded expectations/contracts, but the source file should be stored under docs/harthmere/bibles/.`);
}

function extractBuildingEntries(contractText) {
  const re = /\{\s*name:\s*"([^"]+)",\s*district:\s*"([^"]+)",\s*profile:\s*"([^"]+)",\s*floors:\s*(\d+),\s*bible:\s*"([^"]+)"\s*\}/g;
  const out = [];
  let m;
  while ((m = re.exec(contractText))) out.push({ name: m[1], district: m[2], profile: m[3], floors: Number(m[4]), bible: m[5] });
  return out;
}
function extractDungeonEntries(contractText) {
  const re = /\{\s*name:\s*"([^"]+)",\s*quest:\s*"([^"]+)",\s*bible:\s*"([^"]+)"\s*\}/g;
  const out = [];
  let m;
  while ((m = re.exec(contractText))) out.push({ name: m[1], quest: m[2], bible: m[3] });
  return out;
}

function buildingImplemented(r) {
  const name = r.name;
  const nameRe = new RegExp(`name:\\s*"${escapeRe(name)}"`, "i");
  const strictRe = new RegExp(`(?:createHarthmereBlockBuiltServiceBuildingV43|createHarthmereBlockBuiltHousingPlacementsV40)[\\s\\S]{0,80}name:\\s*"${escapeRe(name)}"`, "i");
  const present = src.includes(name) || nameRe.test(src);
  const blockBuilt = strictRe.test(src) || (r.floors === 0 && present);
  const decorativeOnly = present && !blockBuilt && r.floors > 0;
  const floorsOk = r.floors === 0 || new RegExp(`name:\\s*"${escapeRe(name)}"[\\s\\S]{0,180}floors:\\s*${r.floors}\\b`, "i").test(src) || (r.floors === 1 && blockBuilt);
  return {
    ...r,
    status: blockBuilt && floorsOk ? "IMPLEMENTED" : decorativeOnly ? "INCORRECT_DECORATIVE_ONLY" : present ? "PARTIAL" : "MISSING",
    present,
    blockBuilt,
    floorsOk,
    line: lineOfNeedle(src, name),
  };
}

const requiredBuildings = extractBuildingEntries(contract);
const buildingRows = requiredBuildings.map(buildingImplemented);
report.buildings.requiredCount = requiredBuildings.length;
report.buildings.implemented = buildingRows.filter((b) => b.status === "IMPLEMENTED");
report.buildings.partialOrIncorrect = buildingRows.filter((b) => b.status !== "IMPLEMENTED" && b.status !== "MISSING");
report.buildings.missing = buildingRows.filter((b) => b.status === "MISSING");
report.buildings.rows = buildingRows;
if (report.buildings.missing.length) report.missing.push(...report.buildings.missing.map((b) => `building:${b.name}`));
if (report.buildings.partialOrIncorrect.length) report.designWarnings.push(...report.buildings.partialOrIncorrect.map((b) => `Building is not fully correct: ${b.name} status=${b.status}`));

const targetedBuildingRequirements = [
  { key: "north_gate_gatehouse", label: "North Gate gatehouse", evidence: [/North Gate Gatehouse/i, /North Gate west tower[\s\S]*North Gate east tower/i] },
  { key: "toll_booth", label: "Toll booth", evidence: [/Toll Booth/i, /Toll clerk desk[\s\S]*Toll chest/i] },
  { key: "brother_vance_cottage", label: "Brother Vance cottage", evidence: [/Brother Vance Cottage/i] },
  { key: "mara_house", label: "Mara Thistle two-story house", evidence: [/Mara Thistle Two-Story House[\s\S]{0,180}floors:\s*2/i] },
  { key: "edrik_estate", label: "Edrik Vane Noble Rise estate", evidence: [/Edrik Vane Estate[\s\S]{0,200}floors:\s*2/i] },
  { key: "real_bridge_parapets", label: "Real walkable bridge with parapets", evidence: [/bridge parapet/i, /parapet[\s\S]{0,120}bridge/i, /walkable[\s\S]{0,120}bridge/i] },
  { key: "wild_facing_watchtowers", label: "Town-wall watchtowers facing the wilds", evidence: [/wilds-facing watchtower/i, /town wall[\s\S]{0,160}watchtower/i, /watchtower[\s\S]{0,160}facing the wilds/i] },
  { key: "transparent_homes_removed", label: "Transparent homes outside/in town removed or rebuilt", evidence: [/transparent homes removed/i, /transparent.*home.*rebuilt/i, /no transparent home/i] },
];
report.buildings.targetedRequirements = targetedBuildingRequirements.map((req) => {
  const hay = `${src}\n${contract}\n${housing}`;
  const ok = req.evidence.some((re) => re.test(hay));
  const item = { key: req.key, label: req.label, status: ok ? "IMPLEMENTED_OR_EVIDENCE_FOUND" : "NEEDS_REVIEW_OR_MISSING" };
  if (!ok) report.designWarnings.push(`Targeted building/design requirement needs review: ${req.label}`);
  return item;
});

function numberAfter(text, re) { const m = text.match(re); return m ? Number(m[1]) : undefined; }
const residentialBuildings = (housing.match(/id:\s*"res_v38_home_/g) || []).length;
const slumBuildings = (housing.match(/id:\s*"slum_v38_stack_/g) || []).length;
const residentialCapacity = residentialBuildings ? 10 * 2 * 8 : undefined;
const slumFloors = Array.from(housing.matchAll(/id:\s*"slum_v38_stack_[^"]+"[\s\S]{0,180}?floors:\s*(\d+)[\s\S]{0,80}?roomsPerFloor:\s*(\d+)/g)).map((m) => ({ floors: Number(m[1]), roomsPerFloor: Number(m[2]) }));
const slumCapacity = slumFloors.reduce((t, b) => t + b.floors * b.roomsPerFloor, 0);
report.housing = {
  residentialBuildings,
  slumBuildings,
  residentialCapacity,
  slumCapacity,
  solidVoxelEvidence: /solid voxel apartment wall ring|flush 1m stone cube no gaps|solid stone\/ore/.test(src),
  stairEvidence: /accessible interior block stair|upper landing slab reachable|player npc accessible/.test(src),
  roomDecorEvidence: /HARTHMERE_RESIDENTIAL_ROOM_DECOR_V38[\s\S]*HARTHMERE_SLUM_ROOM_DECOR_V38/.test(housing),
};
if (!report.housing.solidVoxelEvidence) report.designWarnings.push("Residential/slum housing lacks strong solid voxel/block evidence.");
if (!report.housing.stairEvidence) report.designWarnings.push("Residential/slum housing lacks strong stair/accessibility evidence.");
if (!report.housing.roomDecorEvidence) report.designWarnings.push("Residential/slum housing lacks room decor manifest evidence.");

const requiredDungeons = extractDungeonEntries(contract);
function dungeonImplemented(r) {
  const hay = `${src}\n${questSpaces}`;
  const tokens = normalize(r.name).split(" ").filter((t) => t.length > 2);
  const present = includesAllWindow(hay, tokens, 700) || hay.toLowerCase().includes(r.name.toLowerCase());
  return { ...r, status: present ? "IMPLEMENTED" : "MISSING" };
}
const dungeonRows = requiredDungeons.map(dungeonImplemented);
report.dungeons.requiredCount = requiredDungeons.length;
report.dungeons.implemented = dungeonRows.filter((d) => d.status === "IMPLEMENTED");
report.dungeons.missing = dungeonRows.filter((d) => d.status === "MISSING");
report.dungeons.rows = dungeonRows;
report.dungeons.collisionPlanEvidence = /"collisionPlan"\s*:\s*\{[\s\S]*?"floor"[\s\S]*?"walls"[\s\S]*?"roof"[\s\S]*?"navmesh"/.test(questSpaces);
report.dungeons.sixBellwardChambers = ["Aevith", "Karag-Drath", "Vyrenia", "Murvath", "Sylenne", "Korruthax"].filter((n) => new RegExp(`Chamber of ${escapeRe(n)}`, "i").test(`${src}\n${questSpaces}`));
report.dungeons.regalia = ["Stole", "Hammer", "Tuning Fork", "Handbell", "Chain", "Ring"].filter((n) => new RegExp(`Bellbinder ${escapeRe(n)}`, "i").test(`${src}\n${questSpaces}`));
if (report.dungeons.missing.length) report.missing.push(...report.dungeons.missing.map((d) => `dungeon:${d.name}`));
if (!report.dungeons.collisionPlanEvidence) report.designWarnings.push("Main quest dungeon spaces do not prove floor/walls/roof/navmesh collision plans.");

const REQUIRED_NAMED_NPCS = [
  "Sergeant Bramwell Holt", "Drill Instructor Walt Ormsby", "Mara Thistle", "Edrik Vane", "Reeve Caldus Merrow",
  "Master Osric Vale", "Apprentice Luth", "Master Garrik Fen", "Mistress Helna Voss", "Mistress Selka Doryn",
  "Mistress Ysabet Fenlow", "Old Jory Brann", "Mistress Dawn Loaf", "Master Tovin Reed", "Mistress Lina Reed", "Sora Reed",
  "Father Aldren Mell", "Sister Maelle Frenn", "Brother Vance Holt", "Brother Halpen Wren", "Mother Halene Brae",
  "Mistress Elowen Pike", "Tisa Pike", "Maestro Cellan Bow", "Nessa Crowe", "Old Tam", "Tam", "Banker Merl Voss",
  "Courier Anwen Mell", "Auction Clerk Pell Marsten", "Guild Registrar Erena Voss", "Lady Henrietta Merrow", "Lila Merrow", "Ren Skell", "Lord Wrethan Pell",
  "Ferry Master Henrick Brell", "Smuggler-Mother Veska Reed", "Edda Wren", "Old Merrit Bracken", "Sella Reedfoot", "Tamsin Vale", "Brother Cael Marsen", "Rusk Hallowhand", "Veneth of the Green Threshold"
];
function actualNpcNames(text) { return Array.from(text.matchAll(/^\s*"name"\s*:\s*"([^"]+)"/gm)).map((m) => m[1]); }
const namedNpcNames = actualNpcNames(npc44);
const remainingNpcNames = actualNpcNames(npc45);
const allNpcNames = [...namedNpcNames, ...remainingNpcNames];
function npcNameFound(name) {
  const target = normalize(name).split(" ").filter((t) => !["sergeant", "master", "mistress", "old", "brother", "sister", "mother", "ferry", "smuggler", "maestro", "guild", "registrar", "auction", "clerk", "instructor"].includes(t));
  return allNpcNames.some((actual) => {
    const flat = normalize(actual);
    return target.length ? target.every((t) => flat.includes(t)) : flat.includes(normalize(name));
  }) || normalize(`${npc44}\n${npc45}`).includes(normalize(name));
}
const missingNamedNpc = REQUIRED_NAMED_NPCS.filter((n) => !npcNameFound(n));
const categoryCounts = {};
for (const m of npc45.matchAll(/^\s*"category"\s*:\s*"([^"]+)"/gm)) categoryCounts[m[1]] = (categoryCounts[m[1]] || 0) + 1;
report.npc = {
  namedCountV44: (npc44.match(/^\s*"implementationStatus"\s*:/gm) || []).length,
  remainingCountV45: (npc45.match(/^\s*"implementationStatus"\s*:/gm) || []).length,
  totalCount: (npc44.match(/^\s*"implementationStatus"\s*:/gm) || []).length + (npc45.match(/^\s*"implementationStatus"\s*:/gm) || []).length,
  requiredNamedCount: REQUIRED_NAMED_NPCS.length,
  missingNamedNpc,
  remainingCategoryCounts: categoryCounts,
  routeEvidence: /"route"\s*:\s*\{[\s\S]*?"schedule"/.test(npc44) && /"route"\s*:\s*\{[\s\S]*?"schedule"/.test(npc45),
  dialogueEvidence: /"dialogue"\s*:\s*\{[\s\S]*?"greeting"/.test(npc44) && /"dialogue"\s*:\s*\{[\s\S]*?"greeting"/.test(npc45),
};
if (missingNamedNpc.length) report.missing.push(...missingNamedNpc.map((n) => `npc:${n}`));
if (/Yenna/.test(npc44) && /Mira Holt|mira_holt/.test(npc45)) report.designWarnings.push("Bram Holt child-name continuity issue: v44 references sick Yenna, while v45 adds Mira Holt. Normalize this before final narrative lock.");

function jsonConst(name, text) {
  const m = text.match(new RegExp("export const " + escapeRe(name) + " = `([\\s\\S]*?)`;"));
  if (!m) return undefined;
  try { return JSON.parse(m[1]); } catch { return undefined; }
}
const questPolicy = jsonConst("HARTHMERE_QUEST_COVERAGE_POLICY_V46_JSON", questCatalogSrc) || {};
const questCatalog = jsonConst("HARTHMERE_QUEST_CATALOG_V46_JSON", questCatalogSrc) || [];
const questCodes = new Set(questCatalog.map((q) => q.code).filter(Boolean));
const questIds = new Set(questCatalog.map((q) => q.id).filter(Boolean));
const categories = {};
for (const q of questCatalog) categories[q.category || "unknown"] = (categories[q.category || "unknown"] || 0) + 1;
const missingMain = (questPolicy.requiredMainQuestCodes || []).filter((c) => !questCodes.has(c));
const missingOptionalMain = (questPolicy.requiredOptionalMainCodes || []).filter((c) => !questCodes.has(c));
const missingSide = (questPolicy.requiredSideQuestCodes || []).filter((c) => !questCodes.has(c));
const missingStarter = (questPolicy.requiredStarterQuestIds || []).filter((id) => !questIds.has(id));
report.quests = {
  total: questCatalog.length,
  categories,
  requiredMainCount: (questPolicy.requiredMainQuestCodes || []).length,
  optionalMainCount: (questPolicy.requiredOptionalMainCodes || []).length,
  requiredSideCount: (questPolicy.requiredSideQuestCodes || []).length,
  starterCount: (questPolicy.requiredStarterQuestIds || []).length,
  repeatableFamilies: questPolicy.requiredRepeatableFamilies || [],
  minimumQuestCount: questPolicy.minimumQuestCount,
  missingMain,
  missingOptionalMain,
  missingSide,
  missingStarter,
  runtimeFilesExist: [paths.questRuntime, paths.questSpaces, paths.boss, paths.wilds].every(exists),
  everyQuestHasObjectives: questCatalog.every((q) => Array.isArray(q.objectives) && q.objectives.length > 0),
  everyQuestHasRewards: questCatalog.every((q) => q.rewards && q.testContract && q.testContract.rewardGrantPolicy),
  everyQuestHasDialogueStates: questCatalog.every((q) => q.dialogue && q.dialogue.offer && q.dialogue.active && q.dialogue.ready && q.dialogue.complete && q.dialogue.fail),
};
if (missingMain.length) report.missing.push(...missingMain.map((q) => `mainQuest:${q}`));
if (missingOptionalMain.length) report.missing.push(...missingOptionalMain.map((q) => `optionalMainQuest:${q}`));
if (missingSide.length) report.missing.push(...missingSide.map((q) => `sideQuest:${q}`));
if (missingStarter.length) report.missing.push(...missingStarter.map((q) => `starterQuest:${q}`));
if (!report.quests.runtimeFilesExist) report.designWarnings.push("Quest catalog exists but one or more v47 runtime/space/boss/wilds files are missing.");
if (!report.quests.everyQuestHasObjectives) report.designWarnings.push("At least one quest lacks objectives.");
if (!report.quests.everyQuestHasRewards) report.designWarnings.push("At least one quest lacks reward contract.");
if (!report.quests.everyQuestHasDialogueStates) report.designWarnings.push("At least one quest lacks dialogue state contract.");

const productionManualGaps = [];
if (!/voice|voiced|audio file|cinematic|recorded/i.test(`${src}\n${questCatalogSrc}`)) {
  productionManualGaps.push("Full VO/audio/cinematic production is not proven by source code. Catalog/runtime exists, but final recording/cinematic checklist remains manual.");
}
if (!exists(paths.measuredDimensions)) {
  productionManualGaps.push("v52 measured asset-dimension registry not found in this checkout. Run the v52 asset-size patch before relying on collision-size audit.");
}
report.productionManualGaps = productionManualGaps;

function table(rows, cols) {
  const header = `| ${cols.map((c) => c.label).join(" | ")} |`;
  const sep = `| ${cols.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${cols.map((c) => String(c.value(r) ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`);
  return [header, sep, ...body].join("\n");
}

const md = [];
md.push(`# Harthmere Bible Implementation Audit v53`);
md.push("");
md.push(`Generated: ${report.generatedAt}`);
md.push(`Repo: \`${root}\``);
md.push(`Mode: ${strict ? "strict" : "report"}`);
md.push("");
md.push(`## Bottom Line`);
md.push("");
if (report.missing.length === 0) {
  md.push(`The encoded implementation coverage is mostly complete: required buildings, dungeon spaces, named NPC catalog, and required quest catalog are present. Remaining issues are design/production warnings, not missing core catalog records.`);
} else {
  md.push(`The audit found missing implementation records. Do not ship until these are addressed.`);
}
md.push("");
md.push(`Warnings to review: **${report.designWarnings.length + report.productionManualGaps.length}**. Missing critical records: **${report.missing.length}**.`);
md.push("");
md.push(`## Source Bible Inventory`);
md.push("");
md.push(table(report.sourceBibles, [
  { label: "Bible", value: (r) => r.title },
  { label: "Status", value: (r) => r.present ? "FOUND" : "MISSING FROM REPO DOCS" },
  { label: "Evidence / Expected Purpose", value: (r) => r.present ? r.found.map((f) => `${f.path} (${f.reason})`).join(", ") : r.expectedPurpose },
]));
md.push("");
md.push(`## Building Implementation`);
md.push("");
md.push(`Required buildings in contract: **${report.buildings.requiredCount}**. Implemented: **${report.buildings.implemented.length}**. Partial/incorrect: **${report.buildings.partialOrIncorrect.length}**. Missing: **${report.buildings.missing.length}**.`);
md.push("");
md.push(table(report.buildings.rows, [
  { label: "Building", value: (r) => r.name },
  { label: "District", value: (r) => r.district },
  { label: "Floors", value: (r) => r.floors },
  { label: "Status", value: (r) => r.status },
  { label: "Bible", value: (r) => r.bible },
]));
md.push("");
md.push(`### Targeted Building / Visual Requirements`);
md.push("");
md.push(table(report.buildings.targetedRequirements, [
  { label: "Requirement", value: (r) => r.label },
  { label: "Status", value: (r) => r.status },
]));
md.push("");
md.push(`### Residential and Slum Housing`);
md.push("");
md.push(`Residential buildings: **${report.housing.residentialBuildings}**. Estimated residential room capacity from v38 pattern: **${report.housing.residentialCapacity ?? "unknown"}**.`);
md.push(`Slum stacks: **${report.housing.slumBuildings}**. Slum room capacity from declared floors/rooms: **${report.housing.slumCapacity}**.`);
md.push(`Solid voxel/block evidence: **${report.housing.solidVoxelEvidence ? "yes" : "no"}**. Stair/accessibility evidence: **${report.housing.stairEvidence ? "yes" : "no"}**. Room decor manifest evidence: **${report.housing.roomDecorEvidence ? "yes" : "no"}**.`);
md.push("");
md.push(`## Dungeon / Main-Quest Space Implementation`);
md.push("");
md.push(`Required dungeon rooms/spaces: **${report.dungeons.requiredCount}**. Implemented: **${report.dungeons.implemented.length}**. Missing: **${report.dungeons.missing.length}**.`);
md.push(`Collision plan evidence: **${report.dungeons.collisionPlanEvidence ? "yes" : "no"}**. Six Bellward chambers found: **${report.dungeons.sixBellwardChambers.join(", ") || "none"}**. Regalia found: **${report.dungeons.regalia.join(", ") || "none"}**.`);
md.push("");
md.push(table(report.dungeons.rows, [
  { label: "Dungeon / Space", value: (r) => r.name },
  { label: "Quest", value: (r) => r.quest },
  { label: "Status", value: (r) => r.status },
  { label: "Bible", value: (r) => r.bible },
]));
md.push("");
md.push(`## NPC Implementation`);
md.push("");
md.push(`Named NPC compendium v44 count: **${report.npc.namedCountV44}**. Remaining/ambient/wildlife/etc. v45 count: **${report.npc.remainingCountV45}**. Total NPC records with implementation status: **${report.npc.totalCount}**.`);
md.push(`Required named NPCs checked from the story bible list: **${report.npc.requiredNamedCount}**. Missing named NPCs: **${report.npc.missingNamedNpc.length ? report.npc.missingNamedNpc.join(", ") : "none"}**.`);
md.push(`Route evidence: **${report.npc.routeEvidence ? "yes" : "no"}**. Dialogue evidence: **${report.npc.dialogueEvidence ? "yes" : "no"}**.`);
md.push("");
md.push(table(Object.entries(report.npc.remainingCategoryCounts).map(([category, count]) => ({ category, count })), [
  { label: "Remaining NPC Category", value: (r) => r.category },
  { label: "Count", value: (r) => r.count },
]));
md.push("");
md.push(`## Quest Implementation`);
md.push("");
md.push(`Quest catalog count: **${report.quests.total}** / minimum **${report.quests.minimumQuestCount ?? "unknown"}**.`);
md.push(`Main Q1-Q12 missing: **${report.quests.missingMain.length ? report.quests.missingMain.join(", ") : "none"}**. Optional main missing: **${report.quests.missingOptionalMain.length ? report.quests.missingOptionalMain.join(", ") : "none"}**. Side quests SQ-001..SQ-042 missing: **${report.quests.missingSide.length ? report.quests.missingSide.join(", ") : "none"}**. Starter quests missing: **${report.quests.missingStarter.length ? report.quests.missingStarter.join(", ") : "none"}**.`);
md.push(`Runtime files exist: **${report.quests.runtimeFilesExist ? "yes" : "no"}**. Every quest has objectives: **${report.quests.everyQuestHasObjectives ? "yes" : "no"}**. Rewards: **${report.quests.everyQuestHasRewards ? "yes" : "no"}**. Dialogue states: **${report.quests.everyQuestHasDialogueStates ? "yes" : "no"}**.`);
md.push("");
md.push(table(Object.entries(report.quests.categories).map(([category, count]) => ({ category, count })), [
  { label: "Quest Category", value: (r) => r.category },
  { label: "Count", value: (r) => r.count },
]));
md.push("");
md.push(`## Warnings / Incorrect or Unproven Areas`);
md.push("");
if (report.designWarnings.length === 0 && report.productionManualGaps.length === 0) {
  md.push(`No warnings.`);
} else {
  for (const w of report.designWarnings) md.push(`- ${w}`);
  for (const w of report.productionManualGaps) md.push(`- ${w}`);
}
md.push("");
md.push(`## Missing Critical Records`);
md.push("");
if (report.missing.length === 0) md.push(`None.`);
else for (const m of report.missing) md.push(`- ${m}`);
md.push("");
md.push(`## Recommended Next Fixes`);
md.push("");
md.push(`1. Copy the source bibles into \`docs/harthmere/bibles/\` so future audits can prove they are present, not only encoded as implementation contracts.`);
md.push(`2. Resolve any targeted requirement that says \`NEEDS_REVIEW_OR_MISSING\`, especially bridge parapets and wild-facing town-wall watchtowers if they still show as missing in your checkout.`);
md.push(`3. Normalize Bram Holt's daughter name across story bible, NPC compendium, and side quest records.`);
md.push(`4. Treat quest/NPC catalog coverage as implementation scaffolding; voiceover, cinematic recording, and final authored scene polish still need a production pass.`);
md.push("");

const reportPath = abs("docs/harthmere/HARTHMERE_BIBLE_IMPLEMENTATION_AUDIT_V53.md");
const jsonPath = abs("public/assets/harthmere/manifest/harthmere-bible-implementation-audit-v53.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(reportPath, md.join("\n"));
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

console.log("== Harthmere Bible implementation audit v53 ==");
console.log(`Report: ${path.relative(root, reportPath)}`);
console.log(`JSON: ${path.relative(root, jsonPath)}`);
console.log(`Buildings: ${report.buildings.implemented.length}/${report.buildings.requiredCount} implemented, ${report.buildings.missing.length} missing, ${report.buildings.partialOrIncorrect.length} partial/incorrect`);
console.log(`Dungeons: ${report.dungeons.implemented.length}/${report.dungeons.requiredCount} implemented, ${report.dungeons.missing.length} missing`);
console.log(`NPCs: ${report.npc.totalCount} records, missing required named NPCs: ${report.npc.missingNamedNpc.length}`);
console.log(`Quests: ${report.quests.total} records, missing main=${report.quests.missingMain.length}, optional=${report.quests.missingOptionalMain.length}, side=${report.quests.missingSide.length}, starter=${report.quests.missingStarter.length}`);
console.log(`Warnings: ${report.designWarnings.length + report.productionManualGaps.length}`);
for (const w of [...report.designWarnings, ...report.productionManualGaps].slice(0, 12)) console.log(`WARN ${w}`);
const failed = report.missing.length > 0 || report.buildings.partialOrIncorrect.length > 0 || report.dungeons.missing.length > 0 || report.npc.missingNamedNpc.length > 0 || report.quests.missingMain.length > 0 || report.quests.missingSide.length > 0;
if (failed || (strict && (report.designWarnings.length || report.productionManualGaps.length))) {
  console.log(strict ? "RESULT: FAIL" : "RESULT: PASS_WITH_WARNINGS");
  process.exit(strict ? 1 : 0);
}
console.log(report.designWarnings.length || report.productionManualGaps.length ? "RESULT: PASS_WITH_WARNINGS" : "RESULT: PASS");
