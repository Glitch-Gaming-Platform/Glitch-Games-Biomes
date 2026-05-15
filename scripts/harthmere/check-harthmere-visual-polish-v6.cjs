#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const files = {
  shared: path.join(root, 'src/shared/harthmere/voxel_faces.ts'),
  player: path.join(root, 'src/client/game/resources/player_mesh.ts'),
  runtime: path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts'),
};

let failed = false;
function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`FAIL missing file ${file}`);
    failed = true;
    return '';
  }
}
function ok(condition, label) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    console.error(`FAIL ${label}`);
    failed = true;
  }
}

const shared = read(files.shared);
const player = read(files.player);
const runtime = read(files.runtime);

ok(shared.includes('guard_helmet'), 'shared role equipment includes guard helmet');
ok(shared.includes('merchant_satchel'), 'shared role equipment includes merchant satchel');
ok(shared.includes('clergy_sash'), 'shared role equipment includes clergy sash');
ok(shared.includes('torn_cloth'), 'shared role equipment includes undead torn cloth');
ok(shared.includes('Visual polish uses the same equipment strings'), 'shared equipment comments explain art-facing schema');

ok(player.includes('harthmereVoxelColorMix'), 'player has voxel color mixing helper');
ok(player.includes('local-dev-bolt-hair-front-highlight'), 'player hair gets highlight voxels');
ok(player.includes('local-dev-bolt-left-eye-glint'), 'player eyes get glint voxels');
ok(player.includes('local-dev-bolt-left-brow-shadow'), 'player brows get shadow voxels');
ok(player.includes('local-dev-bolt-mouth-lower-pixel'), 'player mouths get lower-pixel polish');
ok(player.includes('HARTHMERE_PLAYER_BODY_OUTFIT_ACCENT_COLORS'), 'player outfit accent color map exists');
ok(player.includes('local-dev-body-collar-polish'), 'player outfits get collar polish');
ok(player.includes('local-dev-body-left-cuff-polish'), 'player outfits get cuff polish');
ok(player.includes('local-dev-body-left-boot-polish'), 'player outfits get boot polish');
ok(player.includes('addLocalDevPlayerEquipmentPolish'), 'player equipment polish helper exists');
ok(player.includes('local-dev-player-hip-sheath-polish'), 'player hip sheath polish exists');
ok(player.includes('local-dev-player-left-arm-shield-polish'), 'player shield polish exists');
ok(player.includes('local-dev-player-back-quiver-polish'), 'player quiver polish exists');
ok(player.includes('body.stance === "heroic"') && player.includes('leftArm?.rotation.set'), 'player stance affects limb posture');

ok(runtime.includes('harthmereRuntimeColorMix'), 'runtime has voxel color mixing helper');
ok(runtime.includes('Hair polish mirrors the player voxel head'), 'runtime head polish is documented');
ok(runtime.includes('-left-eye-glint'), 'runtime eyes get glint voxels');
ok(runtime.includes('-mouth-teeth'), 'runtime open mouth has teeth detail');
ok(runtime.includes('-brow-shadow'), 'runtime brows get shadow voxels');
ok(runtime.includes('addHarthmereRuntimeOutfitAndGearPolish'), 'runtime outfit/gear polish helper exists');
ok(runtime.includes('townsperson-collar-polish'), 'runtime outfits get collar polish');
ok(runtime.includes('townsperson-left-cuff-polish'), 'runtime outfits get cuff polish');
ok(runtime.includes('townsperson-left-boot-polish'), 'runtime outfits get boot polish');
ok(runtime.includes('guard-helmet-polish'), 'runtime guard gear polish exists');
ok(runtime.includes('farmer-straw-hat-brim-polish'), 'runtime farmer gear polish exists');
ok(runtime.includes('bandit-mask-polish'), 'runtime bandit gear polish exists');
ok(runtime.includes('townsperson-left-shield-polish'), 'runtime shield gear polish exists');
ok(runtime.includes('townsperson-back-bow-polish'), 'runtime bow/quiver gear polish exists');
ok(runtime.includes('townsperson-staff-polish'), 'runtime staff gear polish exists');
ok(runtime.includes('merchant-satchel-polish'), 'runtime merchant gear polish exists');
ok(runtime.includes('addHarthmereRuntimeOutfitAndGearPolish(root, appearance, body, palette, torsoY, shoulderY, headY)'), 'runtime procedural townspeople use gear polish');

try {
  const ts = require('typescript');
  for (const [name, file] of Object.entries(files)) {
    const source = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const diags = sf.parseDiagnostics || [];
    ok(diags.length === 0, `${name} TypeScript parse diagnostics are clean`);
    if (diags.length) {
      for (const d of diags.slice(0, 10)) {
        const pos = sf.getLineAndCharacterOfPosition(d.start || 0);
        console.error(`  ${file}:${pos.line + 1}:${pos.character + 1} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
      }
    }
  }
} catch (error) {
  console.warn('WARN TypeScript package not available for parse check; structural checks still ran.');
}

console.log('');
if (failed) {
  console.error('RESULT: FAIL');
  process.exit(1);
}
console.log('RESULT: PASS');
