#!/usr/bin/env node
// HARTHMERE_MIXED_SCENE_PROD_SAFE
// Regression test for production WebGL errors caused by sending stock Three.js
// materials into the Biomes base MRT pass.

const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const scenesPath = path.join(root, 'src/client/game/renderers/scenes.ts');
const playerMeshPath = path.join(root, 'src/client/game/resources/player_mesh.ts');

let failures = 0;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

console.log('== Harthmere mixed scene production-safe current ==');

const scenes = fs.readFileSync(scenesPath, 'utf8');
const playerMesh = fs.readFileSync(playerMeshPath, 'utf8');

ok(scenes.includes('HARTHMERE_MIXED_SCENE_TYPE_PROD_SAFE_FALLBACK'), 'current fallback marker exists');
ok(scenes.includes('__harthmereSceneDebug'), 'console scene debug bridge is exposed');
ok(scenes.includes('HarthmereSceneDebugEntry'), 'debug entries include structured scene/material info');
ok(scenes.includes('sceneDebugMaterialInfo'), 'mixed root material types are recorded');
ok(scenes.includes('chooseMixedSceneFallback'), 'mixed fallback decision is centralized');
ok(scenes.includes('isBasePassCoercedPlayerRoot'), 'player-only base fallback is guarded by explicit marker');
ok(scenes.includes('harthmere-player-avatar-base-pass-materials'), 'fallback recognizes the player material coercion marker');
ok(scenes.includes('if (isBasePassCoercedPlayerRoot(object) && objScenes.has("base"))'), 'only marked player roots can still use mixed-root base fallback');
ok(scenes.includes('return "three";'), 'ordinary mixed roots default back to the stock-material-safe three pass');
ok(!scenes.includes('Defaulting to base`'), 'old unconditional mixed-root base fallback log is gone');
ok(scenes.includes('Defaulting to ${sceneName}'), 'mixed-root log reports actual chosen scene');
ok(scenes.includes('materials=${materialTypes.join(",")}'), 'mixed-root log reports material constructors');
ok(scenes.includes('Active draw buffers with missing'), 'comments document the production WebGL error being guarded');
ok(playerMesh.includes('coerceHarthmerePlayerObjectMaterialsToBasePass(playerAnimatedMesh.three)'), 'player root is still coerced before scene routing');
ok(playerMesh.includes('harthmerePlayerAvatarBasePassMaterialsVersion'), 'player root still records base-pass conversion marker');
ok(playerMesh.includes('makeBasicMaterial'), 'procedural player pieces still use generated base-pass material');
ok(!/new\s+THREE\.MeshToonMaterial\s*\(/.test(playerMesh), 'player_mesh no longer creates MeshToonMaterial for player voxels');

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log('\nRESULT: PASS');
