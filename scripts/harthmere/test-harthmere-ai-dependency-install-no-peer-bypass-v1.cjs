#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.log(`FAIL ${label}`); ok = false; }
}
console.log('== Harthmere AI dependency install no peer bypass tests v1 ==');
console.log(`Root: ${root}\n`);
const installer = path.join(root, 'scripts/harthmere/install-harthmere-ai-deps-v1.sh');
check('AI dependency installer exists', fs.existsSync(installer));
const text = fs.existsSync(installer) ? fs.readFileSync(installer, 'utf8') : '';
check('installer still uses normal npm install path', text.includes('npm install'));
check('installer still supports package-lock-only refresh', text.includes('--package-lock-only'));
check('installer does not use --force', !text.includes('--force'));
check('installer does not use --legacy-peer-deps', !text.includes('--legacy-peer-deps'));
check('installer runs Stylelint cleanup compatibility test', text.includes('test-harthmere-stylelint15-prettier-cleanup-v1.cjs'));
const npmrc = path.join(root, '.npmrc');
const npmrcText = fs.existsSync(npmrc) ? fs.readFileSync(npmrc, 'utf8') : '';
check('.npmrc does not force peer dependency bypass', !/legacy-peer-deps\s*=\s*true|force\s*=\s*true/.test(npmrcText));
if (!ok) {
  console.log('\nRESULT: FAIL');
  process.exit(1);
}
console.log('\nRESULT: PASS');
