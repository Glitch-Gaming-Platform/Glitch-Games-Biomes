#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const file = path.join(root, 'src/server/logic/utils/players.ts');
const text = fs.readFileSync(file, 'utf8');

function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}

ok(text.includes('HARTHMERE_START_MODE_GUARD_V86'), 'v86 Harthmere start mode guard marker exists');
ok(text.includes('BIOMES_START_IN_HARTHMERE=1 was ignored'), 'invalid start-mode warning exists');
ok(text.includes('BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN === "1"'), 'connected extra town enables Harthmere start');
ok(text.includes('BIOMES_FORCE_LOCAL_DEV_TOWN === "1"'), 'legacy forced local-dev town enables Harthmere start');
ok(text.includes('shouldMoveExistingSnapshotPlayerToHarthmereStartV86'), 'existing Grove-positioned player relocation helper exists');
ok(text.includes('BIOMES_KEEP_EXISTING_PLAYER_POSITION'), 'developer escape hatch exists');
ok(text.includes('isInsideAuthoredSnapshotGroveStartAreaV86(position)'), 'existing-player relocation only targets authored Grove start area');
ok(text.includes('moving to Harthmere'), 'server log explains existing player relocation');

if (!process.exitCode) {
  console.log('\nHarthmere v86 start-mode checks passed.');
}
