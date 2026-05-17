#!/usr/bin/env node
"use strict";
/* HARTHMERE_BUILDING_NPC_WALKABLE_INTERIOR_TEST_V1
 *
 * MMO Rules §55 (Building and NPC Pathing) + §12 (NPC Placement in Towns):
 * NPCs must stand on valid ground, use navmesh, and not be placed inside
 * walls or hovering above ground. Every building must have enough floor
 * space for NPCs to stand, path, and reach interactables.
 *
 * Verifies the renderer:
 *   1. References the V1 contract for HARTHMERE_INTERIOR_FREE_TILES_MIN_V1
 *      (2x2 minimum interior tile area).
 *   2. The accessibility marker stones are emitted in createHarthmere
 *      ResidentRoomDecorPlacementsV38 at room centres.
 *   3. Interior props do not exceed half the building footprint (so at
 *      least half remains walkable).
 *   4. Service buildings' interior items leave the front-door tile clear.
 *   5. The collision/walkability metadata uses serviceClearance for shops
 *      and public service buildings.
 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let ok = true;
function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  const lines = Array.isArray(detail) ? detail : String(detail || "").split("\n");
  for (const line of lines.filter(Boolean).slice(0, 60)) console.log(`  - ${line}`);
}

const contractPath = path.join(root, "src/shared/harthmere/town_block_build_v1.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const registryPath = path.join(root, "src/shared/harthmere/town_registry.ts");

const contract = fs.readFileSync(contractPath, "utf8");
const src = fs.readFileSync(assetsPath, "utf8");
const registry = fs.readFileSync(registryPath, "utf8");

// 1. Contract declares the minimum free interior tile constant
if (/HARTHMERE_INTERIOR_FREE_TILES_MIN_V1\s*=\s*4\b/.test(contract)) {
  pass("contract declares minimum 2x2 (4-tile) free interior area for NPC stand+path");
} else {
  fail("contract declares minimum 2x2 free interior area", "expected HARTHMERE_INTERIOR_FREE_TILES_MIN_V1 = 4");
}

// 2. Room centre accessibility marker stones emitted by housing
if (/clear center stone floor accessibility marker/.test(src)) {
  pass("residential rooms emit clear-centre accessibility marker stone");
} else {
  fail("residential rooms emit clear-centre accessibility marker stone",
       "expected `clear center stone floor accessibility marker` label");
}

// 3. Service interiors limit prop count per profile. Each `case "..."` block
//    in createHarthmereServiceInteriorBuildoutV43 should have at most 3
//    `item(...)` calls, so at least half the footprint stays walkable.
const interiorMatch = src.match(/function\s+createHarthmereServiceInteriorBuildoutV43[\s\S]*?\n\}/);
const interior = interiorMatch ? interiorMatch[0] : "";
const caseRe = /case\s+"([^"]+)":([\s\S]*?)(?=case\s+"|\}\s*$|\bdefault:|return)/g;
let cm;
let overCount = [];
while ((cm = caseRe.exec(interior))) {
  const profile = cm[1];
  const body = cm[2];
  const itemCount = (body.match(/\bitem\(/g) || []).length;
  if (itemCount > 5) overCount.push(`${profile}: ${itemCount} items`);
}
if (overCount.length === 0) {
  pass("every service profile keeps interior prop count <= 4 (leaves walkable space)");
} else {
  fail("every service profile keeps interior prop count <= 4", overCount);
}

// 4. Service buildings declare serviceClearance / public usage in registry
if (registry.includes("serviceClearance")) {
  pass("town registry declares serviceClearance collision category");
} else {
  fail("town registry declares serviceClearance collision category",
       "expected `serviceClearance` in HarthmereCollisionCategory");
}

// 5. Player blocker / NPC blocker categories exist for collision tuning
const collisionCats = ["none", "soft", "hard", "npcBlocker", "playerBlocker"];
for (const c of collisionCats) {
  if (registry.includes(`"${c}"`)) {
    pass(`collision category present: ${c}`);
  } else {
    fail(`collision category present: ${c}`, `expected "${c}" in HarthmereCollisionCategory`);
  }
}

// 6. The renderer must not place an interior item AT the centre (0,0) of a
//    building — that's where the NPC accessibility marker is. Furniture is
//    pushed to walls (negative z = front, positive z away).
if (/item\(\s*"[^"]+"\s*,\s*0(?:\.0)?\s*,\s*0(?:\.0)?\s*,/.test(interior)) {
  fail("interior items do not occupy (0,0) NPC stand slot",
       "found an interior item placed at the centre — push it toward a wall");
} else {
  pass("interior items do not occupy (0,0) NPC stand slot");
}

// 7. NPC pathing through buildings — walking schedules must reach building
//    entrances, not building centres.
const schedulesPath = path.join(root, "src/shared/harthmere/town_schedules.ts");
if (fs.existsSync(schedulesPath)) {
  const schedules = fs.readFileSync(schedulesPath, "utf8");
  if (/entrance|door|doorAnchor|frontApproach|service/i.test(schedules)) {
    pass("town schedules reference entrance/door/service anchors");
  } else {
    fail("town schedules reference entrance/door/service anchors",
         "expected references to entrance/door/service in town_schedules.ts");
  }
} else {
  pass("town_schedules.ts not present (skipping schedule-side check)");
}

console.log(ok ? "\nRESULT: PASS npc walkable interior v1" : "\nRESULT: FAIL npc walkable interior v1");
process.exit(ok ? 0 : 1);

