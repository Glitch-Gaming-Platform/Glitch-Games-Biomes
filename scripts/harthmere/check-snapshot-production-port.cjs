#!/usr/bin/env node
// SNAPSHOT_PRODUCTION_PORT_CHECK
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failures = 0;
function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
}
function ok(cond, msg) {
  if (cond) console.log(`OK ${msg}`);
  else { console.error(`FAIL ${msg}`); failures++; }
}
function has(rel, needle, msg) {
  const s = read(rel);
  ok(s.includes(needle), msg);
}

const shared = 'src/shared/harthmere/snapshot_production_port.ts';
const client = 'src/client/components/challenges/SnapshotProductionPort.tsx';
const api = 'src/pages/api/glitch/snapshot_progress.ts';
const decoder = 'scripts/harthmere/decode-snapshot-bikkie-challenges.cjs';
const bounds = 'scripts/harthmere/audit-snapshot-npc-bounds.cjs';
const hud = 'src/client/components/challenges/HarthmereUnifiedHUD.tsx';
const faces = 'src/shared/harthmere/voxel_faces.ts';

ok(fs.existsSync(path.join(root, shared)), 'shared current production registry exists');
ok(fs.existsSync(path.join(root, client)), 'client current runtime exists');
ok(fs.existsSync(path.join(root, api)), 'snapshot progress API exists');
ok(fs.existsSync(path.join(root, decoder)), 'non-NUX Bikkie decoder exists');
ok(fs.existsSync(path.join(root, bounds)), 'NPC bounds audit script exists');

has(shared, 'SNAPSHOT_PRODUCTION_PORT_VERSION', 'production port version marker exists');
has(shared, 'SNAPSHOT_DUAL_MODE_STATE_BACKEND_VERSION', 'dual local/prod backend marker exists');
has(shared, 'SNAPSHOT_BIKKIE_BISCUIT_DECODE_VERSION', 'Bikkie challenge decode marker exists');
has(shared, 'SNAPSHOT_FINAL_BIKKIE_REWARD_BINDING_VERSION', 'final Bikkie reward binding marker exists');
has(shared, 'SNAPSHOT_AUDIO_FILE_BINDING_VERSION', 'audio file binding marker exists');
has(shared, 'SNAPSHOT_CANONICAL_MUCK_WORLD_MUTATION_VERSION', 'canonical muck mutation marker exists');
has(shared, 'SNAPSHOT_GROVE_PLAYER_BUILDER_UI_VERSION', 'Grove player-builder UI marker exists');
has(shared, 'SNAPSHOT_GROVE_NPC_BOUNDS_PASS_VERSION', 'Grove NPC bounds pass marker exists');
has(shared, '/api/glitch/snapshot_progress', 'state endpoint is centralized');
has(shared, 'production_api_with_local_fallback', 'production API with local fallback mode exists');
has(shared, 'BikkieIds.muckBuster', 'Muck Buster resolves to real Bikkie id');
has(shared, 'BikkieIds.camera', 'camera resolves to real Bikkie id');
has(shared, 'BikkieIds.fish', 'fish resolves to real Bikkie id');
has(shared, 'loose_sign_nail', 'legacy Grove reward symbol loose_sign_nail is resolved');
has(shared, 'black_anvil_marked_strip', 'final Grove connector reward symbol is resolved');
has(shared, 'challenge-complete', 'challenge-complete audio file is bound');
has(shared, 'camera-shutter', 'camera shutter audio file is bound');
has(shared, 'fish-reel', 'fish reel audio file is bound');
has(shared, 'npc-mucker-on-hit', 'Mucker hit audio file is bound');
has(shared, 'SNAPSHOT_NON_NUX_BIKKIE_DECODE_TARGETS', 'non-NUX decode target contract exists');
has(shared, 'SNAPSHOT_GROVE_NPC_VISUAL_BOUNDS', 'NPC visual bounds registry exists');

