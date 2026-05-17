#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let ok = true;
function dep(name) { return (pkg.dependencies && pkg.dependencies[name]) || (pkg.devDependencies && pkg.devDependencies[name]) || ''; }
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.log(`FAIL ${label}`); ok = false; } }
console.log('== Harthmere known npm peer conflict tests v1 ==');
console.log(`Root: ${root}\n`);
check('old ReactGrid 4.0.x peer conflict is removed', !/^\^?4\.0\./.test(dep('@silevis/reactgrid')));
check('old emoji-mart v3 React 17 peer conflict is removed', !/^\^?3\./.test(dep('emoji-mart')));
check('old @types/emoji-mart v3/v5 mismatch is removed', !dep('@types/emoji-mart'));
check('old react-json-view React 18 peer conflict is removed', !dep('react-json-view'));
check('old stylelint-config-prettier Stylelint <15 peer conflict is removed', !dep('stylelint-config-prettier'));
check('old stylelint-config-prettier-scss Stylelint <15 peer conflict is removed', !dep('stylelint-config-prettier-scss'));
check('utf-8-validate 6.x conflict with ws7 peerOptional ^5.0.2 is removed', !/^\^?6\./.test(dep('utf-8-validate')));
check('utf-8-validate satisfies ws7 peerOptional ^5.0.2', /^5\.0\.10$/.test(dep('utf-8-validate')));
check('Kubernetes client no longer uses old 0.16.3 ws7/request-era target', !/^\^?0\.16\.3/.test(dep('@kubernetes/client-node')));
const npmrc = fs.existsSync(path.join(root, '.npmrc')) ? fs.readFileSync(path.join(root, '.npmrc'), 'utf8') : '';
check('.npmrc does not set force=true', !/^\s*force\s*=\s*true\s*$/m.test(npmrc));
check('.npmrc does not set legacy-peer-deps=true', !/^\s*legacy-peer-deps\s*=\s*true\s*$/m.test(npmrc));
console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
