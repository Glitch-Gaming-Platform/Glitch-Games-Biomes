#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.log(`FAIL ${label}`); ok = false; } }
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function dep(pkg, name) { for (const s of ['dependencies','devDependencies','optionalDependencies']) if (pkg[s] && pkg[s][name]) return pkg[s][name]; }
function versionValue(range) { const m = String(range || '').match(/(\d+)\.(\d+)\.(\d+)/); return m ? Number(m[1])*1000000+Number(m[2])*1000+Number(m[3]) : 0; }
console.log('== Harthmere React 19 dependency compatibility tests current ==');
console.log(`Root: ${root}\n`);
const pkg = JSON.parse(read('package.json'));
check('React and React DOM are on the React 19 line', /^19\./.test(dep(pkg,'react')) && /^19\./.test(dep(pkg,'react-dom')));
check('unused ReactGrid peer blocker is removed', !dep(pkg,'@silevis/reactgrid'));
check('emoji-mart uses current package line instead of React 17 peer-bound current', versionValue(dep(pkg,'emoji-mart')) >= versionValue('5.6.0'));
check('@emoji-mart/data is declared for current data loading', versionValue(dep(pkg,'@emoji-mart/data')) >= versionValue('1.2.1'));
check('React-18-bound @emoji-mart/react wrapper is removed', !dep(pkg,'@emoji-mart/react'));
check('React Leaflet is on its React 19 line', versionValue(dep(pkg,'react-leaflet')) >= versionValue('5.0.0'));
check('@types/emoji-mart is removed because current types no longer match', !dep(pkg,'@types/emoji-mart'));
check('legacy react-json-view is removed', !dep(pkg,'react-json-view'));
check('react18-json-view remains compatible through its React >=16 peer', versionValue(dep(pkg,'react18-json-view')) >= versionValue('0.2.10'));
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
