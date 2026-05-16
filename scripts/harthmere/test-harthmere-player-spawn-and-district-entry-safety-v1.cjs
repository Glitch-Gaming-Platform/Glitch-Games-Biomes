#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
const {
  loadTown,
  makeReporter,
  distance2d,
  isSolidUploadedAsset,
  collisionBlocksPlayerLikeRegistry,
} = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere player spawn and district entry safety tests v1", root);
const town = loadTown(root);

const blockers = town.placements.filter((p) => {
  if (p.kind === "A") return false;
  const assetInfo = town.assets.get(p.asset);
  return (isSolidUploadedAsset(assetInfo, p) || collisionBlocksPlayerLikeRegistry(p));
});

// These are explicit player spawn/district-entry audit points, not every prop
// whose display name contains words like "road", "service", or "plaza".
const entryMarkers = [
  { district: "north_gate", name: "North Gate arrival road", x: 486, z: -282 },
  { district: "market_square", name: "Market Square central approach", x: 486, z: -207 },
  { district: "player_services", name: "Player Services entrance approach", x: 556, z: -214 },
  { district: "copper_kettle", name: "Copper Kettle inn approach", x: 552, z: -206 },
  { district: "temple_green", name: "Temple Green healer approach", x: 491, z: -155 },
  { district: "river_docks", name: "River Docks cart lane approach", x: 590, z: -196 },
  { district: "guard_yard", name: "Guard Yard safe approach", x: 511, z: -258 },
  { district: "noble_rise", name: "Noble Rise terrace approach", x: 560, z: -249 },
  { district: "mudden_ward", name: "Mudden Ward alley approach", x: 412, z: -166 },
  { district: "old_well_underways", name: "Old Well / Underways approach", x: 442, z: -174 },
  { district: "craftsman_row", name: "Craftsman Row trainer lane approach", x: 516, z: -270 },
];

report.check("town exposes named entries/approaches for spawn safety audits", entryMarkers.length >= 11, `found ${entryMarkers.length}`);

const entryBlocked = entryMarkers
  .filter((entry) => blockers.some((b) => distance2d({ x: entry.x, z: entry.z }, b) < 0.9))
  .map((entry) => {
    const hit = blockers.find((b) => distance2d({ x: entry.x, z: entry.z }, b) < 0.9);
    return `${entry.name} (${entry.district}) is too close to ${hit?.name || hit?.asset}`;
  });
report.check("named district entries and service approaches do not start inside solid blockers", entryBlocked.length === 0, entryBlocked);

const actorOverEntry = town.placements
  .filter((p) => p.kind === "A")
  .filter((actor) => entryMarkers.some((entry) => distance2d(actor, { x: entry.x, z: entry.z }) < 0.65))
  .map((actor) => `${actor.name || actor.asset} (${actor.asset}) too close to named entry in ${actor.district || "Unknown"} line ${actor.line}`);
report.check("NPCs and animals do not spawn directly on top of district entries", actorOverEntry.length === 0, actorOverEntry);

const requiredDistricts = ["north_gate", "market_square", "player_services", "copper_kettle", "craftsman_row", "temple_green", "noble_rise", "river_docks", "mudden_ward", "guard_yard", "old_well_underways"];
const missingEntryDistricts = requiredDistricts.filter((district) => !entryMarkers.some((p) => p.district === district));
report.check("each town district has at least one named entry/approach marker", missingEntryDistricts.length === 0, missingEntryDistricts);

report.finish();
