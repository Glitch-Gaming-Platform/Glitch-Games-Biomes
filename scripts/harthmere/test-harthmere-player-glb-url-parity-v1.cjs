#!/usr/bin/env node
// HARTHMERE_PROD_LOCAL_ASSET_PARITY_V168
// Production/local parity policy: generated player meshes are computed through
// /api/assets/player_mesh.glb. This replaces older static avatar fallback tests.

const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2] || '.');
let failures = 0;
function read(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) {
    failures++;
    console.log(`FAIL missing ${file}`);
    return '';
  }
  return fs.readFileSync(p, 'utf8');
}
function ok(condition, message) {
  if (condition) console.log(`OK ${message}`);
  else { failures++; console.log(`FAIL ${message}`); }
}
const route = read('src/pages/api/assets/player_mesh.glb.ts');
const resource = read('src/client/game/resources/player_mesh.ts');
const config = read('src/server/web/config.ts');
const main = read('src/server/web/main.ts');
const animation = read('src/client/game/util/animation_system.ts');

const removedStaticSwitch = 'GLITCH_STATIC' + '_PLAYER_MESH' + '_FALLBACK';
const removedBuildErrSwitch = 'GLITCH_PLAYER_MESH' + '_FALLBACK_ON' + '_BUILD_ERROR';
const removedBodyPath = 'harthmere_player_average_' + 'earth' + '.gltf';

ok(resource.includes('/api/assets/player_mesh.glb'), 'player mesh resource uses generated API endpoint');
ok(!new RegExp(`playerMeshUrlForId[\\s\\S]*${removedBodyPath.replace('.', '\\.')}`).test(resource), 'player mesh resource does not use removed static body path');
ok(route.includes('shouldForceLocalAssetRuntime') && route.includes('computed-local'), 'player mesh API computes locally in forced Glitch runtime');
ok(!route.includes(removedStaticSwitch), 'removed static player mesh env switch is not used');
ok(!route.includes(removedBuildErrSwitch), 'removed build-error env switch is not used');
ok(!route.includes(removedBodyPath), 'player mesh API has no removed body URL');
ok(config.includes('defaultValue: "lazy"') && config.includes('shouldForceLocalAssetRuntime'), 'web config defaults to lazy local asset runtime');
ok(main.includes('shouldForceLocalAssetRuntime') && /case "none":[\s\S]*case "proxy":[\s\S]*LazyAssetExportsServer/.test(main), 'web main converts none/proxy to lazy in forced local runtime');
ok(animation.includes('HARTHMERE_ANIMATION_TARGET_PRUNING_V152') || animation.includes('animationTrackCanBindToMesh'), 'animation target-pruning coverage is still present');

if (failures) {
  console.log('\nRESULT: FAIL');
  process.exit(1);
}
console.log('\nRESULT: PASS');
