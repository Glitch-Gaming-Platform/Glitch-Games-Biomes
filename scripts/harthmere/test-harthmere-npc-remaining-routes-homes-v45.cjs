#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const v44Path = path.join(root, "src/shared/harthmere/npc_compendium_v44.ts");
const v45Path = path.join(root, "src/shared/harthmere/npc_compendium_v45.ts");
const v44Text = fs.readFileSync(v44Path, "utf8");
const v45Text = fs.readFileSync(v45Path, "utf8");
function parseArray(text, name) {
  const re = new RegExp(String.raw`export const ${name} = (\[[\s\S]*?\]) as const;`);
  const match = text.match(re);
  if (!match) throw new Error(`Could not parse ${name}`);
  return JSON.parse(match[1]);
}
const named = parseArray(v44Text, "HARTHMERE_NAMED_NPCS_V44");
const remaining = parseArray(v45Text, "HARTHMERE_REMAINING_NPCS_V45");
const all = [...named, ...remaining];
function assert(cond, msg) {
  if (!cond) { console.error("FAIL", msg); process.exitCode = 1; }
  else { console.log("OK", msg); }
}

for (const npc of remaining) {
  assert(npc.route && npc.route.routeId && npc.route.routeStyle, `${npc.id} has route id/style`);
  assert(npc.route.homeLocation === npc.home, `${npc.id} route home matches home`);
  assert(npc.route.goesHomeDaily === true, `${npc.id} goes home daily`);
  assert(Array.isArray(npc.route.schedule) && npc.route.schedule.length >= 4, `${npc.id} has at least four schedule beats`);
  assert(npc.route.schedule.some((beat) => beat.location === "home" || beat.location.includes("den") || beat.location.includes("grave") || beat.location.includes("memory") || beat.location.includes("lair")), `${npc.id} has home/den/lair/memory return beat`);
  for (const beat of npc.route.schedule) {
    assert(Number.isInteger(beat.hour) && beat.hour >= 0 && beat.hour <= 23, `${npc.id} beat hour valid ${beat.hour}`);
    assert(Array.isArray(beat.waypoint) && beat.waypoint.length === 3, `${npc.id} beat waypoint is 3D`);
    assert(beat.district && beat.activity && beat.activity.length >= 20, `${npc.id} beat has district/activity`);
  }
  if (npc.role === "guard" || npc.role === "recruit_guard") assert(npc.route.routeStyle === "guard_patrol", `${npc.id} guard uses guard_patrol route`);
  if (npc.role === "animal") assert(npc.route.routeStyle === "wildlife_roam", `${npc.id} animal uses wildlife_roam route`);
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc remaining routes homes v45");
