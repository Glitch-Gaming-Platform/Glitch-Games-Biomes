#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [];
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });

const face = read('src/shared/harthmere/voxel_faces.ts');
const wake = read('src/client/components/WakeUpScreen.tsx');

check('legacy cheeks alias type exists', /type HarthmereLegacyFaceConfig[\s\S]*cheeks\?: HarthmereCheekStyle/.test(face));
check('legacy height alias type exists', /type HarthmereLegacyBodyConfig[\s\S]*height\?: HarthmereBodyHeight/.test(face));
check('face normalizer reads legacy cheeks alias', /legacy\.cheekStyle \?\? legacy\.cheeks/.test(face));
check('body normalizer reads legacy height alias', /legacy\.bodyHeight \?\? legacy\.height/.test(face));
check('storage write de-dupes unchanged configs', /function writeHarthmereJsonIfChanged/.test(face) && /window\.localStorage\.getItem\(key\) === serialized/.test(face));
check('face save dispatches detailed event only after change', /dispatchHarthmereAppearanceStorageEvent\("biomes:harthmere-face-changed"/.test(face) && /face: normalized/.test(face));
check('body save dispatches detailed event only after change', /dispatchHarthmereAppearanceStorageEvent\("biomes:harthmere-body-changed"/.test(face) && /body: normalized/.test(face));
check('appearance changed bridge event exists', /biomes:harthmere-appearance-changed/.test(face));
check('builder buttons expose audit field', /data-harthmere-builder-field=\{auditField\}/.test(wake));
check('builder buttons expose audit value', /data-harthmere-builder-value=\{option\}/.test(wake));
check('builder buttons expose selected state', /data-harthmere-builder-selected=\{selected \? "true" : "false"\}/.test(wake));
check('builder buttons expose aria-pressed', /aria-pressed=\{selected\}/.test(wake));
check('classic color warning added', /Classic base colors affect the legacy Biomes appearance/.test(wake));

let failed = false;
for (const c of checks) {
  console.log(`${c.ok ? 'OK' : 'FAIL'} ${c.name}`);
  if (!c.ok) failed = true;
}
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
