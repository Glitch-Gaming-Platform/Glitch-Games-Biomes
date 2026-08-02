#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.log(`FAIL ${label}`); ok = false; }
}
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function versionValue(range) {
  const m = String(range || '').match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return Number(m[1]) * 1000000 + Number(m[2]) * 1000 + Number(m[3]);
}
function dep(pkg, name) {
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    if (pkg[section] && pkg[section][name]) return { section, range: pkg[section][name] };
  }
  return null;
}

console.log('== Harthmere NPC AI package compatibility tests current ==');
console.log(`Root: ${root}\n`);

const packagePath = path.join(root, 'package.json');
check('package.json exists', fs.existsSync(packagePath));
const pkg = JSON.parse(read('package.json'));

const yuka = dep(pkg, 'yuka');
const behavior3 = dep(pkg, 'behavior3js');
const recast = dep(pkg, 'recast-navigation');

check('unused @silevis/reactgrid peer blocker is removed', !dep(pkg, '@silevis/reactgrid'));
check('yuka is declared for third-party steering/game AI', !!yuka && versionValue(yuka.range) >= versionValue('0.7.8'));
check('behavior3js is declared for third-party behavior trees', !!behavior3 && versionValue(behavior3.range) >= versionValue('0.2.2'));
check('recast-navigation is declared for third-party navmesh/pathfinding', !!recast && versionValue(recast.range) >= versionValue('0.43.1'));

const pkgText = read('package.json');
check('package.json does not bake in --force install behavior', !/--force/.test(pkgText));
check('package.json does not bake in --legacy-peer-deps install behavior', !/--legacy-peer-deps/.test(pkgText));

const npmrcPath = path.join(root, '.npmrc');
if (fs.existsSync(npmrcPath)) {
  const npmrc = read('.npmrc');
  check('.npmrc does not globally force peer override', !/^\s*force\s*=\s*true\s*$/mi.test(npmrc));
  check('.npmrc does not globally force legacy peer dependency resolution', !/^\s*legacy-peer-deps\s*=\s*true\s*$/mi.test(npmrc));
} else {
  check('.npmrc absent or no global peer override needed', true);
}

const lockPath = path.join(root, 'package-lock.json');
check('package-lock exists for npm peer-resolution verification', fs.existsSync(lockPath));

console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
