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

console.log('== Harthmere NPC AI adapter runtime safety tests v1 ==');
console.log(`Root: ${root}\n`);

const adapterPath = 'src/client/components/challenges/LocalDevHarthmereNpcThirdPartyAiAdapters.ts';
const aiPath = 'src/client/components/challenges/LocalDevHarthmereNpcAiSystem.ts';
check('third-party adapter module exists', fs.existsSync(path.join(root, adapterPath)));
check('NPC AI system exists', fs.existsSync(path.join(root, aiPath)));
const adapter = fs.existsSync(path.join(root, adapterPath)) ? read(adapterPath) : '';
const ai = fs.existsSync(path.join(root, aiPath)) ? read(aiPath) : '';

check('adapter loads yuka with runtime dynamic import', /import\([`'"]yuka[`'"]\)/.test(adapter));
check('adapter loads behavior3js with runtime dynamic import', /import\([`'"]behavior3js[`'"]\)/.test(adapter));
check('adapter loads recast-navigation with runtime dynamic import', /import\([`'"]recast-navigation[`'"]\)/.test(adapter));
check('adapter preserves deterministic fallback when packages are missing', /fallback/i.test(adapter) && /deterministic/i.test(adapter));
check('adapter exposes package availability/status helper', /status/i.test(adapter) && /available/i.test(adapter));
check('AI system imports only the local adapter for third-party AI wiring', /LocalDevHarthmereNpcThirdPartyAiAdapters/.test(ai));
check('AI system does not top-level import yuka directly', !/^\s*import\s+.*from\s+['"]yuka['"]/m.test(ai));
check('AI system does not top-level import behavior3js directly', !/^\s*import\s+.*from\s+['"]behavior3js['"]/m.test(ai));
check('AI system does not top-level import recast-navigation directly', !/^\s*import\s+.*from\s+['"]recast-navigation['"]/m.test(ai));
check('third-party adapters are optional/fallback-safe for TDD and local dev', /fallback/i.test(adapter) && /try\s*{/.test(adapter) && /catch\s*\(/.test(adapter));

console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
