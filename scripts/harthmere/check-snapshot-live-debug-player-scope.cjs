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

const shared = read('src/shared/harthmere/snapshot_live_debug.ts');
const diag = read('src/client/components/challenges/SnapshotLiveDiagnostics.tsx');
const snapshotCompletePort = read('src/client/components/challenges/LocalDevSnapshotCompletePort.tsx');
const snapshotProductionPort = read('src/client/components/challenges/SnapshotProductionPort.tsx');
const npcs = read('src/client/game/resources/npcs.ts');
const overlays = read('src/client/game/scripts/overlays.ts');
const hud = read('src/client/components/challenges/HarthmereUnifiedHUD.tsx');

ok(shared.includes('SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION'), 'shared current live debug registry exists');
ok(shared.includes('SNAPSHOT_PER_PLAYER_MISSION_STATE_VERSION'), 'per-player mission state marker exists');
ok(shared.includes('SNAPSHOT_LIVE_NPC_GROUNDING_VERSION'), 'live NPC grounding marker exists');
ok(shared.includes('SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION'), 'walk performance profiler marker exists');
ok(shared.includes('SNAPSHOT_ORIGINAL_FLOATING_NPC_LABELS'), 'original floating snapshot NPC label list exists');
ok(shared.includes('Allix') && shared.includes('Helsa') && shared.includes('Drona') && shared.includes('Grover'), 'screenshot floating NPC names are covered');
ok(shared.includes('SNAPSHOT_LIVE_NPC_MAX_FOOT_CLEARANCE = 0.25'), 'live foot clearance tolerance is explicit');
ok(shared.includes('snapshotGroundLiveNpcPosition'), 'shared live NPC visual grounding helper exists');
ok(shared.includes('snapshotRemainingPortAudit'), 'remaining port audit exists');
ok(shared.includes('SNAPSHOT_PERFORMANCE_DEBUG_TOOLS'), 'performance tool list exists');

ok(diag.includes('SnapshotLiveDiagnosticsRuntimeController'), 'runtime diagnostics controller exported');
ok(diag.includes('collectLiveNpcAudit'), 'live NPC audit collector exists');
ok(diag.includes('window.__snapshotPerf'), 'performance debug helper is exposed');
ok(diag.includes('__snapshotDiagnostics'), 'diagnostics debug helper is exposed');
ok(diag.includes('PerformanceObserver'), 'long task observer is used');
ok(diag.includes('performance.getEntriesByType("resource")'), 'slow resource load profiling is used');
ok(diag.includes('SnapshotLiveGroundingAuditPanel'), 'live grounding audit panel exported');
ok(diag.includes('SnapshotPerformanceWalkerPanel'), 'performance walker panel exported');
ok(diag.includes('SnapshotRemainingPortAuditPanel'), 'remaining port panel exported');

ok(snapshotCompletePort.includes('SNAPSHOT_PER_PLAYER_MISSION_STATE_VERSION'), 'current imports per-player state marker');
ok(snapshotCompletePort.includes('snapshotPlayerScopedStorageKey'), 'current exposes player-scoped key helper');
ok(snapshotCompletePort.includes('snapshotLocalGetItem(SNAPSHOT_COMPLETE_PORT_STATE_KEY)'), 'current reads mission state through player scope');
ok(snapshotCompletePort.includes('snapshotLocalSetItem(SNAPSHOT_COMPLETE_PORT_STATE_KEY'), 'current writes mission state through player scope');
ok(snapshotCompletePort.includes('snapshotLocalRemoveItem(SNAPSHOT_COMPLETE_PORT_STATE_KEY)'), 'current reset removes scoped mission state');
ok(snapshotCompletePort.includes('snapshotCurrentPlayerStateScope'), 'current exposes current player state scope');

ok(snapshotProductionPort.includes('snapshotPlayerScopedStorageKey'), 'current imports scoped key helper');
ok(snapshotProductionPort.includes('readJsonScopedLocal'), 'current has scoped local read helper');
ok(snapshotProductionPort.includes('writeJsonScopedLocal'), 'current has scoped local write helper');
ok(snapshotProductionPort.includes('SNAPSHOT_PRODUCTION_PENDING_KEY'), 'current pending key still present');

ok(npcs.includes('SNAPSHOT_LIVE_NPC_GROUNDING_VERSION'), 'NPC renderer imports current live grounding marker');
ok(npcs.includes('snapshotGroundLiveNpcPosition'), 'NPC renderer uses current grounding helper');
ok(npcs.includes('snapshotLiveGrounding'), 'NPC renderer records visual grounding metadata');
ok(overlays.includes('snapshotGroundLiveNpcPosition'), 'overlay labels use current grounding helper');
ok(overlays.includes('SNAPSHOT_LIVE_NPC_GROUNDING_VERSION'), 'overlay imports current grounding marker');

ok(hud.includes('SnapshotLiveDiagnosticsRuntimeController'), 'HUD imports current diagnostics runtime');
ok(hud.includes('<SnapshotLiveDiagnosticsRuntimeController />'), 'HUD mounts current diagnostics runtime');
ok(hud.includes('<SnapshotLiveGroundingAuditPanel />'), 'HUD renders live grounding panel');
ok(hud.includes('<SnapshotPerformanceWalkerPanel />'), 'HUD renders performance walker panel');
ok(hud.includes('<SnapshotRemainingPortAuditPanel />'), 'HUD renders remaining port panel');

if (failures) {
  console.error(`current live debug/player scope check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log('current live debug/player scope check passed');
