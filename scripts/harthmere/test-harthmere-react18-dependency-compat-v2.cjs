#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.log(`FAIL ${label}`); ok = false; } }
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function dep(pkg, name) { for (const s of ['dependencies','devDependencies','optionalDependencies']) if (pkg[s] && pkg[s][name]) return pkg[s][name]; }
function versionValue(range) { const m = String(range || '').match(/(\d+)\.(\d+)\.(\d+)/); return m ? Number(m[1])*1000000+Number(m[2])*1000+Number(m[3]) : 0; }
console.log('== Harthmere React 18 dependency compatibility tests v2 ==');
console.log(`Root: ${root}\n`);
const pkg = JSON.parse(read('package.json'));
check('@silevis/reactgrid is React 18 compatible 4.1.15+', versionValue(dep(pkg,'@silevis/reactgrid')) >= versionValue('4.1.15'));
check('emoji-mart uses v5 package line instead of React 17 peer-bound v3', versionValue(dep(pkg,'emoji-mart')) >= versionValue('5.6.0'));
check('@emoji-mart/data is declared for v5 data loading', versionValue(dep(pkg,'@emoji-mart/data')) >= versionValue('1.2.1'));
check('@emoji-mart/react is declared for React picker wrapper', versionValue(dep(pkg,'@emoji-mart/react')) >= versionValue('1.1.1'));
check('@types/emoji-mart is removed because v3 types no longer match', !dep(pkg,'@types/emoji-mart'));
check('legacy react-json-view is removed', !dep(pkg,'react-json-view'));
check('react18-json-view is declared for React 18 JSON viewer compatibility', versionValue(dep(pkg,'react18-json-view')) >= versionValue('0.2.10'));
check('yuka remains declared', versionValue(dep(pkg,'yuka')) >= versionValue('0.7.8'));
check('behavior3js remains declared', versionValue(dep(pkg,'behavior3js')) >= versionValue('0.2.2'));
check('recast-navigation remains declared', versionValue(dep(pkg,'recast-navigation')) >= versionValue('0.43.1'));
const pkgText = read('package.json');
check('package.json does not use --force', !/--force/.test(pkgText));
check('package.json does not use --legacy-peer-deps', !/--legacy-peer-deps/.test(pkgText));
const npmrc = fs.existsSync(path.join(root,'.npmrc')) ? read('.npmrc') : '';
check('no .npmrc force=true workaround', !/^\s*force\s*=\s*true\s*$/mi.test(npmrc));
check('no .npmrc legacy-peer-deps=true workaround', !/^\s*legacy-peer-deps\s*=\s*true\s*$/mi.test(npmrc));
console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
