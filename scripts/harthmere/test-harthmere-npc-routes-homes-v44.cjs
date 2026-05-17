#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const compendiumPath = path.join(root, "src/shared/harthmere/npc_compendium_v44.ts");
const text = fs.readFileSync(compendiumPath, "utf8");
const match = text.match(/export const HARTHMERE_NAMED_NPCS_V44 = (\[[\s\S]*?\]) as const;/);
if (!match) throw new Error("Could not parse HARTHMERE_NAMED_NPCS_V44 JSON literal");
const npcs = JSON.parse(match[1]);
function assert(cond, msg) { if (!cond) { console.error("FAIL", msg); process.exitCode = 1; } else { console.log("OK", msg); } }

for (const npc of npcs) {
  const route = npc.route;
  assert(route && route.routeId && route.routeStyle, `${npc.id} has route id/style`);
  assert(route.homeLocation === npc.home, `${npc.id} route home matches NPC home`);
  assert(route.goesHomeDaily === true, `${npc.id} goes home daily`);
  assert(Array.isArray(route.schedule) && route.schedule.length >= 4, `${npc.id} has at least four schedule beats`);
  assert(route.schedule.some((s) => s.location === "home" || /home|rest|sleep/i.test(s.activity)), `${npc.id} has home/rest schedule beat`);
  for (const beat of route.schedule) {
    assert(Number.isInteger(beat.hour) && beat.hour >= 0 && beat.hour <= 23, `${npc.id} beat hour valid ${beat.hour}`);
    assert(Array.isArray(beat.waypoint) && beat.waypoint.length === 3, `${npc.id} beat waypoint is 3D`);
    assert(beat.district && beat.activity.length >= 18, `${npc.id} beat has district/activity`);
  }
  if (npc.role === "guard") assert(route.routeStyle === "guard_patrol", `${npc.id} guard uses guard_patrol route`);
}
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS npc routes homes v44");
