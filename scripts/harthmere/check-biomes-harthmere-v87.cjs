#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exitCode = 1;
  } else {
    console.log('OK', msg);
  }
}
const names = read('src/shared/biomes/display_names.ts');
ok(names.includes('BIOMES_GAME_NAME = "Biomes"'), 'game name constant is Biomes');
ok(names.includes('BIOMES_HARTHMERE_TOWN_NAME = "Harthmere"'), 'Harthmere remains town name constant');
const hud = read('src/client/components/challenges/HarthmereUnifiedHUD.tsx');
ok(hud.includes('BIOMES_GAME_NAME'), 'HUD imports/uses Biomes game name');
ok(hud.includes('BIOMES_HARTHMERE_TOWN_NAME') && hud.includes('Map'), 'HUD still labels Harthmere as map/town context');
const bridge = read('src/client/game/glitch/harthmere_glitch_bridge.ts');
ok(bridge.includes('Local ${BIOMES_GAME_NAME} Player'), 'local Glitch identity says Biomes player');
ok(bridge.includes('${BIOMES_GAME_NAME} session disconnected'), 'session disconnect overlay uses Biomes');
const perf = read('src/shared/harthmere/town_production_polish_v1.ts');
ok(perf.includes('harthmere-production-building-polish-and-optimization-v87'), 'production polish version is v87');
ok(perf.includes('harthmere-runtime-performance-profile-v87'), 'runtime performance profile is v87');
ok(perf.includes('prototypeLoadConcurrency: 1'), 'prototype loading is capped at one by default');
ok(perf.includes('maxWildsActorsOptimized: 16'), 'wilds actor budget is reduced');
ok(perf.includes('maxAnimatedLifeOptimized: 48'), 'animated life budget is reduced');
const renderer = read('src/client/game/renderers/local_dev/harthmere_assets.ts');
ok(renderer.includes('harthmere-survey-performance-response-v87'), 'renderer exposes v87 survey response version');
ok(renderer.includes('NEAR_ANIM_DIST_SQ_V87 = 18 * 18'), 'near animation radius is reduced');
ok(renderer.includes('MID_ANIM_DIST_SQ_V87 = 44 * 44'), 'mid animation radius is reduced');
ok(renderer.includes('(polishFrame & 15) === 0'), 'far animation updates are throttled harder');
const npcs = read('src/client/game/resources/npcs.ts');
ok(npcs.includes('biomes-snapshot-style-npc-animation-v87'), 'snapshot-style NPC animation marker exists');
ok(npcs.includes('new THREE.AnimationClip("Idle", 2.2'), 'NPC idle loop is smoother/longer');
ok(npcs.includes('new THREE.AnimationClip("Walk", 1') && npcs.includes('harthmere-npc-body.rotation[y]'), 'NPC walk/run animation includes body sway');

const shim = read('src/server/shim/main.ts');
ok(shim.includes('harthmere-npc-terrain-footing-v87'), 'server NPC terrain footing version exists');
ok(shim.includes('harthmereNpcFeetYForAuthoredPositionV87'), 'server grounds Harthmere NPCs from authored terrain columns');
ok(shim.includes('starterTownAboveGroundBlockAt(materials, authoredX, worldY, authoredZ)'), 'server samples generated terrain/building floors for NPC feet');
const analyzer = read('scripts/harthmere/analyze-harthmere-auto-survey-v87.cjs');
ok(analyzer.includes('BIOMES_HARTHMERE_SURVEY_ANALYZER_V87'), 'v87 survey analyzer exists');
if (process.exitCode) process.exit(process.exitCode);
console.log('\nBiomes/Harthmere v87 checks passed.');
