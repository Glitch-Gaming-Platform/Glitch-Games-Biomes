#!/usr/bin/env node
/* SNAPSHOT_GROVE_NPC_BOUNDS_PASS_VERSION
 * SNAPSHOT_NPC_VISUAL_BOUNDS_PASS
 * No-dependency glTF/GLB bounds audit for Grove snapshot NPC assets.
 * It reads accessor min/max values, verifies feet origin is near 0, and writes
 * a report that tells us whether to use the raw visual placement or hide the
 * raw decorative copy in favor of grounded ECS actors.
 */
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const out = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'tmp/snapshot-npc-bounds.json');
const maxFeetOriginError = 0.05;
const maxRuntimeFeetClearance = 0.25; // runtime feet-to-ground tolerance in meters

const npcPatterns = [
  ['jackie', /jackie\..*\.glb$/i],
  ['ranger_jane', /ranger_jane\..*\.glb$/i],
  ['luis', /luis\..*\.glb$/i],
  ['taye', /taye\..*\.glb$/i],
  ['alexis', /alexis\..*\.glb$/i],
  ['sil', /sil\..*\.glb$/i],
  ['dimmi', /dimmi\..*\.glb$/i],
  ['doc', /doc\..*\.glb$/i],
  ['old_coop', /oldCoop\..*\.glb$/i],
  ['buddy', /buddy\..*\.gltf$/i],
  ['mucked_robot', /mucked_robot\..*\.gltf$/i],
];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '__MACOSX') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.isFile() && /\.(glb|gltf)$/i.test(entry.name)) acc.push(p);
  }
  return acc;
}

function glbJson(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error('not GLB');
  const jsonLength = buffer.readUInt32LE(12);
  const chunkType = buffer.toString('utf8', 16, 20);
  if (chunkType !== 'JSON') throw new Error('missing JSON chunk');
  return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength));
}

function gltfJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function boundsFromGltf(json) {
  const vec3Accessors = (json.accessors ?? []).filter((accessor) => {
    if (accessor.type !== 'VEC3') return false;
    if (!Array.isArray(accessor.min) || !Array.isArray(accessor.max)) return false;
    // POSITION accessors usually have FLOAT or unnormalized integer voxel positions.
    if (accessor.normalized) return false;
    return true;
  });
  if (!vec3Accessors.length) return undefined;
  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];
  for (const accessor of vec3Accessors) {
    for (let i = 0; i < 3; i++) {
      mins[i] = Math.min(mins[i], Number(accessor.min[i]));
      maxs[i] = Math.max(maxs[i], Number(accessor.max[i]));
    }
  }
  return { min: mins, max: maxs, height: maxs[1] - mins[1] };
}

const roots = [
  path.join(root, 'public/buckets/biomes-static/asset_data/npcs'),
  path.join(root, 'public/assets/biomes-static/asset_data/npcs'),
  path.join(root, 'public/assets/asset_data/npcs'),
  path.join(root, 'public/assets/harthmere'),
].filter(fs.existsSync);
const files = roots.flatMap((dir) => walk(dir));

const records = [];
for (const [npcId, pattern] of npcPatterns) {
  const file = files.find((candidate) => pattern.test(path.basename(candidate)) || pattern.test(candidate));
  if (!file) {
    records.push({ npcId, found: false, pass: false, reason: 'asset_not_found' });
    continue;
  }
  try {
    const json = /\.glb$/i.test(file) ? glbJson(file) : gltfJson(file);
    const bounds = boundsFromGltf(json);
    if (!bounds) {
      records.push({ npcId, found: true, file: path.relative(root, file), pass: false, reason: 'no_position_bounds' });
      continue;
    }
    const feetOriginError = Math.abs(bounds.min[1]);
    records.push({
      npcId,
      found: true,
      file: path.relative(root, file),
      min: bounds.min,
      max: bounds.max,
      height: bounds.height,
      feetOriginError,
      feetClearance: feetOriginError,
      pass: feetOriginError <= maxFeetOriginError,
      decision: 'hide_raw_decorative_copy_use_grounded_server_actor',
    });
  } catch (error) {
    records.push({ npcId, found: true, file: path.relative(root, file), pass: false, reason: error.message });
  }
}

const result = {
  version: 'snapshot-grove-npc-visual-bounds-pass',
  root,
  searchedRoots: roots.map((p) => path.relative(root, p)),
  maxFeetOriginError,
  maxRuntimeFeetClearance,
  total: records.length,
  failures: records.filter((record) => !record.pass),
  records,
  conclusion: records.every((record) => record.pass)
    ? 'all_found_snapshot_npc_assets_have_feet_origin_near_zero_hide_raw_decorative_duplicates_and_use_grounded_ecs_actors'
    : 'some_snapshot_npc_asset_bounds_need_review_or_assets_were_not_installed',
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(`WROTE ${out}`);
console.log(`Bounds records: ${result.total}`);
console.log(`Failures: ${result.failures.length}`);
console.log(result.conclusion);
process.exit(result.failures.length ? 1 : 0);
