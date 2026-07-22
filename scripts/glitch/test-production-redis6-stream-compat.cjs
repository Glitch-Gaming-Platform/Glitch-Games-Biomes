#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

let failed = false;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
    return;
  }
  failed = true;
  console.error(`FAIL ${message}`);
}

const applyLua = read("src/server/shared/world/lua/scripts/apply.lua");
const applyTs = read("src/server/shared/world/lua/apply.ts");
const redisWorld = read("src/server/shared/world/redis.ts");
const firehose = read("src/server/shared/firehose/redis.ts");
const chatDistribution = read("src/server/shared/chat/redis/distribution.ts");
const redisDiscovery = read("src/server/shared/discovery/redis.ts");
const config = read("src/server/shared/config.ts");
const deploy = read("scripts/glitch/deploy-production-local-redis-smoke.sh");

console.log("== Production Redis 6 stream compatibility ==");
ok(
  config.includes("redisMaxEcsStreamEntries"),
  "config bounds ECS stream by entry count"
);
ok(
  config.includes("redisMaxFirehoseStreamEntries"),
  "config bounds firehose stream by entry count"
);
ok(
  applyTs.includes("firehoseMaxEntries: CONFIG.redisMaxFirehoseStreamEntries"),
  "world apply passes firehose MAXLEN bound into Lua"
);
ok(
  applyLua.includes("'XADD', 'firehose'"),
  "world apply appends firehose events"
);
ok(
  applyLua.includes("'MAXLEN', '~', request.firehoseMaxEntries"),
  "world apply uses Redis 6-compatible XADD MAXLEN trimming"
);
ok(
  !applyLua.includes("'MINID'"),
  "world apply Lua avoids Redis 6-incompatible MINID"
);
ok(redisWorld.includes('"MAXLEN"'), "ECS periodic trim uses MAXLEN");
ok(!redisWorld.includes('"MINID"'), "ECS periodic trim avoids MINID");
ok(firehose.includes('"MAXLEN"'), "direct Redis firehose publish uses MAXLEN");
ok(!firehose.includes('"MINID"'), "direct Redis firehose publish avoids MINID");
ok(
  firehose.includes("xautoclaimBuffer"),
  "firehose keeps Redis 7+ XAUTOCLAIM fast path"
);
ok(
  firehose.includes("xpendingBuffer"),
  "firehose has Redis 6 XPENDING fallback"
);
ok(firehose.includes("xclaimBuffer"), "firehose has Redis 6 XCLAIM fallback");
ok(
  firehose.includes('unsupportedCommand(error, "xautoclaim")'),
  "firehose detects unsupported XAUTOCLAIM once"
);
ok(
  chatDistribution.includes("xautoclaimBuffer"),
  "chat distributor keeps Redis 7+ XAUTOCLAIM fast path"
);
ok(
  chatDistribution.includes("xpendingBuffer"),
  "chat distributor has Redis 6 XPENDING fallback"
);
ok(
  chatDistribution.includes("xclaimBuffer"),
  "chat distributor has Redis 6 XCLAIM fallback"
);
ok(
  chatDistribution.includes('unsupportedCommand(error, "xautoclaim")'),
  "chat distributor detects unsupported XAUTOCLAIM once"
);
ok(
  chatDistribution.includes("getMissedDeliveriesWithXPending"),
  "chat distributor routes missed-delivery recovery through the Redis 6 fallback"
);

// Keep this source-level deployment guard even though RedisServiceDiscovery has
// unit coverage. The ordinary test harness intentionally runs a Redis 7 server,
// where `EXPIRE ... GT` is valid; only the production Redis 6 image exposes the
// transaction-aborting incompatibility. Matching the complete two-argument call
// prevents a future formatting-only change from weakening the check, while the
// separate negative assertion makes the operational constraint unmistakable.
ok(
  /tx[.]expire[(]\s*this[.]redisKey,\s*CONFIG[.]serviceDiscoveryServiceExpirySeconds,?\s*[)]/.test(
    redisDiscovery
  ),
  "service discovery refreshes its coarse key TTL with Redis 6-compatible EXPIRE"
);
ok(
  !/tx[.]expire[(][\s\S]{0,160}["']GT["']/.test(redisDiscovery),
  "service discovery avoids Redis 7 conditional EXPIRE flags that abort MULTI on Redis 6"
);
ok(
  deploy.includes("redis:6.0.16-alpine"),
  "local production smoke matches production Redis 6.0"
);

if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
