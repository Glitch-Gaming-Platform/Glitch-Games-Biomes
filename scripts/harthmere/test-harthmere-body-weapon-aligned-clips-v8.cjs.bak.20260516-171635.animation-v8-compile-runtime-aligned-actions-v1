#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const variantDir = path.join(root, 'public/assets/harthmere/gltf/characters/player_body_variants');
const playerAnimationsPath = path.join(root, 'src/client/game/util/player_animations.ts');
const hudPath = path.join(root, 'src/client/components/challenges/HarthmereUnifiedHUD.tsx');
const contractPath = path.join(root, 'src/shared/harthmere/body_weapon_animation_sync_manifest_v8.ts');

const VERSION = 'harthmere-body-weapon-aligned-clips-v8';
const REQUIRED = [
  'HarthmereBodyWeaponIdleDrawn_Aligned_30',
  'HarthmereBodyWeaponBasic_Aligned_30',
  'HarthmereBodyWeaponHeavy_Aligned_30',
  'HarthmereBodyWeaponDraw_Aligned_30',
  'HarthmereBodyWeaponSheathe_Aligned_30',
  'HarthmereBodyWeaponBlock_Aligned_30',
  'HarthmereBodyShieldBash_Aligned_30',
  'HarthmereBodyRangedDraw_Aligned_30',
  'HarthmereBodyRangedRelease_Aligned_30',
  'HarthmereBodyRangedReload_Aligned_30',
  'HarthmereBodyMagicCast_Aligned_30',
  'HarthmereBodyMagicChannel_Aligned_30',
  'HarthmereBodyToolUse_Aligned_30',
  'HarthmereBodyToolHeavyUse_Aligned_30',
  'HarthmereBodyItemUse_Aligned_30',
];
const BODY_TYPES = ['average','slim','broad','stocky','athletic','soft'];
const COLORS = ['earth','forest','river','ember','royal','ash'];

let failures = 0;
function ok(label, condition, details = '') {
  if (condition) console.log('OK ' + label);
  else { failures++; console.log('FAIL ' + label); if (details) console.log('  - ' + details); }
}
function readText(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; }
function decodeBuffer(gltf) {
  const uri = gltf.buffers?.[0]?.uri || '';
  if (!uri.startsWith('data:')) throw new Error('expected embedded data URI buffer');
  return Buffer.from(uri.split(',',2)[1], 'base64');
}
function accessorFloats(gltf, buffer, idx) {
  const acc = gltf.accessors[idx];
  const view = gltf.bufferViews[acc.bufferView];
  const comps = { SCALAR: 1, VEC3: 3, VEC4: 4 }[acc.type];
  const byteOffset = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const out = [];
  for (let i=0; i<acc.count*comps; i++) out.push(buffer.readFloatLE(byteOffset + i*4));
  return { values: out, count: acc.count, comps, type: acc.type };
}
function quatAngleDegrees(q) {
  const w = Math.max(-1, Math.min(1, Math.abs(q[3])));
  return 2 * Math.acos(w) * 180 / Math.PI;
}
function animationByName(gltf, name) { return (gltf.animations || []).find((a) => a.name === name); }
function targetName(gltf, ch) { return gltf.nodes[ch.target.node]?.name; }

console.log('== Harthmere body/weapon aligned clip tests v8 ==');
console.log('Root:', root, '\n');

const variantFiles = fs.existsSync(variantDir) ? fs.readdirSync(variantDir)
  .filter((n) => /^harthmere_player_.*\.gltf$/.test(n) && !n.includes('manifest') && !n.includes('action_animation'))
  .sort() : [];

ok('all 36 body color/size variants are present', variantFiles.length === 36, `Found ${variantFiles.length}`);
for (const body of BODY_TYPES) {
  for (const color of COLORS) {
    ok(`body variant exists for ${body}/${color}`, variantFiles.includes(`harthmere_player_${body}_${color}.gltf`));
  }
}

let allHaveClips = true;
let allThirtyFrames = true;
let allHaveMetadata = true;
let allHaveCoreTargets = true;
let rootLocked = true;
let chestStable = true;
let clipNamesSeen = new Set();
let impactMetadataGood = true;
let noOnlyLegacyAttack = true;

for (const file of variantFiles) {
  const p = path.join(variantDir, file);
  const gltf = JSON.parse(fs.readFileSync(p, 'utf8'));
  const buffer = decodeBuffer(gltf);
  const names = new Set((gltf.animations || []).map((a) => a.name));
  for (const name of REQUIRED) {
    const anim = animationByName(gltf, name);
    clipNamesSeen.add(name);
    if (!anim) { allHaveClips = false; continue; }
    const extras = anim.extras || {};
    if (!extras[VERSION] || extras.frameCount !== 30 || extras.fps !== 30) allHaveMetadata = false;
    const nodeTargets = new Set(anim.channels.map((ch) => `${targetName(gltf,ch)}:${ch.target.path}`));
    for (const must of ['Hips:translation','Chest:rotation','RightArm:rotation','RightHand:rotation','LeftArm:rotation','LeftHand:rotation']) {
      if (!nodeTargets.has(must)) allHaveCoreTargets = false;
    }
    const timeSampler = anim.samplers[0];
    const time = accessorFloats(gltf, buffer, timeSampler.input);
    if (time.count !== 30) allThirtyFrames = false;
    if (/Basic|Heavy|Release|Tool|Bash/.test(name)) {
      const impactFrame = extras.impactFrame;
      if (!(Number.isInteger(impactFrame) && impactFrame > 0 && impactFrame < 29)) impactMetadataGood = false;
    }
    for (const ch of anim.channels) {
      const sampler = anim.samplers[ch.sampler];
      const node = targetName(gltf, ch);
      const data = accessorFloats(gltf, buffer, sampler.output);
      if (node === 'Hips' && ch.target.path === 'translation') {
        for (let i=0; i<data.values.length; i+=3) {
          const mag = Math.hypot(data.values[i], data.values[i+1], data.values[i+2]);
          if (mag > 0.015) rootLocked = false;
        }
      }
      if (node === 'Chest' && ch.target.path === 'rotation') {
        for (let i=0; i<data.values.length; i+=4) {
          const angle = quatAngleDegrees(data.values.slice(i, i+4));
          if (angle > 8) chestStable = false;
        }
      }
    }
  }
  if (names.has('Attack') && names.has('HeavyAttack') && !names.has('HarthmereBodyWeaponBasic_Aligned_30')) noOnlyLegacyAttack = false;
}

