#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || process.cwd());
function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const bridge = read('src/client/game/glitch/harthmere_glitch_bridge.ts');
assert(bridge.includes('AEGIS_BRIDGE_SCRIPT_URL_V138'), 'Aegis bridge URL marker missing.');
assert(bridge.includes('https://api.glitch.fun/js/aegis-bridge.js'), 'Aegis bridge must use the full production Glitch URL.');
assert(bridge.includes('isProductionGlitchRuntimeV138'), 'Telemetry/Aegis must have a production-runtime guard.');
assert(bridge.includes('!isLocalBrowserHostV138()'), 'Telemetry/Aegis must not run on localhost/local-dev hosts.');
assert(bridge.includes('config.launchedByGlitch'), 'Telemetry/Aegis must be gated behind Glitch launch/install identity.');
assert(bridge.includes('try {') && bridge.includes('HARTHMERE_AEGIS_BRIDGE_INJECTION_FAILED_V138'), 'Aegis injection must be best-effort and non-fatal.');
assert(bridge.includes('window.AEGIS_CONFIG'), 'Aegis config must be written before loading the bridge script.');
assert(bridge.includes('recordEvents'), 'Bridge must proxy behavioral event batches through the local API route.');
assert(bridge.includes('heartbeatInstall'), 'Bridge must create/resume the Glitch install and send the 60s install heartbeat.');
assert(!bridge.includes('bulkCreateEvents'), 'Bridge must not use browser SDK bulk events; funnels require server-side Title Token proxy.');
assert(bridge.includes('HARTHMERE_GLITCH_STANDARD_FUNNEL_EVENTS_V138'), 'Standard funnel event catalog missing.');
for (const key of [
  'game_boot',
  'glitch_auth',
  'loading',
  'onboarding_name',
  'character_builder',
  'gameplay',
  'biomes_ui',
  'inventory',
  'banking',
  'dialogue',
  'quest',
  'mission',
  'combat',
  'session',
]) {
  assert(bridge.includes(key), `Standard funnel key missing: ${key}`);
}
assert(bridge.includes('catch (error)') && bridge.includes('Behavioral analytics must never interrupt gameplay'), 'Event flush failures must be swallowed and recorded, not thrown.');

const behaviorBus = read('src/client/game/glitch/harthmere_glitch_behavior_events.ts');
assert(behaviorBus.includes('HARTHMERE_GLITCH_BEHAVIOR_EVENT_NAME_V138'), 'Behavior event bus marker missing.');
assert(behaviorBus.includes('__harthmereGlitchBehaviorBacklogV138'), 'Behavior event bus must buffer pre-bridge loading/onboarding events.');
assert(behaviorBus.includes('dispatchEvent') && behaviorBus.includes('catch'), 'Behavior event emitter must be client-only and non-fatal.');

const api = read('src/pages/api/glitch/harthmere.ts');
assert(api.includes('op === "heartbeatInstall"'), 'API must proxy Glitch install create/resume heartbeats.');
assert(api.includes('user_install_id'), 'API install heartbeat must send user_install_id from the iframe install_id.');
assert(api.includes('op === "recordEvent"'), 'API must support single Glitch behavioral event proxying.');
assert(api.includes('op === "recordEvents"'), 'API must support bulk Glitch behavioral event proxying.');
assert(api.includes('/events`') || api.includes('/events`,'), 'API must call the Glitch single-event endpoint.');
assert(api.includes('/events/bulk`'), 'API must call the Glitch bulk event endpoint.');
assert(api.includes('game_install_id'), 'API must send game_install_id as required by Glitch events.');
assert(api.includes('missing_server_title_token'), 'API must skip safely when title token/config is not present.');

const game = read('src/client/components/Game.tsx');
assert(game.includes('emitHarthmereGlitchBehaviorEventV138("loading", "start")'), 'Game loading start event missing.');
assert(game.includes('emitHarthmereGlitchBehaviorEventV138("loading", "complete")'), 'Game loading complete event missing.');
assert(game.includes('emitHarthmereGlitchBehaviorEventV138("loading", "error"'), 'Game loading error event missing.');

const wake = read('src/client/components/WakeUpScreen.tsx');
for (const [step, action] of [
  ['onboarding_intro', 'click_continue'],
  ['onboarding_name', 'submit'],
  ['onboarding_name', 'success'],
  ['onboarding_name', 'fail'],
  ['character_builder', 'change_field'],
  ['character_builder', 'complete'],
  ['onboarding_wakeup', 'complete'],
]) {
  assert(
    wake.includes(`"${step}"`) && wake.includes(`"${action}"`),
    `Wake/onboarding telemetry missing: ${step}:${action}`
  );
}
assert(wake.includes('name_length'), 'Onboarding telemetry should send name length only, not require raw player names.');

const biomesUI = read('src/client/components/biomes_ui/BiomesUI.tsx');
assert(biomesUI.includes('\"biomes_ui\"') || biomesUI.includes('"biomes_ui"'), 'BiomesUI open/close telemetry missing.');
assert(biomesUI.includes('\"hotbar\"') || biomesUI.includes('"hotbar"'), 'Hotbar interaction telemetry missing.');

const liveDebug = read('src/shared/harthmere/snapshot_live_debug_v78.ts');
assert(liveDebug.includes('SNAPSHOT_MUCKER_HEXER_TILE_CLEARANCE_VERSION_V138'), 'Mucker/Hexer tile-clearance version missing.');
assert(liveDebug.includes('snapshotMuckerHexerTileClearanceV138'), 'Mucker/Hexer tile-clearance helper missing.');
assert(liveDebug.includes('snapshotMuckerHexerTileClearancePassV138'), 'Mucker/Hexer tile-clearance pass/fail helper missing.');
assert(liveDebug.includes('SNAPSHOT_MUCKER_HEXER_MIN_TILE_CLEARANCE_V138'), 'Mucker/Hexer min tile tolerance missing.');
assert(liveDebug.includes('SNAPSHOT_MUCKER_HEXER_MAX_TILE_CLEARANCE_V138'), 'Mucker/Hexer max tile tolerance missing.');

const diagnostics = read('src/client/components/challenges/SnapshotLiveDiagnosticsV78.tsx');
assert(diagnostics.includes('sampleTerrainColumnV84'), 'Diagnostics must use real loaded terrain columns.');
assert(diagnostics.includes('renderedMuckerHexerActorsV138'), 'Diagnostics must prefer renderer-published Mucker/Hexer world positions.');
assert(diagnostics.includes('__harthmereVoxelNpcMotionActorPositionsV193'), 'Diagnostics must read renderer-published corrected world Y positions.');
assert(diagnostics.includes('muckerHexerGroundAuditV138'), 'Window diagnostic audit for Muckers/Hexes missing.');
assert(diagnostics.includes('muckerHexerGroundSummaryV138'), 'Window diagnostic summary for Muckers/Hexes missing.');
assert(diagnostics.includes('downloadMuckerHexerGroundAuditV138'), 'Downloadable Mucker/Hexer ground audit missing.');

console.log('PASS glitch-aegis-telemetry-mucker-clearance-v138');
