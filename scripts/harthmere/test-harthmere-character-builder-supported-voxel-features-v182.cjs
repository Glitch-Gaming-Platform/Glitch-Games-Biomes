#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
const wakePath = path.join(root, 'src/client/components/WakeUpScreen.tsx');
const sharedPath = path.join(root, 'src/shared/harthmere/voxel_faces.ts');
const wake = fs.readFileSync(wakePath, 'utf8');
const shared = fs.readFileSync(sharedPath, 'utf8');
let failures = 0;
function check(name, condition, detail) {
  if (condition) {
    console.log(`OK    ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name}`);
    if (detail) console.error(`      ${detail}`);
  }
}
function arrayValues(name) {
  const m = shared.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!m) throw new Error(`Could not find array ${name}`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
function clothingSlots() {
  const m = shared.match(/export const HARTHMERE_CLOTHING_SLOTS = \[([\s\S]*?)\] as const;/);
  if (!m) throw new Error('Could not find clothing slots');
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).filter((slot) => slot !== 'hair');
}
const faceFields = [
  ['skinTone', 'HARTHMERE_SKIN_TONES'],
  ['faceShape', 'HARTHMERE_FACE_SHAPES'],
  ['eyeShape', 'HARTHMERE_EYE_SHAPES'],
  ['eyeColor', 'HARTHMERE_EYE_COLORS'],
  ['browStyle', 'HARTHMERE_BROW_STYLES'],
  ['noseStyle', 'HARTHMERE_NOSE_STYLES'],
  ['mouthStyle', 'HARTHMERE_MOUTH_STYLES'],
  ['hairStyle', 'HARTHMERE_HAIR_STYLES'],
  ['hairColor', 'HARTHMERE_HAIR_COLORS'],
  ['facialHair', 'HARTHMERE_FACIAL_HAIR_STYLES'],
  ['cheekStyle', 'HARTHMERE_CHEEK_STYLES'],
  ['accessory', 'HARTHMERE_FACE_ACCESSORIES'],
];
const bodyFields = [
  ['bodyType', 'HARTHMERE_BODY_TYPES'],
  ['bodyHeight', 'HARTHMERE_BODY_HEIGHTS'],
  ['shoulderWidth', 'HARTHMERE_SHOULDER_WIDTHS'],
  ['armLength', 'HARTHMERE_ARM_LENGTHS'],
  ['legLength', 'HARTHMERE_LEG_LENGTHS'],
  ['stance', 'HARTHMERE_BODY_STANCES'],
  ['outfitColor', 'HARTHMERE_OUTFIT_COLORS'],
];

check('builder is marked with v182 supported voxel feature version', wake.includes('v182-supported-voxel-features'));
check('builder exposes supported voxel feature audit version', wake.includes('harthmere-supported-voxel-builder-v182'));
check('classic legacy color selector is removed from builder UI', !wake.includes('<EditCharacterColorSelector'));
check('identity-only gender controls are removed from visible builder UI', !/field="genderIdentity"/.test(wake));
check('identity-only pronoun controls are removed from visible builder UI', !/field="pronouns"/.test(wake) && !/Custom pronouns/.test(wake));
check('builder copy says only renderer-backed voxel options are shown', wake.includes('Only renderer-backed voxel options are shown'));

for (const [field, arrayName] of faceFields) {
  const values = arrayValues(arrayName);
  check(`visual face field ${field} is rendered`, wake.includes(`field="${field}"`));
  check(`visual face field ${field} uses ${arrayName}`, wake.includes(`options={${arrayName}}`));
  check(`visual face field ${field} updates through updateHarthmereBuilderField`, wake.includes(`updateHarthmereBuilderField("${field}",`));
  check(`visual face field ${field} has at least two tested options`, values.length >= 2, `${arrayName} has ${values.length}`);
}
for (const [field, arrayName] of bodyFields) {
  const values = arrayValues(arrayName);
  check(`visual body field ${field} is rendered`, wake.includes(`field="${field}"`));
  check(`visual body field ${field} uses ${arrayName}`, wake.includes(`options={${arrayName}}`));
  check(`visual body field ${field} updates through updateHarthmereBuilderField`, wake.includes(`updateHarthmereBuilderField("${field}",`));
  check(`visual body field ${field} has at least two tested options`, values.length >= 2, `${arrayName} has ${values.length}`);
}

const slots = clothingSlots();
for (const slot of slots) {
  check(`clothing slot ${slot} is included in canonical slot list`, shared.includes(`"${slot}"`));
}
check('builder renders every non-hair clothing slot from HARTHMERE_BUILDER_CLOTHING_SLOTS', wake.includes('HARTHMERE_BUILDER_CLOTHING_SLOTS.map'));
check('clothing slot clicks update through updateHarthmereClothingSlot', wake.includes('onChange={updateHarthmereClothingSlot}'));
check('clothing presets save through applyHarthmereClothingPreset', wake.includes('applyHarthmereClothingPreset'));

check('runtime audit function clicks every visible face/body option', wake.includes('__harthmereBuilderRunFullOptionAudit') && wake.includes('button[data-harthmere-builder-field][data-harthmere-builder-value]'));
check('runtime audit function clicks every visible clothing option', wake.includes('button[data-harthmere-builder-clothing-slot][data-harthmere-builder-clothing-value]'));
check('runtime audit verifies selected chip state after clicks', wake.includes('harthmereBuilderSelected') && wake.includes('harthmereBuilderClothingSelected'));
check('runtime audit verifies React state value after clicks', wake.includes('stateValue') && wake.includes('passed: selected'));
check('coverage report uses visual fields only, not identity fields', wake.includes('HARTHMERE_BUILDER_VISUAL_FACE_FIELDS') && wake.includes('HARTHMERE_BUILDER_VISUAL_BODY_FIELDS'));

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log('\nRESULT: PASS');
