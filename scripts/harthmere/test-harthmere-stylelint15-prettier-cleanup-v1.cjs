#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.log(`FAIL ${label}`); ok = false; }
}
function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
function parsePackage() {
  const pkgPath = path.join(root, 'package.json');
  check('package.json exists', fs.existsSync(pkgPath));
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}
function getDep(pkg, name) {
  return (pkg.dependencies && pkg.dependencies[name]) ||
    (pkg.devDependencies && pkg.devDependencies[name]) ||
    (pkg.optionalDependencies && pkg.optionalDependencies[name]) ||
    (pkg.peerDependencies && pkg.peerDependencies[name]) || '';
}

console.log('== Harthmere Stylelint 15 Prettier cleanup tests v1 ==');
console.log(`Root: ${root}\n`);
const pkg = parsePackage();
const stylelint = getDep(pkg, 'stylelint');
const standard = getDep(pkg, 'stylelint-config-standard');
const prettier = getDep(pkg, 'stylelint-config-prettier');
const prettierScss = getDep(pkg, 'stylelint-config-prettier-scss');

check('stylelint remains declared', Boolean(stylelint));
check('stylelint is on v15+ line or newer', /\^?(1[5-9]|[2-9]\d)\./.test(stylelint));
check('stylelint-config-standard remains declared', Boolean(standard));
check('deprecated stylelint-config-prettier package is removed', !prettier);
check('deprecated stylelint-config-prettier-scss package is removed if it existed', !prettierScss);
check('package.json does not use --force', !JSON.stringify(pkg).includes('--force'));
check('package.json does not use --legacy-peer-deps', !JSON.stringify(pkg).includes('--legacy-peer-deps'));

const configNames = [
  '.stylelintrc', '.stylelintrc.json', '.stylelintrc.js', '.stylelintrc.cjs', '.stylelintrc.yaml', '.stylelintrc.yml',
  'stylelint.config.js', 'stylelint.config.cjs', 'stylelint.config.ts', 'stylelint.config.mjs',
];
const existingConfigs = configNames.filter((name) => fs.existsSync(path.join(root, name)));
check('Stylelint config file is optional but any existing config is inspectable', Array.isArray(existingConfigs));
for (const name of existingConfigs) {
  const text = read(path.join(root, name));
  check(`${name} does not extend stylelint-config-prettier`, !text.includes('stylelint-config-prettier'));
}
if (pkg.stylelint) {
  check('package.json embedded stylelint config does not extend stylelint-config-prettier', !JSON.stringify(pkg.stylelint).includes('stylelint-config-prettier'));
}

if (!ok) {
  console.log('\nRESULT: FAIL');
  process.exit(1);
}
console.log('\nRESULT: PASS');
