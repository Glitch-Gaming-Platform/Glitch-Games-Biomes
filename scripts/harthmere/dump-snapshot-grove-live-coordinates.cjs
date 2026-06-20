#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const rel = "src/shared/harthmere/snapshot_grove_content.ts";
const file = path.join(root, rel);
const src = fs.readFileSync(file, "utf8");

const npcBlockMatch = src.match(/export const SNAPSHOT_GROVE_NPCS:[\s\S]*?= \[([\s\S]*?)\n\];\n\nexport const SNAPSHOT_GROVE_LANDMARKS/);
if (!npcBlockMatch) {
  console.error(`Could not find SNAPSHOT_GROVE_NPCS in ${rel}`);
  process.exit(1);
}

const npcs = [];
const entryRegex = /\{\s*id: "([^"]+)"[\s\S]*?displayName: "([^"]+)"[\s\S]*?seedServerNpc: (true|false)[\s\S]*?homeArea: "([^"]+)"[\s\S]*?authoredPosition: \[([^,]+),\s*SNAPSHOT_GROVE_NPC_FEET_Y,\s*([^\]]+)\]/g;
let match;
while ((match = entryRegex.exec(npcBlockMatch[1]))) {
  const [, id, displayName, seedServerNpc, homeArea, xRaw, zRaw] = match;
  const x = Number(xRaw.trim());
  const y = 70;
  const z = Number(zRaw.trim());
  npcs.push({ id, displayName, seedServerNpc: seedServerNpc === "true", homeArea, authored: [x, y, z] });
}

const seeded = npcs.filter((npc) => npc.seedServerNpc);
const xs = seeded.map((npc) => npc.authored[0]);
const zs = seeded.map((npc) => npc.authored[2]);
const bounds = {
  minX: Math.min(...xs),
  maxX: Math.max(...xs),
  minZ: Math.min(...zs),
  maxZ: Math.max(...zs),
  center: [
    Math.round((Math.min(...xs) + Math.max(...xs)) / 2),
    70,
    Math.round((Math.min(...zs) + Math.max(...zs)) / 2),
  ],
};

const landmarks = [];
const landmarkRegex = /\{ id: "([^"]+)", label: "([^"]+)", position: \[([^,]+),\s*SNAPSHOT_GROVE_MARKER_Y,\s*([^\]]+)\]/g;
while ((match = landmarkRegex.exec(src))) {
  const [, id, label, xRaw, zRaw] = match;
  landmarks.push({ id, label, position: [Number(xRaw.trim()), 68, Number(zRaw.trim())] });
}

const output = {
  note: "Coordinates use authored Grove X/Z and live installed-snapshot Grove Y. With BIOMES_FORCE_LOCAL_DEV_TOWN=1 these must NOT receive the +512 Harthmere offset. The broken logs showed old logs showed player y=70.5 and seeded NPC y=53; the current Grove fountain console output reports player y=69.875, so live NPC feet should remain on the y=70 installed-snapshot band.",
  courtyardApproxBoundsFromSeededGroveNpcCast: bounds,
  keyCourtyardMarkers: landmarks.filter((l) => [
    "the_grove",
    "old_grove_road_post",
    "paint_pot",
    "luis_cart",
    "lovely_locks_mirror",
    "service_tower_platform",
  ].includes(l.id)),
  seededGroveNpcs: seeded,
};

console.log(JSON.stringify(output, null, 2));
