#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
function abs(rel) { return path.join(root, rel); }
function read(rel) { return fs.readFileSync(abs(rel), "utf8"); }
function write(rel, text) { fs.writeFileSync(abs(rel), text); }

const assetsRel = "src/client/game/renderers/local_dev/harthmere_assets.ts";
const registryRel = "src/shared/harthmere/town_registry.ts";
let assets = read(assetsRel);
let registry = read(registryRel);

const collisionSnippet = `
  // HARTHMERE_WALKABLE_BRIDGE_COLLISION_V54
  // Bridge decks are an approved road/checkpoint exception. They must be
  // walkable floor/road surfaces, while the parapets remain blocking rails.
  if (/HARTHMERE_WALKABLE_BRIDGE_V54|HARTHMERE_WILDS_THORNBRIDGE_V54|walkable bridge deck|old bridge pedestrian lane|bridge crack inspection lane/i.test(label)) {
    return { category: "none", blocksNpc: false, blocksPlayer: false, reason: "v54 walkable bridge deck is a road/floor surface, not an obstacle" };
  }
  if (/HARTHMERE_BRIDGE_PARAPET_V54|bridge parapet|parapet rail/i.test(label)) {
    return { category: "playerBlocker", halfX: scaled(3.2, scale), halfZ: scaled(0.34, scale), padding: 0.12, blocksNpc: true, blocksPlayer: true, reason: "v54 bridge parapet blocks bridge edges while preserving the central walkable lane" };
  }
`;
if (!registry.includes("HARTHMERE_WALKABLE_BRIDGE_COLLISION_V54")) {
  const needle = `  const kind = input.kind ?? inferHarthmerePlacementKind(input);\n`;
  if (!registry.includes(needle)) throw new Error("Could not find collision insertion point in town_registry.ts");
  registry = registry.replace(needle, needle + collisionSnippet);
  write(registryRel, registry);
  console.log("PATCHED src/shared/harthmere/town_registry.ts bridge deck/parapet collision policy v54");
} else {
  console.log("SKIP town_registry.ts already has bridge deck/parapet collision policy v54");
}

