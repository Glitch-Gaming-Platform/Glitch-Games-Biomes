#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const combatPath = path.join(root, 'src/client/components/challenges/LocalDevHarthmereCombat.tsx');
const combat = fs.readFileSync(combatPath, 'utf8');
const failures = [];
function assert(name, condition) {
  if (condition) console.log(`PASS ${name}`);
  else failures.push(name);
}

assert('current test target exists', combat.includes('__harthmereCombatDebug'));
assert('debug bridge exposes diagnoseAsync', /diagnoseAsync:\s*\(\s*offset\?:\s*number/.test(combat));
assert('debug bridge exposes diagnoseNearestAsync', /diagnoseNearestAsync:\s*\(ability/.test(combat));

const enableMessageMatch = combat.match(/console\.info\(\s*(['"`])([\s\S]*?Harthmere combat debug enabled[\s\S]*?)\1\s*\);/);
assert('enable message exists', Boolean(enableMessageMatch));
const enableMessage = enableMessageMatch ? enableMessageMatch[2] : '';
assert('enable message points to diagnoseAsync', enableMessage.includes('.diagnoseAsync(') || enableMessage.includes('.diagnoseAsync()'));
assert('enable message still points to diagnoseNearestAsync', enableMessage.includes('.diagnoseNearestAsync(') || enableMessage.includes('.diagnoseNearestAsync()'));
assert('enable message keeps attackAndProbe guidance', enableMessage.includes('.attackAndProbe(') || enableMessage.includes('.attackAndProbe()'));

if (failures.length) {
  console.error('\nFAILURES');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log('\nAll current retaliation diagnostics enable-message checks passed.');
