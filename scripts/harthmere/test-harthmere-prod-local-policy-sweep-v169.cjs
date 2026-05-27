#!/usr/bin/env node
// HARTHMERE_PROD_LOCAL_ASSET_PARITY_V169
// Sweeps active source + deploy/runtime test files for old production/static player mesh policy.
// This is intentionally broad so we do not discover stale assertions one by one during deploy.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failures = 0;

const OLD_STATIC_FALLBACK = 'GLITCH_STATIC_PLAYER_MESH_' + 'FALLBACK';
const OLD_STATIC_HOTFIX = 'GLITCH_STATIC_PLAYER_MESH_' + 'HOTFIX';
const OLD_BUILD_FALLBACK = 'GLITCH_PLAYER_MESH_FALLBACK_' + 'ON_BUILD_ERROR';
const STATIC_BODY = 'harthmere_player_average_' + 'earth.gltf';
const DISABLE_EXPORT = 'GLITCH_DISABLE_ASSET_EXPORT_' + 'SERVER';

function ok(condition, message, detail) {
  if (condition) console.log(`OK    ${message}`);
  else {
    failures++;
    console.log(`FAIL  ${message}`);
    if (detail) console.log(`      ${detail}`);
  }
}
function read(file) {
  try { return fs.readFileSync(path.join(root, file), 'utf8'); }
  catch { failures++; console.log(`FAIL  missing ${file}`); return ''; }
}
function walk(dir, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(abs, entry.name);
    const rel = path.relative(root, p);
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', '.next', 'dist', 'build', 'cache', '.harthmere-backups', '.artifacts'].includes(entry.name)) continue;
      walk(rel, out);
    } else if (/\.(cjs|js|ts|tsx)$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

const keySourceFiles = [
  'src/server/web/config.ts',
  'src/server/web/main.ts',
  'src/pages/api/assets/player_mesh.glb.ts',
  'src/client/game/resources/player_mesh.ts',
  'src/client/game/resources/npcs.ts',
  'src/client/game/renderers/npcs.ts',
  'scripts/glitch/assert-glitch-build-artifacts-current.cjs',
];

const sourceText = Object.fromEntries(keySourceFiles.map((file) => [file, read(file)]));

ok(!sourceText['src/server/web/main.ts'].includes(DISABLE_EXPORT), 'web main has no disable-asset-export killswitch left');
ok(sourceText['src/server/web/main.ts'].includes('shouldForceLocalAssetRuntime'), 'web main still imports/uses forced local runtime gate');
ok(/case "none":[\s\S]*case "proxy":[\s\S]*shouldForceLocalAssetRuntime\(\)[\s\S]*LazyAssetExportsServer/.test(sourceText['src/server/web/main.ts']), 'web main converts none/proxy to lazy under forced local runtime');
ok(sourceText['src/server/web/config.ts'].includes('defaultValue: "lazy"'), 'web config defaults asset server to lazy');
ok(sourceText['src/pages/api/assets/player_mesh.glb.ts'].includes('computed-local'), 'player mesh API emits computed-local marker');
ok(!sourceText['src/pages/api/assets/player_mesh.glb.ts'].includes(OLD_STATIC_FALLBACK), 'player mesh API has no old generated local fallback-free path switch');
ok(!sourceText['src/pages/api/assets/player_mesh.glb.ts'].includes(OLD_STATIC_HOTFIX), 'player mesh API has no old static hotfix switch');
ok(!sourceText['src/pages/api/assets/player_mesh.glb.ts'].includes(OLD_BUILD_FALLBACK), 'player mesh API has no old build-error fallback switch');
ok(!sourceText['src/pages/api/assets/player_mesh.glb.ts'].includes(STATIC_BODY), 'player mesh API has no static body fallback path');
ok(!sourceText['src/client/game/resources/player_mesh.ts'].includes(STATIC_BODY), 'client player mesh resource has no static body fallback path');
ok(sourceText['src/client/game/resources/npcs.ts'].includes('/api/assets/player_mesh.glb'), 'NPC resource uses generated mesh path for player-like NPCs');
ok(/fallback/i.test(sourceText['src/client/game/resources/npcs.ts'] + sourceText['src/client/game/renderers/npcs.ts']), 'NPC rendering has visible fallback behavior');

// Scan all Harthmere/Glitch tests, but distinguish legitimate negative assertions from old positive assertions.
const testFiles = [...walk('scripts/harthmere'), ...walk('scripts/glitch')]
  .filter((file) => !file.includes('test-harthmere-prod-local-policy-sweep-v169.cjs'));
const suspicious = [];
for (const file of testFiles) {
  const text = read(file);
  const mentionsOld = text.includes(OLD_STATIC_FALLBACK) || text.includes(OLD_STATIC_HOTFIX) || text.includes(OLD_BUILD_FALLBACK) || text.includes(STATIC_BODY) || text.includes('packaged fallback');
  if (!mentionsOld) continue;
  const safeNegative =
    /no longer|does not|never|removed|has no|no packaged|no static|without static|avoids packaged|computes locally|not route|not return/i.test(text) &&
    !/expects packaged|requires packaged|uses packaged fallback|should use packaged|redirects to packaged|generated local fallback-free path should be enabled/i.test(text);
  if (!safeNegative) suspicious.push(file);
}
ok(suspicious.length === 0, 'all active Harthmere/Glitch tests now align with generated local player mesh policy', suspicious.join('\n'));

const artifactTest = spawnSync(process.execPath, [path.join(root, 'scripts/harthmere/test-glitch-prod-build-artifacts-current-v169.cjs'), root], {
  cwd: root,
  stdio: 'inherit',
});
ok(artifactTest.status === 0, 'build artifact validator passes under v169 policy');

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log('\nRESULT: PASS');
