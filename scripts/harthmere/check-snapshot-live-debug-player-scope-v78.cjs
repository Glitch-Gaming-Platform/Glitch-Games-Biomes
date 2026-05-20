#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
let failures = 0;
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function ok(cond, msg) {
  if (cond) console.log(`OK ${msg}`);
  else { console.error(`FAIL ${msg}`); failures += 1; }
}

const shared = read('src/shared/harthmere/snapshot_live_debug_v78.ts');
const diag = read('src/client/components/challenges/SnapshotLiveDiagnosticsV78.tsx');
const v76 = read('src/client/components/challenges/LocalDevSnapshotCompletePortV76.tsx');
const v77 = read('src/client/components/challenges/SnapshotProductionPortV77.tsx');
const npcs = read('src/client/game/resources/npcs.ts');
const overlays = read('src/client/game/scripts/overlays.ts');
const hud = read('src/client/components/challenges/HarthmereUnifiedHUD.tsx');

ok(shared.includes('SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION_V78'), 'shared v78 live debug registry exists');
ok(shared.includes('SNAPSHOT_PER_PLAYER_MISSION_STATE_VERSION_V78'), 'per-player mission state marker exists');
ok(shared.includes('SNAPSHOT_LIVE_NPC_GROUNDING_VERSION_V78'), 'live NPC grounding marker exists');
ok(shared.includes('SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION_V78'), 'walk performance profiler marker exists');
ok(shared.includes('SNAPSHOT_ORIGINAL_FLOATING_NPC_LABELS_V78'), 'original floating snapshot NPC label list exists');
ok(shared.includes('Allix') && shared.includes('Helsa') && shared.includes('Drona') && shared.includes('Grover'), 'screenshot floating NPC names are covered');
ok(shared.includes('SNAPSHOT_LIVE_NPC_MAX_FOOT_CLEARANCE_V78 = 0.25'), 'live foot clearance tolerance is explicit');
ok(shared.includes('snapshotGroundLiveNpcPositionV78'), 'shared live NPC visual grounding helper exists');
ok(shared.includes('snapshotRemainingPortAuditV78'), 'remaining port audit exists');
ok(shared.includes('SNAPSHOT_PERFORMANCE_DEBUG_TOOLS_V78'), 'performance tool list exists');

ok(diag.includes('SnapshotLiveDiagnosticsRuntimeControllerV78'), 'runtime diagnostics controller exported');
ok(diag.includes('collectLiveNpcAuditV78'), 'live NPC audit collector exists');
ok(diag.includes('window.__snapshotPerfV78'), 'performance debug helper is exposed');
ok(diag.includes('__snapshotDiagnosticsV78'), 'diagnostics debug helper is exposed');
ok(diag.includes('PerformanceObserver'), 'long task observer is used');
ok(diag.includes('performance.getEntriesByType("resource")'), 'slow resource load profiling is used');
ok(diag.includes('SnapshotLiveGroundingAuditPanelV78'), 'live grounding audit panel exported');
ok(diag.includes('SnapshotPerformanceWalkerPanelV78'), 'performance walker panel exported');
ok(diag.includes('SnapshotRemainingPortAuditPanelV78'), 'remaining port panel exported');

ok(v76.includes('SNAPSHOT_PER_PLAYER_MISSION_STATE_VERSION_V78'), 'v76 imports per-player state marker');
ok(v76.includes('snapshotPlayerScopedStorageKeyV78'), 'v76 exposes player-scoped key helper');
ok(v76.includes('snapshotLocalGetItemV78(SNAPSHOT_COMPLETE_PORT_STATE_KEY_V76)'), 'v76 reads mission state through player scope');
ok(v76.includes('snapshotLocalSetItemV78(SNAPSHOT_COMPLETE_PORT_STATE_KEY_V76'), 'v76 writes mission state through player scope');
ok(v76.includes('snapshotLocalRemoveItemV78(SNAPSHOT_COMPLETE_PORT_STATE_KEY_V76)'), 'v76 reset removes scoped mission state');
ok(v76.includes('snapshotCurrentPlayerStateScopeV78'), 'v76 exposes current player state scope');

ok(v77.includes('snapshotPlayerScopedStorageKeyV78'), 'v77 imports scoped key helper');
ok(v77.includes('readJsonScopedLocalV77'), 'v77 has scoped local read helper');
ok(v77.includes('writeJsonScopedLocalV77'), 'v77 has scoped local write helper');
ok(v77.includes('SNAPSHOT_PRODUCTION_PENDING_KEY_V77'), 'v77 pending key still present');

ok(npcs.includes('SNAPSHOT_LIVE_NPC_GROUNDING_VERSION_V78'), 'NPC renderer imports v78 live grounding marker');
ok(npcs.includes('snapshotGroundLiveNpcPositionV78'), 'NPC renderer uses v78 grounding helper');
ok(npcs.includes('snapshotLiveGroundingV78'), 'NPC renderer records visual grounding metadata');
ok(overlays.includes('snapshotGroundLiveNpcPositionV78'), 'overlay labels use v78 grounding helper');
ok(overlays.includes('SNAPSHOT_LIVE_NPC_GROUNDING_VERSION_V78'), 'overlay imports v78 grounding marker');

ok(hud.includes('SnapshotLiveDiagnosticsRuntimeControllerV78'), 'HUD imports v78 diagnostics runtime');
ok(hud.includes('<SnapshotLiveDiagnosticsRuntimeControllerV78 />'), 'HUD mounts v78 diagnostics runtime');
ok(hud.includes('<SnapshotLiveGroundingAuditPanelV78 />'), 'HUD renders live grounding panel');
ok(hud.includes('<SnapshotPerformanceWalkerPanelV78 />'), 'HUD renders performance walker panel');
ok(hud.includes('<SnapshotRemainingPortAuditPanelV78 />'), 'HUD renders remaining port panel');

if (failures) {
  console.error(`v78 live debug/player scope check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log('v78 live debug/player scope check passed');
