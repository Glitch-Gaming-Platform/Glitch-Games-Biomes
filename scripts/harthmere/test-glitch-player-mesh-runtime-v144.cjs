#!/usr/bin/env node
/* HARTHMERE_PROD_LOCAL_ASSET_PARITY_V170: generated local player mesh is the production policy. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] || process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) { console.error('FAIL ' + msg); process.exit(1); } console.log('OK ' + msg); }
const route = read('src/pages/api/assets/player_mesh.glb.ts');
const player = read('src/client/game/resources/player_mesh.ts');
assert(player.includes('/api/assets/player_mesh.glb'), 'client uses generated player mesh endpoint');
assert(route.includes('computed-local'), 'player mesh route computes locally');
assert(!route.includes('unsafeResponse.redirect'), 'player mesh route has no fallback redirect');
assert(!route.includes('/api/assets/player_mesh.glb'), 'player mesh route has no static body fallback path');
console.log('\nRESULT: PASS');
