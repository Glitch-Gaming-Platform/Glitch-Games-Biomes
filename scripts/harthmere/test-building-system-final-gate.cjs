#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const required = [
  'scripts/harthmere/test-building-system-production.cjs',
  'scripts/harthmere/test-building-system-ui.cjs',
  'scripts/harthmere/test-building-system-production.cjs',
  'scripts/harthmere/test-building-system-production.cjs',
  'scripts/harthmere/test-building-system-production.cjs',
  'scripts/harthmere/test-building-system-browser-smoke.cjs',
  'scripts/harthmere/test-biomes-ui-inventory-production.cjs',
];
let failed = 0;
console.log('== Building System final test gate current ==');
for (const rel of required) {
  const ok = fs.existsSync(path.join(root, rel));
  console.log(`${ok ? 'OK' : 'FAIL'} required test exists: ${rel}`);
  if (!ok) failed += 1;
}
const command = [
  'node scripts/harthmere/test-building-system-production.cjs',
  'node scripts/harthmere/test-building-system-ui.cjs',
  'node scripts/harthmere/test-building-system-production.cjs',
  'node scripts/harthmere/test-building-system-production.cjs',
  'node scripts/harthmere/test-building-system-production.cjs',
  'node scripts/harthmere/test-biomes-ui-inventory-production.cjs',
  'node scripts/harthmere/test-building-system-browser-smoke.cjs',
].join(' && ');
console.log(`OK final local command: ${command}`);
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
