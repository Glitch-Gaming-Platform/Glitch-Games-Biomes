#!/usr/bin/env node
// HARTHMERE_RENDERER_MATERIAL_ARRAY_V156
// Regression guard for production WebGL sampler mismatch caused by classifying
// THREE.Material[] as one ordinary Three.js material.

const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const scenesPath = path.join(root, 'src/client/game/renderers/scenes.ts');
let failures = 0;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

console.log('== Harthmere renderer material array v156 ==');
ok(fs.existsSync(scenesPath), 'scenes.ts exists');
const scenes = fs.readFileSync(scenesPath, 'utf8');

ok(scenes.includes('HARTHMERE_SCENES_MULTI_MATERIAL_ARRAY_V156'), 'V156 marker exists');
ok(scenes.includes('materialsForMeshV156'), 'shared material-array helper exists');
ok(scenes.includes('Array.isArray(material) ? material : material ? [material] : []'), 'helper expands Material[] and single Material');
ok(scenes.includes('for (const material of materialsForMeshV156(child))') && scenes.includes('seenScenes.add(sceneForMaterial(material))'), 'scenesForObject classifies every material in a multi-material mesh');
ok(!scenes.includes('seenScenes.add(sceneForMaterial(child.material))'), 'old array-as-one-material classifier is gone');
ok(scenes.includes('for (const material of materialsForMeshV156(child))') && scenes.includes('addMaterialDependency(scene, name, material)'), 'addMaterialDependencies records dependencies for every material in a multi-material mesh');
ok(scenes.includes('Mismatch between texture format') && scenes.includes('THREE.Material[]'), 'comment documents the production sampler mismatch guarded by V156');
ok(scenes.includes('HARTHMERE_MIXED_SCENE_TYPE_PROD_SAFE_FALLBACK_V155'), 'V155 mixed-scene production fallback remains active');
ok(scenes.includes('__harthmereSceneDebug'), 'V155 console scene debug bridge remains available');

if (failures) {
  console.error(`RESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log('RESULT: PASS');
