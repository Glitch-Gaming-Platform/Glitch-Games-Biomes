#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..', '..');
const mainPath = path.join(repo, 'src/server/shim/main.ts');
const src = fs.readFileSync(mainPath, 'utf8');
const offsetX = Number.parseInt(process.env.BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X || '512', 10);
const offsetZ = Number.parseInt(process.env.BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z || '0', 10);
const enabled = process.env.BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN === '1';
const forced = process.env.BIOMES_FORCE_LOCAL_DEV_TOWN === '1';
const regex = /starterNpc\(\s*(\d+),\s*"([^"]+)",\s*\[(\d+),\s*y,\s*(-?\d+)\]/g;
const npcs = [];
let match;
while ((match = regex.exec(src))) {
  const offset = Number(match[1]);
  const name = match[2];
  const x = Number(match[3]);
  const z = Number(match[4]);
  npcs.push({ offset, name, authored: [x, 53, z], shifted: [x + offsetX, 53, z + offsetZ] });
}
const dump = { version: 'dump-harthmere-npc-placement-state-v2', generatedAt: new Date().toISOString(), mode: { BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN: process.env.BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN || '', BIOMES_FORCE_LOCAL_DEV_TOWN: process.env.BIOMES_FORCE_LOCAL_DEV_TOWN || '', shouldAppear: enabled || forced, expectedCoordinateSet: enabled && !forced ? 'shifted' : forced ? 'authored-legacy' : 'none-snapshot-only', offsetX, offsetZ }, counts: { npcs: npcs.length }, npcs };
const outDir = path.join(repo, 'harthmere-debug-dumps');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `harthmere-npc-placement-state-v2.${Date.now()}.json`);
fs.writeFileSync(out, JSON.stringify(dump, null, 2));
console.log(`WROTE ${out}`);
console.log(JSON.stringify({ mode: dump.mode, counts: dump.counts, firstFive: npcs.slice(0, 5) }, null, 2));
