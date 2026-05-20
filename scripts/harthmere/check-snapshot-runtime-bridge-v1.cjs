const fs=require('fs');
function ok(c,m){if(!c){console.error('FAIL '+m);process.exit(1)}console.log('OK '+m)}
const s=fs.readFileSync('scripts/b/data_snapshot.py','utf8');
ok(s.includes('SNAPSHOT_RUNTIME_BRIDGE_V1'),'runtime bridge marker is present');
ok(s.includes('GLITCH_BISCUIT_MODE')&&s.includes('redis2'),'snapshot run forces Redis-backed Bikkie mode');
ok(s.includes('GLITCH_WORLD_API_MODE')&&s.includes('hfc-hybrid'),'snapshot run forces Redis/HFC hybrid world API mode');
ok(s.includes('GLITCH_CHAT_API_MODE')&&s.includes('redis'),'snapshot run keeps chat on Redis');
ok(s.includes('GLITCH_FIREHOSE_MODE')&&s.includes('redis'),'snapshot run keeps firehose on Redis');
ok(s.includes('NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN'),'extra-town flag is mirrored to browser bundle');
ok(s.includes('NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X'),'extra-town X offset is mirrored to browser bundle');
ok(s.includes('_configure_snapshot_runtime_environment()'),'runtime bridge is called before b.run');
ok(s.indexOf('ctx.invoke(ensure_redis_populated)') < s.indexOf('_configure_snapshot_runtime_environment()'),'runtime bridge is configured after Redis is populated');
const classIdx=s.indexOf('class RedisServer(object):');
const bridgeIdx=s.indexOf('SNAPSHOT_RUNTIME_BRIDGE_V1');
const redisBlock=s.slice(classIdx, bridgeIdx);
ok(redisBlock.includes('def __enter__(self)'),'RedisServer context manager __enter__ is intact');
ok(redisBlock.includes('def __exit__(self, *args)'),'RedisServer context manager __exit__ is intact');
console.log('snapshot runtime bridge v1 check passed');
