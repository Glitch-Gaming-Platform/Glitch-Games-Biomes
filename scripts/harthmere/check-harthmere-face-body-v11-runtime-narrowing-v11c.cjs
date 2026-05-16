#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) {
  console.error('Usage: node check-harthmere-face-body-v11-runtime-narrowing-v11c.cjs /path/to/biomes-game');
  process.exit(2);
}

const assetsPath = path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts');
let ok = true;
function check(name, pass) {
  if (pass) {
    console.log(`OK ${name}`);
  } else {
    console.log(`FAIL ${name}`);
    ok = false;
  }
}

const assets = fs.existsSync(assetsPath) ? fs.readFileSync(assetsPath, 'utf8') : '';

check('assets file exists', Boolean(assets));
check('walk debug snapshot method exists', /harthmereTownWalkDebugPlayerSnapshot\(\)/.test(assets));
check('runtime has explicit existence guard', /if \(runtime && Array\.isArray\(runtime\.position\)\)/.test(assets));
check('runtime position map is inside guarded block', /if \(runtime && Array\.isArray\(runtime\.position\)\) \{\s*const runtimePosition = runtime\.position\.map\(\(value: unknown\) => Number\(value\)\);/s.test(assets));
check('runtime every callback is typed', /runtimePosition\.every\(\(value: number\) => Number\.isFinite\(value\)\)/.test(assets));
check('runtime source no longer uses optional chain after guard', /source: String\(runtime\.source \?\? "__harthmereForwardArcRuntime"\)/.test(assets));
check('runtime forward no longer uses optional chain in guarded block', /forward: Array\.isArray\(runtime\.forward\)\s*\? runtime\.forward\.map\(\(value: unknown\) => Number\(value\)\)\.slice\(0, 2\)/s.test(assets));
check('old runtime optional position narrowing is gone', !/Array\.isArray\(runtime\?\.position\)/.test(assets));
check('old runtime optional forward narrowing is gone', !/Array\.isArray\(runtime\?\.forward\)/.test(assets));
check('old optional runtime source is gone', !/runtime\?\.source/.test(assets));

console.log(`\nRESULT: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
