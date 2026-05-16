#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
let failed = 0;
function check(name, condition) {
  if (condition) {
    console.log(`OK ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name}`);
  }
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
const wake = read('src/client/components/WakeUpScreen.tsx');
const css = read('src/client/styles/edit_character.css');
const scriptPath = path.join(root, 'scripts/node/harthmere_clear_local_dev_avatars.ts');
const script = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : '';

check('Redis avatar cleanup script exists', fs.existsSync(scriptPath));
check('cleanup script subscribes to player_status entities', /filter:\s*\{\s*anyOf:\s*\["player_status"\]/s.test(script));
check('cleanup script requires keep id or force all', /Refusing to delete local-dev avatar\/player entities without a keep id/.test(script) && /--force-all/.test(script));
check('cleanup script deletes stale player entities', /kind:\s*"delete"\s+as const/.test(script));
check('cleanup script uses direct RedisWorld ECS access', /new RedisWorld\(await connectToRedisWithLua\("ecs"\)\)/.test(script));
check('builder layout marked v13 balanced preview', /data-harthmere-builder-layout="v13-balanced-preview"/.test(wake));
check('builder width reduced from v12 huge layout', /w-\[min\(82rem,96vw\)\]/.test(wake) && !/w-\[min\(106rem,98vw\)\]/.test(wake));
check('builder grid uses smaller left preview column', /lg:grid-cols-\[minmax\(20rem,26rem\)_minmax\(0,1fr\)\]/.test(wake));
check('preview container no longer uses 28rem minimum', !/min-h-\[28rem\]/.test(wake) && /min-h-\[18rem\]/.test(wake));
check('character camera pulled back', /new Spherical\(\s*3\.75,/s.test(wake));
check('character camera target lowered', /controlTarget=\{new Vector3\(0, 0\.58, 0\)\}/.test(wake));
check('character camera FOV widened', /cameraFOV=\{42\}/.test(wake));
check('option cards are more compact', /text-\[0\.72rem\]/.test(wake) && /rounded-lg border px-2 py-1/.test(wake));
check('v13 scoped CSS exists', /Harthmere character builder v13 balanced preview polish/.test(css));
check('v13 CSS constrains avatar viewer max height', /max-height:\s*23rem/.test(css));
check('v13 CSS has small-height media guard', /@media \(max-height: 760px\)/.test(css));

if (failed) {
  console.log(`\nRESULT: FAIL (${failed})`);
  process.exit(1);
}
console.log('\nRESULT: PASS');