const helperSnippet = `
const HARTHMERE_WALKABLE_BRIDGE_VERSION_V54 = "harthmere-walkable-bridge-with-parapets-v54";
const HARTHMERE_WILDS_LANDMARKS_VERSION_V54 = "harthmere-wilds-landmark-completion-v54";

function createHarthmereOldBridgeWalkableParapetsV54(): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  placements.push(
    P("obj_bridge_medium_body", 486, -206, Math.PI / 2, 0.86, "HARTHMERE_WALKABLE_BRIDGE_V54 Old Bridge walkable bridge deck visual under 12m clear lane no blocker", "Old Bridge"),
    ...row("road", "Old Bridge", "HARTHMERE_WALKABLE_BRIDGE_V54 old bridge pedestrian lane stone deck 12m clear bridge crack inspection lane", 462, -206, 8, 7, 0, Math.PI / 2, 0.76),
    ...row("obj_wall_simple", "Old Bridge", "HARTHMERE_BRIDGE_PARAPET_V54 north bridge parapet rail outside walk lane", 462, -199.5, 8, 7, 0, 0, 0.42),
    ...row("obj_wall_simple", "Old Bridge", "HARTHMERE_BRIDGE_PARAPET_V54 south bridge parapet rail outside walk lane", 462, -212.5, 8, 7, 0, 0, 0.42),
    P("obj_lamp_ground_small", 462, -202.2, 0, 0.44, "Old Bridge lantern outside pedestrian lane west", "Old Bridge"),
    P("obj_lamp_ground_small", 510, -209.8, Math.PI, 0.44, "Old Bridge lantern outside pedestrian lane east", "Old Bridge"),
    P("coin_pile", 486, -206, 0, 0.2, "Bellbound Q1 bronze disc set into Old Bridge cobbles at crack center", "Old Bridge", GROUND_Y + 0.05),
    P("scroll_1_fp", 486.7, -205.2, 0.25, 0.16, "Bell-shaped crack decal flush with Old Bridge stone deck", "Old Bridge", GROUND_Y + 0.06),
    P("road", 452, -206, Math.PI / 2, 0.7, "Old Bridge west approach ramp road continuation clear mount path", "Old Bridge"),
    P("road", 520, -206, Math.PI / 2, 0.7, "Old Bridge east approach ramp road continuation clear mount path", "Old Bridge"),
  );
  return placements;
}

function createHarthmereWildsBibleLandmarkPlacementsV54(): RuntimePlacement[] {
  const placements: RuntimePlacement[] = [];
  placements.push(
    // Thornbridge Crossing: explicit walkable small bridge with thorny edges and ribbon clue.
    P("obj_bridge_low_body", 338, -498, Math.PI / 2, 0.72, "HARTHMERE_WILDS_THORNBRIDGE_V54 Thornbridge Crossing walkable bridge deck over creek", "Harthmere Wilds - Thornbridge Crossing"),
    ...row("road", "Harthmere Wilds - Thornbridge Crossing", "HARTHMERE_WILDS_THORNBRIDGE_V54 Thornbridge Crossing walkable bridge path", 324, -498, 5, 7, 0, Math.PI / 2, 0.58),
    P("hedge_large", 336, -491, 0.15, 0.56, "Thornbridge Crossing thorn bushes north edge", "Harthmere Wilds - Thornbridge Crossing"),
    P("hedge_large", 340, -505, -0.12, 0.56, "Thornbridge Crossing thorn bushes south edge", "Harthmere Wilds - Thornbridge Crossing"),
    P("banner_white", 336, -492.2, 0, 0.34, "Traveler luck ribbon tied at Thornbridge Crossing", "Harthmere Wilds - Thornbridge Crossing", GROUND_Y + 0.7),
    P("dagger", 348, -500, -0.4, 0.38, "Cut ribbon warning left by bandits at Thornbridge Crossing", "Harthmere Wilds - Thornbridge Crossing", GROUND_Y + 0.45),

    // Split Oak: waypoint with one living and one dead side.
    P("tree_high", 216, -286, 0.1, 1.22, "Split Oak living green half waypoint", "Harthmere Wilds - Split Oak"),
    P("tree_crooked", 219, -286, -0.2, 1.14, "Split Oak black lightning-dead half waypoint", "Harthmere Wilds - Split Oak"),
    P("pillar", 216.8, -291, 0, 0.42, "Split Oak druid priest argument stone marker", "Harthmere Wilds - Split Oak"),

    // Witchlight Pool: Briarfen mystery landmark with visible lights over dark water.
    P("rock_wide", 928, -286, 0.1, 0.92, "Witchlight Pool dark water rim", "Harthmere Wilds - Witchlight Pool"),
    P("lantern", 924, -282, 0, 0.42, "Witchlight Pool hovering false light one", "Harthmere Wilds - Witchlight Pool", GROUND_Y + 1.05),
    P("lantern", 932, -290, 0, 0.38, "Witchlight Pool hovering false light two", "Harthmere Wilds - Witchlight Pool", GROUND_Y + 1.18),
    A("animal_frog", 922, -292, 0, 0.9, "Frog at Witchlight Pool", "Harthmere Wilds - Witchlight Pool", { radius: 1.0, speed: 0.3, phase: 1.2 }),
    A("townsperson_smuggler", 938, -278, Math.PI, 1.04, "Smuggler listening near Witchlight Pool", "Harthmere Wilds - Witchlight Pool", { radius: 2.8, speed: 0.14, phase: 2.7 }),

    // Old Quarry Cut: explicit mining landmark and danger hook.
    P("mine_stone_01", 168, -566, 0, 0.9, "Old Quarry Cut rough stone face", "Harthmere Wilds - Old Quarry Cut"),
    P("mine_coal_block", 176, -572, 0.1, 0.7, "Old Quarry Cut coal seam", "Harthmere Wilds - Old Quarry Cut"),
    P("mine_silver_stone", 184, -558, -0.1, 0.72, "Old Quarry Cut silver vein pocket", "Harthmere Wilds - Old Quarry Cut"),
    P("minecart", 164, -552, 0.3, 0.62, "Old Quarry Cut abandoned minecart", "Harthmere Wilds - Old Quarry Cut"),
    P("pickaxe_bronze_fp", 170, -554, -0.4, 0.44, "Old Quarry Cut mining pick beside real ore", "Harthmere Wilds - Old Quarry Cut", GROUND_Y + 0.45),
    A("animal_snake", 188, -566, -0.5, 0.92, "Quarry snake in warm stones", "Harthmere Wilds - Old Quarry Cut", { radius: 0.8, speed: 0.14, phase: 0.6 }),
  );
  return placements;
}
`;
if (!assets.includes("HARTHMERE_WALKABLE_BRIDGE_VERSION_V54")) {
  const needle = `const PLACEMENTS: RuntimePlacement[] = [`;
  if (!assets.includes(needle)) throw new Error("Could not find PLACEMENTS insertion point in harthmere_assets.ts");
  assets = assets.replace(needle, helperSnippet + "\n" + needle);
}

if (!assets.includes("...createHarthmereOldBridgeWalkableParapetsV54(),")) {
  const needle = `  // North Gate: fortified arrival, stable, toll booth, and watch identity.\n`;
  if (!assets.includes(needle)) throw new Error("Could not find bridge call insertion point before North Gate section");
  assets = assets.replace(needle, `  // Old Bridge: Q1 walkable stone bridge deck, parapets, and bronze bell-crack disc.\n  ...createHarthmereOldBridgeWalkableParapetsV54(),\n\n` + needle);
}

if (!assets.includes("...createHarthmereWildsBibleLandmarkPlacementsV54(),")) {
  const needle = `  // HARTHMERE_V11_WIDE_WILDS_MILE_START\n`;
  if (!assets.includes(needle)) throw new Error("Could not find wilds landmark call insertion point");
  assets = assets.replace(needle, `  // Wilds bible v54: named landmark completion anchors.\n  ...createHarthmereWildsBibleLandmarkPlacementsV54(),\n\n` + needle);
}

write(assetsRel, assets);
console.log("PATCHED src/client/game/renderers/local_dev/harthmere_assets.ts bridge and Wilds landmark runtime placements v54");
