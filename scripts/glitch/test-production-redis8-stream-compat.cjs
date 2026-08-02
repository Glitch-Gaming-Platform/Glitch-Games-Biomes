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

console.log("== Production Redis 8.8.1 stream compatibility ==");
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
  "world apply uses bounded XADD MAXLEN trimming"
);
ok(
  !applyLua.includes("'MINID'"),
  "world apply preserves entry-count retention instead of changing to MINID"
);
ok(redisWorld.includes('"MAXLEN"'), "ECS periodic trim uses MAXLEN");
ok(!redisWorld.includes('"MINID"'), "ECS periodic trim avoids MINID");
ok(firehose.includes('"MAXLEN"'), "direct Redis firehose publish uses MAXLEN");
ok(!firehose.includes('"MINID"'), "direct Redis firehose publish avoids MINID");
ok(
  firehose.includes("xautoclaimBuffer"),
  "firehose uses native XAUTOCLAIM recovery"
);
ok(firehose.includes("xpendingBuffer"), "firehose retains XPENDING recovery");
ok(firehose.includes("xclaimBuffer"), "firehose retains XCLAIM recovery");
ok(
  firehose.includes('unsupportedCommand(error, "xautoclaim")'),
  "firehose detects unsupported XAUTOCLAIM once"
);
ok(
  chatDistribution.includes("xautoclaimBuffer"),
  "chat distributor uses native XAUTOCLAIM recovery"
);
ok(
  chatDistribution.includes("xpendingBuffer"),
  "chat distributor retains XPENDING recovery"
);
ok(
  chatDistribution.includes("xclaimBuffer"),
  "chat distributor retains XCLAIM recovery"
);
ok(
  chatDistribution.includes('unsupportedCommand(error, "xautoclaim")'),
  "chat distributor detects unsupported XAUTOCLAIM once"
);
ok(
  chatDistribution.includes("getMissedDeliveriesWithXPending"),
  "chat distributor keeps bounded missed-delivery recovery"
);
ok(
  /tx[.]expire[(]\s*this[.]redisKey,\s*CONFIG[.]serviceDiscoveryServiceExpirySeconds,?\s*[)]/.test(
    redisDiscovery
  ),
  "service discovery refreshes its coarse key TTL"
);
ok(
  deploy.includes("redis:8.8.1-alpine"),
  "local production smoke matches production Redis 8.8.1"
);

if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
