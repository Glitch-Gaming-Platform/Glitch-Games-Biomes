#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(repo, rel), 'utf8'); }
function ok(cond, msg) { if (!cond) { console.error('FAIL', msg); process.exit(1); } console.log('OK', msg); }
const dataSnapshot = read('scripts/b/data_snapshot.py');
const assets = read('src/client/game/renderers/local_dev/harthmere_assets.ts');
ok(dataSnapshot.includes('SNAPSHOT_MERGE_RUNTIME_GATE_V1'), 'data_snapshot.py has snapshot merge runtime gate marker');
ok(dataSnapshot.includes('NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE'), 'snapshot run exposes merge mode to browser');
ok(dataSnapshot.includes('NEXT_PUBLIC_BIOMES_FORCE_LOCAL_DEV_TOWN'), 'snapshot run mirrors forced legacy Harthmere mode to browser');
ok(assets.includes('HARTHMERE_SNAPSHOT_RUNTIME_GATE_V1'), 'client Harthmere runtime gate marker is present');
ok(assets.includes('function isSnapshotMergeRuntimeV1()'), 'client detects snapshot merge runtime');
ok(assets.includes('function shouldRenderHarthmereRuntimeTownV1()'), 'client has centralized Harthmere runtime render gate');
ok(assets.includes('NEXT_PUBLIC_BIOMES_RENDER_HARTHMERE_RUNTIME'), 'client has explicit debug override for Harthmere runtime');
ok(assets.includes('HARTHMERE_RUNTIME_GATE_EMPTY_PLACEMENTS_V1'), 'runtime placements are emptied in snapshot-only mode');
ok(/return \{ placements: \[\], removedFloating: \[\], removedForPerformance: \[\] \};/.test(assets), 'snapshot-only Harthmere runtime returns no visual placements');
ok(assets.includes('shouldUseHarthmereRuntimeExtraTownOffsetV1()'), 'extra-town mode still renders shifted Harthmere runtime');
console.log('harthmere runtime gate/npc location v1 check passed');