has(client, 'SnapshotProductionPortRuntimeController', 'runtime controller is exported');
has(client, 'SnapshotProductionPortStatusPanel', 'status panel is exported');
has(client, '__snapshot', 'developer debug helper is exposed');
has(client, 'postSnapshotProgress', 'backend sync writer exists');
has(client, 'mutationFromEvent', 'garden hose mutation conversion exists');
has(client, 'clear_muck', 'clear muck mutation path exists');
has(client, 'photo_proof', 'photo proof mutation path exists');
has(client, 'fishing_catch', 'fishing catch mutation path exists');
has(client, 'SNAPSHOT_COMPLETE_PORT_STATE_KEY', 'current local fallback state is preserved');
has(client, 'production_api', 'production strict mode is supported');
has(client, 'local_dev', 'local development mode is supported');
has(client, 'production_api_with_local_fallback', 'production fallback mode is supported');

has(api, 'SNAPSHOT_PRODUCTION_PROGRESS_API', 'API version marker exists');
has(api, 'GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL', 'API can forward to durable production backend');
has(api, 'local_dev_in_memory', 'API has local in-memory development mode');
has(api, 'clear_muck', 'API merges clear_muck mutations');
has(api, 'photo_proof', 'API merges photo_proof mutations');
has(api, 'fishing_catch', 'API merges fishing_catch mutations');
has(api, 'complete_mission', 'API merges complete_mission mutations');
has(api, 'grant_reward', 'API merges grant_reward mutations');

has(decoder, 'SNAPSHOT_BIKKIE_BISCUIT_DECODE_VERSION', 'decoder has current marker');
has(decoder, 'public/buckets/biomes-bikkie', 'decoder searches Bikkie bucket');
has(decoder, 'nonNuxChallengeCandidates', 'decoder reports non-NUX candidates');
has(bounds, 'SNAPSHOT_GROVE_NPC_BOUNDS_PASS_VERSION', 'bounds audit has current marker');
has(bounds, 'feetClearance', 'bounds audit measures feet clearance');
has(bounds, '0.25', 'bounds audit keeps explicit 0.25m tolerance');

has(hud, 'SnapshotProductionPortRuntimeController', 'HUD imports/mounts current runtime');
has(hud, 'SnapshotProductionPortStatusPanel', 'HUD imports/renders current status panel');
has(hud, 'SnapshotProductionPortFacts', 'HUD imports/mounts current hidden facts');
has(faces, 'SNAPSHOT_GROVE_PLAYER_BUILDER_UI', 'actual first-login player-builder presets are wired');
has(faces, 'grove_wayfinder', 'Grove Wayfinder appears in starter presets');
has(faces, 'shutter_cove_lenskeeper', 'Shutter Cove Lenskeeper appears in starter presets');

const sharedText = read(shared);
const unresolvedSymbols = [
  'loose_sign_nail','cosmetic_marker_decal','road_blocks_x5','luis_repair_note','ranger_token',
  'mosslawn_songline_recording','anti_muck_poultice','cove_photo_frame','road_snacks','old_route_clue',
  'buddy_memory_fragment','navigation_beam_upgrade','jackies_sealed_letter','brams_stamped_pass',
  'watch_ranger_report','bolt_order','bolt_crates','sealed_muck_sample','chapel_lore_note',
  'sils_tuning_strip','black_anvil_marked_strip','recipe_road_repair_kit'
].filter((symbol) => !sharedText.includes(`${symbol}:`) && !sharedText.includes(`symbol: "${symbol}"`));
ok(unresolvedSymbols.length === 0, `all current Grove reward symbols have current Bikkie bindings${unresolvedSymbols.length ? ': ' + unresolvedSymbols.join(', ') : ''}`);

if (failures) {
  console.error(`current snapshot production port check failed with ${failures} failure(s)`);
  process.exit(1);
}
console.log('current snapshot production port check passed');
