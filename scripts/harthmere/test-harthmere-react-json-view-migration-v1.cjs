#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.log(`FAIL ${label}`); ok = false; } }
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
console.log('== Harthmere React 18 JSON viewer migration tests v1 ==');
console.log(`Root: ${root}\n`);
const cval = read('src/client/components/CvalHUD.tsx');
const admin = read('src/client/components/admin/AdminReactJSON.tsx');
const page = read('src/pages/admin/ecs/[id].tsx');
check('CvalHUD uses react18-json-view dynamic import', /import\("react18-json-view"\)/.test(cval));
check('CvalHUD no longer references react-json-view', !/react-json-view/.test(cval));
check('AdminReactJSON uses react18-json-view dynamic import', /import\("react18-json-view"\)/.test(admin));
check('AdminReactJSON defines local React 18 wrapper props', /interface AdminReactJSONProps/.test(admin));
check('AdminReactJSON no longer imports ReactJsonViewProps from react-json-view', !/ReactJsonViewProps/.test(admin) && !/react-json-view/.test(admin));
check('ECS admin page uses local InteractionProps type', /type InteractionProps =/.test(page));
check('ECS admin page no longer imports InteractionProps from react-json-view', !/from "react-json-view"/.test(page));
check('ECS edit/delete callbacks still receive field name, namespace, old value, and new value', /field\.name/.test(page) && /field\.namespace/.test(page) && /field\.existing_value/.test(page) && /field\.new_value/.test(page));
console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
