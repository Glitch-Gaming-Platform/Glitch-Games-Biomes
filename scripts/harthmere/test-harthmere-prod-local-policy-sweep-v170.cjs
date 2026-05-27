#!/usr/bin/env node
/* HARTHMERE_PROD_LOCAL_ASSET_PARITY_V170: source-only broad policy sweep. */
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] || process.cwd();
let failures = 0;
function ok(cond, msg, detail) { if (cond) console.log(`OK    ${msg}`); else { console.error(`FAIL  ${msg}`); if (detail) console.error(`      ${detail}`); failures++; } }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function walk(rel, out=[]) { const abs = path.join(root, rel); if (!fs.existsSync(abs)) return out; for (const ent of fs.readdirSync(abs, {withFileTypes:true})) { const p = path.join(abs, ent.name); const r = path.relative(root, p); if (ent.isDirectory()) { if (/(^|\/)(node_modules|\.git|\.next|dist|build|\.harthmere-backups)(\/|$)/.test(r)) continue; walk(r, out); } else out.push(r); } return out; }
const s1 = 'GLITCH_STATIC_PLAYER_MESH_' + 'FALLBACK';
const s2 = 'GLITCH_STATIC_PLAYER_MESH_' + 'HOTFIX';
const s3 = 'GLITCH_PLAYER_MESH_' + 'FALLBACK_ON_BUILD_ERROR';
const s4 = 'GLITCH_DISABLE_' + 'ASSET_EXPORT_SERVER';
const staticPath = '/api/assets/player_mesh.glb';
const forbidden = [s1, s2, s3, staticPath, 'generated local player mesh', 'generated local player mesh'];
const main = read('src/server/web/main.ts');
const route = read('src/pages/api/assets/player_mesh.glb.ts');
const player = read('src/client/game/resources/player_mesh.ts');
const npcs = read('src/client/game/resources/npcs.ts');
ok(!main.includes(s4), 'web main has no disable-asset-export killswitch left');
ok(main.includes('shouldForceLocalAssetRuntime'), 'web main still imports/uses forced local runtime gate');
ok(main.includes('LazyAssetExportsServer(createAssetServer)'), 'web main can construct lazy local asset exporter');
ok(read('src/server/web/config.ts').includes('defaultValue: "lazy"'), 'web config defaults asset server to lazy');
ok(route.includes('X-Glitch-Player-Mesh-Mode') && route.includes('computed-local'), 'player mesh API emits computed-local marker');
ok(!route.includes('unsafeResponse.redirect'), 'player mesh API has no fallback redirect');
ok(player.includes('/api/assets/player_mesh.glb'), 'client player mesh resource uses generated player mesh endpoint');
ok(npcs.includes('playerMeshUrlForId') || npcs.includes('/api/assets/player_mesh.glb'), 'NPC resource uses generated mesh path for player-like NPCs');
ok(/fallback/i.test(npcs) && /visible/i.test(npcs), 'NPC rendering has visible fallback behavior');
const scriptFiles = walk('scripts').filter((rel) => /\.(cjs|js|ts|tsx|sh)$/.test(rel));
const allowed = new Set(['scripts/harthmere/test-harthmere-prod-local-policy-sweep-v170.cjs']);
const offenders = [];
for (const rel of scriptFiles) { if (allowed.has(rel)) continue; const txt = read(rel); for (const needle of forbidden) { if (txt.includes(needle)) { offenders.push(`${rel} :: ${needle}`); break; } } }
ok(offenders.length === 0, 'all active scripts align with generated local player mesh policy', offenders.slice(0, 30).join('\n'));
if (failures) { console.error(`\nRESULT: FAIL (${failures})`); process.exit(1); }
console.log('\nRESULT: PASS');
