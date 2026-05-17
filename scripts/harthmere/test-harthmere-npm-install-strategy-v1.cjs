#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
const installer = path.join(root, 'scripts/harthmere/install-harthmere-ai-deps-v1.sh');
const audit = path.join(root, 'scripts/harthmere/run-harthmere-npm-peer-audit-v1.sh');
let ok = true;
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.log(`FAIL ${label}`); ok = false; } }
console.log('== Harthmere npm install strategy tests v1 ==');
console.log(`Root: ${root}\n`);
check('AI dependency installer exists', fs.existsSync(installer));
check('mass npm peer audit runner exists', fs.existsSync(audit));
const text = fs.existsSync(installer) ? fs.readFileSync(installer, 'utf8') : '';
const auditText = fs.existsSync(audit) ? fs.readFileSync(audit, 'utf8') : '';
check('installer supports package-lock-only refresh', /HARTHMERE_PACKAGE_LOCK_ONLY/.test(text));
check('installer uses normal npm install path', /npm install(\s|$)/.test(text));
check('installer does not use --force', !/--force/.test(text));
check('installer does not use --legacy-peer-deps', !/--legacy-peer-deps/.test(text));
check('installer runs mass peer audit tests before install', /test-harthmere-npm-peer-mass-audit-v1\.cjs/.test(text));
check('audit runner captures npm ERESOLVE logs', /ERESOLVE/.test(auditText) && /npm-install-peer-audit/.test(auditText));
check('audit runner does not bypass npm resolver', !/npm install[^\n]*--force/.test(auditText) && !/npm install[^\n]*--legacy-peer-deps/.test(auditText));
console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
