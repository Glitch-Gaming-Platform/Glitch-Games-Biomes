#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
const pkgPath = path.join(root, 'package.json');
let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { console.log(`FAIL ${label}`); ok = false; }
}
function pkg() { return JSON.parse(fs.readFileSync(pkgPath, 'utf8')); }
function dep(p, name) { return (p.dependencies && p.dependencies[name]) || (p.devDependencies && p.devDependencies[name]) || ''; }
function major(v) {
  const m = String(v || '').match(/(\d+)\./);
  return m ? Number(m[1]) : -1;
}
console.log('== Harthmere npm peer mass audit v1 ==');
console.log(`Root: ${root}\n`);
const p = pkg();
check('package.json exists', fs.existsSync(pkgPath));
check('React remains on 18 line', major(dep(p, 'react')) === 18 && major(dep(p, 'react-dom')) === 18);
check('@silevis/reactgrid is React 18 compatible 4.1.17+', /^\^?4\.1\.(1[7-9]|[2-9]\d)/.test(dep(p, '@silevis/reactgrid')) || /^\^?[5-9]\./.test(dep(p, '@silevis/reactgrid')));
check('Emoji Mart uses v5 package line', major(dep(p, 'emoji-mart')) >= 5);
check('@emoji-mart/data is declared', !!dep(p, '@emoji-mart/data'));
check('@emoji-mart/react is declared', !!dep(p, '@emoji-mart/react'));
check('react18-json-view replaces react-json-view', !!dep(p, 'react18-json-view') && !dep(p, 'react-json-view'));
check('Stylelint Prettier config packages removed for Stylelint 15+', !dep(p, 'stylelint-config-prettier') && !dep(p, 'stylelint-config-prettier-scss'));
check('utf-8-validate is pinned to 5.0.10 for ws7/ws8 peer compatibility', dep(p, 'utf-8-validate') === '5.0.10');
check('@kubernetes/client-node upgraded to 0.22.3 pre-1 Node20 line', /^\^?0\.22\.3/.test(dep(p, '@kubernetes/client-node')));
check('@types/ws is on ws8 type line', /^\^?8\./.test(dep(p, '@types/ws')));
check('Third-party AI package yuka declared', !!dep(p, 'yuka'));
check('Third-party AI package behavior3js declared', !!dep(p, 'behavior3js'));
check('Third-party AI package recast-navigation declared', !!dep(p, 'recast-navigation'));
check('package.json does not bake in --force', !JSON.stringify(p).includes('--force'));
check('package.json does not bake in --legacy-peer-deps', !JSON.stringify(p).includes('--legacy-peer-deps'));
console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
