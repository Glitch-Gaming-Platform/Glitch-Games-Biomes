#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const runtimePath = path.join(root, 'src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx');
const contentPath = path.join(root, 'src/shared/harthmere/snapshot_grove_content.ts');
const deployPath = path.join(root, 'scripts/glitch/deploy-production-local-redis-smoke.sh');

const runtime = fs.readFileSync(runtimePath, 'utf8');
const content = fs.readFileSync(contentPath, 'utf8');
const deploy = fs.readFileSync(deployPath, 'utf8');

let failures = 0;
function ok(name, condition, detail) {
  if (condition) {
    console.log(`OK    ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name}`);
    if (detail) console.error(`      ${detail}`);
  }
}

function questBlock(id) {
  const start = content.indexOf(`id: "${id}"`);
  if (start < 0) throw new Error(`Could not find quest ${id}`);
  const next = content.indexOf('\n  {\n    id:', start + 1);
  const end = next < 0 ? content.indexOf('\n  //', start + 1) : next;
  return content.slice(start, end < 0 ? start + 2500 : end);
}

function firstMarker(id) {
  const block = questBlock(id);
  const markerMatch = block.match(/markerIds:\s*\[([\s\S]*?)\]/);
  if (!markerMatch) throw new Error(`Could not find markerIds for ${id}`);
  const first = markerMatch[1].match(/"([^"]+)"/);
  return first?.[1];
}

function firstTrigger(id) {
  const block = questBlock(id);
  const triggerMatch = block.match(/triggers:\s*\[([\s\S]*?)\]/);
  if (!triggerMatch) throw new Error(`Could not find triggers for ${id}`);
  const first = triggerMatch[1].match(/"([^"]+)"/);
  return first?.[1];
}

ok(
  'accepting a quest only auto-skips an already-satisfied talk_npc opener',
  /const shouldSkipFirstStep\s*=\s*startsByTalkingToGiver\s*&&\s*quest\.objectives\.length\s*>\s*1;/.test(runtime),
);
ok(
  'accepting a quest no longer auto-completes arbitrary non-talk steps just because marker 0 was the giver',
  !runtime.includes('initialMarkerIsGiver') && !runtime.includes('startsByTalkingToGiver || initialMarkerIsGiver'),
);
ok(
  'Color That Still Points Home starts on the real collection destination, not Taye',
  firstTrigger('color_that_still_points_home') === 'collect' && firstMarker('color_that_still_points_home') === 'grove_garden_edge_berries',
  `trigger=${firstTrigger('color_that_still_points_home')} marker=${firstMarker('color_that_still_points_home')}`,
);
ok(
  'Garden Edge Berries is a real resource landmark for the collection step',
  content.includes('id: "grove_garden_edge_berries"') && content.includes('label: "Garden Edge Berries"') && content.includes('kind: "resource"'),
);
ok(
  'Moss That Went Quiet starts on the trail destination, not Ranger Jane',
  firstTrigger('moss_that_went_quiet') === 'near_location' && firstMarker('moss_that_went_quiet') === 'mosslawn_warning_moss',
  `trigger=${firstTrigger('moss_that_went_quiet')} marker=${firstMarker('moss_that_went_quiet')}`,
);
ok(
  'quest marker acceptance guardrail is wired into production deploy smoke',
  deploy.includes('test-snapshot-grove-quest-marker-acceptance.cjs'),
);
ok(
  'stale current WakeUpScreen visual coverage guardrail is removed from production deploy smoke',
  !deploy.includes('test-harthmere-character-builder-supported-voxel-features.cjs'),
);

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log('\nRESULT: PASS');