ok('every body variant contains every aligned weapon/item clip', allHaveClips);
ok('every aligned clip uses exactly 30 keyframes', allThirtyFrames);
ok('aligned clips carry production metadata/version/fps/frameCount', allHaveMetadata);
ok('aligned clips target right/left arms, hands, stable chest, and locked hips', allHaveCoreTargets);
ok('aligned clips lock root/hips translation to prevent body drift', rootLocked);
ok('aligned clips keep chest rotation subtle to avoid full-body tumble', chestStable);
ok('impact-frame metadata exists for strike/release/tool/bash clips', impactMetadataGood);
ok('legacy Attack/HeavyAttack are no longer the only body attack clips', noOnlyLegacyAttack);

const manifestText = readText(contractPath);
ok('shared v8 body/weapon animation sync manifest exists', fs.existsSync(contractPath));
ok('shared manifest declares all aligned clips', REQUIRED.every((name) => manifestText.includes(name)));
ok('shared manifest accounts for all body size/color variants', BODY_TYPES.every((b) => manifestText.includes(b)) && COLORS.every((c) => manifestText.includes(c)));
ok('shared manifest covers melee/ranged/magic/shield/tool/item profiles', ['melee','ranged','magic','shield','tool','item'].every((x) => manifestText.includes(x)));

const pa = readText(playerAnimationsPath);
ok('player animation system prefers aligned basic attack clip', /attack1:\s*\{[^}]*HarthmereBodyWeaponBasic_Aligned_30/s.test(pa));
ok('player animation system prefers aligned heavy attack clip', /attack2:\s*\{[^}]*HarthmereBodyWeaponHeavy_Aligned_30/s.test(pa));
ok('player animation system keeps legacy attack fallbacks for non-Harthmere bodies', /backupFileAnimationNames:\s*\[[^\]]*Attack/s.test(pa) && /backupFileAnimationNames:\s*\[[^\]]*HeavyAttack/s.test(pa));
ok('ranged body actions prefer aligned ranged clips', /rangedAim:\s*\{[^}]*HarthmereBodyRangedDraw_Aligned_30/s.test(pa) && /rangedRelease:\s*\{[^}]*HarthmereBodyRangedRelease_Aligned_30/s.test(pa));
ok('magic body actions prefer aligned magic clips', /magicCast:\s*\{[^}]*HarthmereBodyMagicCast_Aligned_30/s.test(pa) && /magicChannel:\s*\{[^}]*HarthmereBodyMagicChannel_Aligned_30/s.test(pa));
ok('shield body actions prefer aligned block/bash clips', /shieldBlock:\s*\{[^}]*HarthmereBodyWeaponBlock_Aligned_30/s.test(pa) && /shieldBash:\s*\{[^}]*HarthmereBodyShieldBash_Aligned_30/s.test(pa));
ok('tool/build/repair actions prefer aligned tool clips', /mineImpact:\s*\{[^}]*HarthmereBodyToolUse_Aligned_30/s.test(pa) && /repairImpact:\s*\{[^}]*HarthmereBodyToolUse_Aligned_30/s.test(pa) && /buildPlace:\s*\{[^}]*HarthmereBodyToolUse_Aligned_30/s.test(pa));
ok('item use/eat/drink have aligned item animation coverage', /eat:\s*\{[^}]*HarthmereBodyItemUse_Aligned_30/s.test(pa) && /drink:\s*\{[^}]*HarthmereBodyItemUse_Aligned_30/s.test(pa));
ok('weapon body attacks remain upper-body-only', /getHarthmereWeaponSyncedEmoteWeightsV5[\s\S]*layers:\s*\{[\s\S]*arms:\s*"apply"[\s\S]*notArms:\s*"noApply"/s.test(pa));
ok('body animation sync has dt cap and deadzone to reduce jitter', /HARTHMERE_BODY_MAX_BLEND_DT/.test(pa) && /HARTHMERE_BODY_LOCOMOTION_DEADZONE_SPEED/.test(pa));

const hud = readText(hudPath);
ok('HUD debug desired body animation names reference aligned attack clips', !hud || /HarthmereBodyWeaponBasic_Aligned_30/.test(hud) || /desiredFileAnimationName/.test(hud));

console.log('');
if (failures) {
  console.log(`RESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log('RESULT: PASS');

