#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
const wakePath = path.join(root, 'src/client/components/WakeUpScreen.tsx');
const bridgePath = path.join(root, 'src/client/game/glitch/harthmere_glitch_bridge.ts');
const sharedPath = path.join(root, 'src/shared/harthmere/voxel_faces.ts');
const wake = fs.readFileSync(wakePath, 'utf8');
const bridge = fs.readFileSync(bridgePath, 'utf8');
const shared = fs.readFileSync(sharedPath, 'utf8');
let failures = 0;
function check(name, condition, detail) {
  if (condition) console.log(`OK    ${name}`);
  else { failures += 1; console.error(`FAIL  ${name}`); if (detail) console.error(`      ${detail}`); }
}

check('face save writes to Harthmere player face localStorage key', shared.includes('harthmerePlayerFaceStorageKey') && shared.includes('saveHarthmerePlayerFaceConfig'));
check('body save writes to Harthmere player body localStorage key', shared.includes('harthmerePlayerBodyStorageKey') && shared.includes('saveHarthmerePlayerBodyConfig'));
check('clothing save writes to Harthmere player clothing localStorage key', shared.includes('harthmerePlayerClothingStorageKey') && shared.includes('saveHarthmerePlayerClothingConfig'));
check('runtime player appearance loads saved face/body/clothing before play', shared.includes('loadHarthmerePlayerAppearanceConfig') && shared.includes('loadHarthmerePlayerFaceConfig(userId)') && shared.includes('loadHarthmerePlayerBodyConfig(userId)') && shared.includes('loadHarthmerePlayerClothingConfig(userId, body)'));

check('builder saves face locally on each face/body field option click', wake.includes('saveHarthmerePlayerFaceConfig(userId, result.face)'));
check('builder saves body locally on each body field option click', wake.includes('saveHarthmerePlayerBodyConfig(userId, result.body)'));
check('builder saves clothing locally on each slot click', wake.includes('saveHarthmerePlayerClothingConfig(userId, next, harthmereBody)'));
check('Create Hero flushes local face/body/clothing saves before entering game', /const startGame = \(\) => \{[\s\S]*saveHarthmerePlayerFaceConfig\(userId, harthmereFace\);[\s\S]*saveHarthmerePlayerBodyConfig\(userId, harthmereBody\);[\s\S]*saveHarthmerePlayerClothingConfig\(userId, harthmereClothing, harthmereBody\);[\s\S]*onComplete\(\);/.test(wake));

check('builder has robust Glitch save bridge helper', wake.includes('requestHarthmereBuilderGlitchSave'));
check('builder checks URL install_id and stored install id before Glitch save', wake.includes('builderUrlInstallId') && wake.includes('builderStoredInstallId'));
check('builder uses optional __harthmereGlitch.saveNow and never hard-imports bridge', wake.includes('__harthmereGlitch') && wake.includes('saveNow?: () => Promise<void>'));
check('builder Glitch save catches errors instead of crashing startup', wake.includes('.catch((error) =>') && wake.includes('Glitch save skipped after local character save'));
check('builder emits Glitch save audit event', wake.includes('biomes:harthmere-builder-glitch-save'));
check('builder queues safe Glitch save after face/body/clothing option changes', wake.includes('queueHarthmereBuilderGlitchSave("builder-face-option")') && wake.includes('queueHarthmereBuilderGlitchSave("builder-body-option")') && wake.includes('queueHarthmereBuilderGlitchSave("builder-clothing-slot")'));
check('Create Hero flushes a final Glitch save request', wake.includes('flushHarthmereBuilderGlitchSave("builder-create-hero")'));

check('Glitch bridge snapshots all Harthmere localStorage keys', bridge.includes('collectHarthmereStorage') && bridge.includes('key.startsWith(HARTHMERE_STORAGE_PREFIX)'));
check('Glitch bridge storeSave sends snapshot localStorage', bridge.includes('storeSave') && bridge.includes('snapshot,') && bridge.includes('localStorage'));
check(
  'Glitch bridge restore applies allowed Harthmere localStorage keys',
  bridge.includes('function applySnapshot') &&
    bridge.includes('isHarthmereCloudSaveStorageKeyV153(key)') &&
    bridge.includes('window.localStorage.setItem(') &&
    bridge.includes('key === ACTIVE_USER_SCOPE_KEY') &&
    bridge.includes('migrateCloudSaveStorageKeyToCurrentScopeV153(key)')
);
check('Glitch save path can skip safely when install id is missing', wake.includes('missing-active-glitch-save-bridge') && wake.includes('status: "skipped"'));
check('Glitch save path can skip safely when bridge is invalid or disconnected', wake.includes('status?.mode === "invalid"') && wake.includes('status?.mode === "disconnected"'));

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log('\nRESULT: PASS');
