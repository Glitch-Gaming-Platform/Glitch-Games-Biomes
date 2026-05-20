const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '..', '..');
const p = path.join(repo, 'README_GLITCH_SNAPSHOT_MERGE.md');
const s = fs.readFileSync(p, 'utf8');
function ok(cond, msg){ if(!cond){ console.error(`FAIL ${msg}`); process.exitCode=1; } else { console.log(`OK ${msg}`); } }
ok(s.includes('Glitch-Games-Biomes is the code/gameplay authority'), 'README states Glitch is code/gameplay authority');
ok(s.includes('check-snapshot-glitch-merge-all-v2.cjs'), 'README documents v2 regression command');
ok(s.includes('BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1'), 'README documents extra-town mode');
ok(s.includes('SNAPSHOT_NPC_COSMETICS_FALLBACK_V1'), 'README documents NPC cosmetics fallback marker');
ok(s.includes('dump-snapshot-pre-mission-integration-state-v1.cjs'), 'README documents pre-mission integration dump');
if (process.exitCode) process.exit(process.exitCode);
console.log('snapshot merge README v1 check passed');
