#!/usr/bin/env node
// SNAPSHOT_CANONICAL_CHALLENGE_EXTRACTOR_V76
// Reads the installed snapshot source NUX state machine and emits the hard Road Ahead/Busted
// step ids used by the playable mission bridge. This is intentionally separate from the
// Glitch-authored Grove bible quests: the source-visible snapshot only exposes the NUX chain
// cleanly here; non-NUX Bikkie biscuits still need a readable export if they exist.

const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const outPath = process.argv[3] || path.join(root, 'tmp', 'snapshot-challenge-extraction-v76.json');
const sourcePath = path.join(root, 'src/client/util/nux/state_machines.ts');
if (!fs.existsSync(sourcePath)) {
  console.error(`Missing snapshot NUX state machine source: ${sourcePath}`);
  process.exit(1);
}
const text = fs.readFileSync(sourcePath, 'utf8');
const enumBlock = /enum\s+NUX_PAIRED_STEPS\s*\{([\s\S]*?)\}/.exec(text)?.[1] || '';
const entries = [...enumBlock.matchAll(/([A-Z0-9_]+)\s*=\s*(\d+)/g)].map((m) => ({
  key: m[1],
  pairedStepId: m[2],
  source: 'src/client/util/nux/state_machines.ts',
}));
const required = [
  'ROAD_AHEAD_MEET_UP_WITH_BILLY',
  'ROAD_AHEAD_COLLECT_MUCKWAD',
  'ROAD_AHEAD_PLACE_BLOCKS',
  'ROAD_AHEAD_WEAR',
  'ROAD_AHEAD_FIND_BAG',
  'ROAD_AHEAD_SELFIE',
  'BUSTED_WOODEN_AXE',
  'BUSTED_MUCK_BUSTERS',
];
const missing = required.filter((key) => !entries.some((entry) => entry.key === key));
const report = {
  version: 'snapshot-canonical-challenge-extractor-v76',
  generatedAt: new Date().toISOString(),
  sourcePath: 'src/client/util/nux/state_machines.ts',
  entries,
  required,
  missing,
  status: missing.length ? 'failed' : 'ok',
  note: 'This extracts the official source-visible snapshot NUX challenge ids. If encoded Redis/Bikkie challenge biscuits are later exported, they should be appended to this report rather than replacing the source-backed ids.',
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (missing.length) {
  process.exit(1);
}
