const fs = require('fs');
const path = 'scripts/b/data_snapshot.py';
const s = fs.readFileSync(path, 'utf8');
function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exit(1);
  }
  console.log(`OK ${msg}`);
}
ok(s.includes('SNAPSHOT_RUNTIME_BRIDGE_REPAIR_V2'), 'runtime bridge repair v2 marker is present');
ok(s.includes('SNAPSHOT_RUNTIME_BRIDGE_V1'), 'old runtime bridge v1 marker remains for compatibility checks');
ok(s.includes('class RedisServer(object):'), 'RedisServer class exists');
const classIdx = s.indexOf('class RedisServer(object):');
const bridgeIdx = s.indexOf('SNAPSHOT_RUNTIME_BRIDGE_REPAIR_V2');
ok(classIdx >= 0 && bridgeIdx > classIdx, 'runtime bridge helper is after RedisServer class');
const redisBlock = s.slice(classIdx, bridgeIdx);
ok(redisBlock.includes('    def __enter__(self):'), 'RedisServer has __enter__ method');
ok(redisBlock.includes('    def __exit__(self, *args):'), 'RedisServer has __exit__ method');
ok(s.includes('GLITCH_BISCUIT_MODE') && s.includes('redis2'), 'snapshot run forces Redis-backed Bikkie mode');
ok(s.includes('GLITCH_WORLD_API_MODE') && s.includes('hfc-hybrid'), 'snapshot run forces Redis/HFC hybrid world API mode');
ok(s.includes('GLITCH_CHAT_API_MODE') && s.includes('redis'), 'snapshot run keeps chat on Redis');
ok(s.includes('GLITCH_FIREHOSE_MODE') && s.includes('redis'), 'snapshot run keeps firehose on Redis');
ok(s.includes('NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN'), 'extra-town flag is mirrored to browser bundle');
ok(s.includes('NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X'), 'extra-town X offset is mirrored to browser bundle');
ok(s.includes('_configure_snapshot_runtime_environment()'), 'runtime bridge call exists before b.run');
ok(s.indexOf('ctx.invoke(ensure_redis_populated)') < s.indexOf('_configure_snapshot_runtime_environment()'), 'runtime bridge is configured after Redis is populated');
console.log('snapshot runtime bridge repair v2 check passed');
