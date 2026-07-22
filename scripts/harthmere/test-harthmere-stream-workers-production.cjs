#!/usr/bin/env node
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const REDIS_HOST =
  process.env.BIOMES_PROD_REDIS_HOST ||
  process.env.REDIS_HOST ||
  "20.127.78.175";
const REDIS_PORT =
  process.env.BIOMES_PROD_REDIS_PORT || process.env.REDIS_PORT || "6379";
const LIVE_REDIS = process.env.BIOMES_PROD_STREAM_REDIS_CHECK === "1";
const EXPECT_PROD_GROUPS = process.env.BIOMES_EXPECT_PROD_STREAM_GROUPS === "1";

const streams = [
  {
    name: "chat distributor",
    db: "4",
    stream: "chat-delivery",
    requiredGroups: ["redis-chat-distributor"],
  },
  {
    name: "firehose gameplay workers",
    db: "0",
    stream: "firehose",
    requiredGroups: ["trigger-server", "notifications-server"],
    optionalGroups: ["sink"],
  },
];

let failures = 0;
function ok(condition, message, detail) {
  if (condition) {
    console.log(`OK ${message}${detail ? ` :: ${detail}` : ""}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}${detail ? ` :: ${detail}` : ""}`);
  }
}

function note(message) {
  console.log(`NOTE ${message}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function redisCli(db, args, options = {}) {
  try {
    return childProcess.execFileSync(
      "redis-cli",
      ["-h", REDIS_HOST, "-p", REDIS_PORT, "-n", db, ...args],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", options.quiet ? "ignore" : "pipe"],
      }
    );
  } catch (error) {
    if (options.allowFailure) {
      return `${error.stdout ?? ""}${error.stderr ?? ""}`;
    }
    throw error;
  }
}

function redisGroupNames(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const names = new Set();
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (lines[i] === "name") {
      names.add(lines[i + 1]);
    }
  }
  return names;
}

function runStaticChecks() {
  const runner = read("scripts/glitch/run-glitch-local-game-stack.sh");
  const simulationHealth = read("scripts/glitch/simulation-health-server.cjs");
  const glitchConfig = read("deploy/glitch/biomes.config.yaml");
  const gaiaTerrainSync = read("src/server/gaia/terrain/sync.ts");
  const distributedShardManager = read(
    "src/server/shared/shard_manager/distributed.ts"
  );
  const deploy = fs.existsSync(
    path.join(root, "scripts/glitch/deploy-production-local-redis-smoke.sh")
  )
    ? read("scripts/glitch/deploy-production-local-redis-smoke.sh")
    : "";
  const chatCommon = read("src/server/shared/chat/redis/common.ts");
  const chatDistribution = read("src/server/shared/chat/redis/distribution.ts");
  const chatServer = read("src/server/chat/server.ts");
  const firehose = read("src/server/shared/firehose/redis.ts");
  const trigger = read("src/server/trigger/server.ts");
  const notify = read("src/server/notify/server.ts");
  const sink = read("src/server/sink/main.ts");

  ok(
    chatCommon.includes('Buffer.from("chat-delivery")'),
    "chat extended delivery stream remains chat-delivery"
  );
  ok(
    chatDistribution.includes("xgroup(") &&
      chatDistribution.includes("EXTENDED_DELIVERY_STREAM_KEY") &&
      chatDistribution.includes("redis-chat-distributor"),
    "chat distributor creates and uses the redis-chat-distributor consumer group"
  );
  ok(
    chatServer.includes("redisChatDistributor.runForever(signal)"),
    "chat server starts the Redis chat distributor loop"
  );
  ok(
    firehose.includes('Buffer.from("firehose")') &&
      firehose.includes("xgroup(") &&
      firehose.includes("xreadgroupBuffer"),
    "firehose uses a Redis stream with consumer groups"
  );
  ok(
    trigger.includes("return `trigger-server`;") &&
      trigger.includes("this.firehose.events("),
    "trigger server consumes firehose as trigger-server in production"
  );
  ok(
    notify.includes("return `notifications-server`;") &&
      notify.includes("this.firehose.events("),
    "notifications server consumes firehose as notifications-server in production"
  );
  ok(
    sink.includes("return `sink`;") && sink.includes("firehose.events("),
    "sink consumes firehose as sink when that worker is explicitly enabled"
  );

  ok(
    runner.includes("wait_http_ready 127.0.0.1 3301 chat"),
    "Glitch stack waits for chat service readiness on the real metrics port"
  );
  ok(
    runner.includes(
      "wait_redis_stream_group 4 chat-delivery redis-chat-distributor chat-distributor"
    ),
    "Glitch stack waits for chat-delivery consumer group before web traffic"
  );
  ok(
    !runner.includes("wait_tcp 127.0.0.1 3304 chat-rpc"),
    "Glitch stack no longer waits on a non-existent chat RPC port"
  );
  ok(
    runner.includes("GLITCH_DEFAULT_STREAM_WORKERS=1"),
    "Glitch unified/web roles enable gameplay stream workers by default"
  );
  ok(
    runner.includes("GLITCH_STACK_ROLE") &&
      runner.includes("GLITCH_DEFAULT_ANIMA=1") &&
      runner.includes("GLITCH_DEFAULT_ANIMA=0") &&
      runner.includes(
        "GLITCH_STACK_ROLE=web requires GLITCH_ENABLE_ANIMA=0 and GLITCH_ENABLE_GAIA=0"
      ),
    "Glitch roles keep Anima enabled for unified/simulation stacks and forbidden in public web replicas"
  );
  ok(
    runner.includes(
      'GLITCH_ANIMA_STARTUP_CANDIDATES="${GLITCH_ANIMA_STARTUP_CANDIDATES:-1}"'
    ) &&
      runner.includes("wait_anima_startup_barrier()") &&
      runner.includes('SET "$candidate_key" "$(date +%s)" EX "$ttl"') &&
      runner.includes('--scan --pattern "${candidate_prefix}*"') &&
      runner.includes("wait_anima_startup_barrier") &&
      runner.includes(
        'GLITCH_ANIMA_MAX_OLD_SPACE_MB="${GLITCH_ANIMA_MAX_OLD_SPACE_MB:-2048}"'
      ) &&
      runner.includes("--max-old-space-size=$GLITCH_ANIMA_MAX_OLD_SPACE_MB"),
    "Glitch stack supports a crash-safe Redis barrier and isolated heap cap before distributed Anima startup"
  );
  ok(
    runner.includes("GLITCH_DEFAULT_GAIA=1") &&
      runner.includes("GLITCH_DEFAULT_GAIA=0") &&
      runner.includes(
        "GLITCH_STACK_ROLE=simulation requires both Anima and Gaia"
      ),
    "Glitch roles keep Gaia enabled for unified/simulation stacks and require both dedicated workers"
  );
  ok(
    glitchConfig.includes("gaiaV2MissingShardsThreshold: 20_500") &&
      glitchConfig.includes("20,188 missing unique shard coordinates") &&
      glitchConfig.includes("farmingPlantsPerTick: 5") &&
      gaiaTerrainSync.includes("Builder measured ${holes}") &&
      gaiaTerrainSync.includes("configured maximum is"),
    "Glitch Gaia accepts the known sparse terrain shape and bounds farming update batches"
  );
  ok(
    glitchConfig.includes('- name: "anima"') &&
      glitchConfig.includes('strategy: "balanced"') &&
      distributedShardManager.includes(
        'if (this.config.strategy !== "balanced")'
      ),
    "distributed Anima uses balanced ownership without unsupported weight-report errors"
  );

  // These options are asserted together because an Anima process can exist yet
  // still be functionally inert: the wrong shard manager duplicates or owns no
  // NPCs, missing HFC writes drops behavior state, and a relative Galois prefix
  // makes Node fail while loading the terrain indices needed for navigation.
  ok(
    runner.includes(
      "DISCOVERY_KIND=redis SHARD_MANAGER_KIND=distributed ANIMA_HFC_WRITES=1"
    ) &&
      runner.includes(
        'galois_prefix="${GLITCH_PUBLIC_WEB_ORIGIN%/}/buckets/biomes-static/"'
      ) &&
      runner.includes(
        'start_bg anima 127.0.0.1 4100 4104 4101 "$APP_ROOT/dist/anima.js"'
      ) &&
      runner.includes("wait_http_ready 127.0.0.1 4101 anima"),
    "Glitch stack starts a Redis-coordinated Anima worker with hybrid-world writes and an absolute asset origin"
  );
  ok(
    runner.includes("DISCOVERY_KIND=redis SHARD_MANAGER_KIND=distributed") &&
      runner.includes("gaia_domain=gaia-harthmere-unified") &&
      runner.includes('WASM_MEMORY="$GLITCH_GAIA_WASM_MEMORY_MB"') &&
      runner.includes(
        'start_bg gaia 127.0.0.1 4200 4204 4201 "$APP_ROOT/dist/gaia.js"'
      ) &&
      runner.includes("wait_http_ready 127.0.0.1 4201 gaia"),
    "Glitch stack starts and readiness-checks Redis-coordinated Gaia simulations"
  );
  ok(
    runner.includes('GLITCH_STACK_ROLE" = "simulation"') &&
      runner.includes("simulation-health-server.cjs") &&
      runner.includes(
        'start_bg logic 127.0.0.1 3500 3504 3501 "$APP_ROOT/dist/logic.js"'
      ) &&
      runner.includes("wait_http_ready 127.0.0.1 3501 simulation-logic") &&
      runner.includes("GLITCH_SIMULATION_ROLE_READY anima=1 gaia=1") &&
      simulationHealth.includes(
        '{ name: "anima", host: "127.0.0.1", port: 4101 }'
      ) &&
      simulationHealth.includes(
        '{ name: "gaia", host: "127.0.0.1", port: 4201 }'
      ) &&
      simulationHealth.includes("ready ? 200 : 503"),
    "dedicated simulation role opens its target port early and reports ready only after Anima and Gaia"
  );
  ok(
    runner.includes(
      'start_bg trigger 127.0.0.1 3700 3704 3701 "$APP_ROOT/dist/trigger.js"'
    ),
    "Glitch stack starts the trigger firehose worker"
  );
  ok(
    runner.includes(
      'start_bg notify 127.0.0.1 3800 3804 3801 "$APP_ROOT/dist/notify.js"'
    ),
    "Glitch stack starts the notifications firehose worker"
  );
  ok(
    read("server.webpack.config.cjs").includes('"notify"') &&
      read("server.webpack.config.ts").includes('"notify"'),
    "server bundle config builds dist/notify.js for the notifications worker"
  );
  ok(
    read("server.webpack.config.cjs").includes('"anima"') &&
      read("server.webpack.config.ts").includes('"anima"') &&
      read("server.webpack.config.cjs").includes('["gaia"') &&
      read("server.webpack.config.ts").includes('["gaia"'),
    "server bundle config builds dist/anima.js and dist/gaia.js for native simulations"
  );
  ok(
    runner.includes(
      "wait_redis_stream_group 0 firehose trigger-server trigger-firehose"
    ),
    "Glitch stack waits for trigger-server firehose consumer group"
  );
  ok(
    runner.includes(
      "wait_redis_stream_group 0 firehose notifications-server notify-firehose"
    ),
    "Glitch stack waits for notifications-server firehose consumer group"
  );
  ok(
    runner.includes(
      'GLITCH_ENABLE_SINK_WORKER="${GLITCH_ENABLE_SINK_WORKER:-0}"'
    ) &&
      runner.includes("wait_redis_stream_group 0 firehose sink sink-firehose"),
    "Glitch stack leaves BigQuery sink opt-in while keeping a readiness guard"
  );

  if (deploy) {
    ok(
      deploy.includes("test-harthmere-stream-workers-production.cjs"),
      "production deploy guardrails include stream worker startup test"
    );
    ok(
      deploy.includes("GLITCH_ENABLE_STREAM_WORKERS=1") &&
        deploy.includes("GLITCH_ENABLE_SINK_WORKER=0") &&
        deploy.includes("GLITCH_STACK_ROLE=web") &&
        deploy.includes("GLITCH_ENABLE_ANIMA=0") &&
        deploy.includes("GLITCH_ENABLE_GAIA=0") &&
        deploy.includes("AZURE_SIMULATION_CONTAINER_APP") &&
        deploy.includes("GLITCH_STACK_ROLE=simulation") &&
        deploy.includes("GLITCH_ENABLE_ANIMA=1") &&
        deploy.includes("GLITCH_ANIMA_STARTUP_CANDIDATES=1") &&
        deploy.includes("GLITCH_ANIMA_MAX_OLD_SPACE_MB=2048") &&
        deploy.includes("GLITCH_ENABLE_GAIA=1") &&
        deploy.includes("GLITCH_GAIA_WASM_MEMORY_MB=4096") &&
        deploy.includes("GLITCH_STACK_HTTP_READY_WAIT_TRIES=900"),
      "production deploy keeps gameplay stream workers on web while isolating required Anima/Gaia workers in a dedicated app"
    );
  }
}

function runProductionRedisChecks() {
  note(`Production Redis stream check: ${REDIS_HOST}:${REDIS_PORT}`);
  for (const stream of streams) {
    const type = redisCli(stream.db, ["TYPE", stream.stream], {
      allowFailure: true,
    }).trim();
    ok(
      type === "stream",
      `${stream.name} Redis stream exists`,
      `db=${stream.db} type=${type || "<missing>"}`
    );
    const lengthRaw = redisCli(stream.db, ["XLEN", stream.stream], {
      allowFailure: true,
    }).trim();
    const length = Number(lengthRaw);
    ok(
      Number.isFinite(length),
      `${stream.name} stream length is readable`,
      `xlen=${lengthRaw || "<unreadable>"}`
    );
    const groups = redisGroupNames(
      redisCli(stream.db, ["XINFO", "GROUPS", stream.stream], {
        allowFailure: true,
      })
    );
    const groupList = Array.from(groups).join(",") || "<none>";
    for (const group of stream.requiredGroups) {
      if (EXPECT_PROD_GROUPS) {
        ok(
          groups.has(group),
          `${stream.name} has required production consumer group ${group}`,
          `groups=${groupList}`
        );
      } else {
        ok(
          true,
          `${stream.name} production consumer group status for ${group}`,
          `present=${groups.has(group)} groups=${groupList}`
        );
      }
    }
    for (const group of stream.optionalGroups ?? []) {
      ok(
        true,
        `${stream.name} optional consumer group status for ${group}`,
        `present=${groups.has(group)} groups=${groupList}`
      );
    }
  }
}

console.log("== Harthmere production stream workers current ==");
console.log(`Root: ${root}\n`);
runStaticChecks();
if (LIVE_REDIS || EXPECT_PROD_GROUPS) {
  runProductionRedisChecks();
} else {
  note(
    "live production Redis check skipped. Set BIOMES_PROD_STREAM_REDIS_CHECK=1 for read-only stream/group diagnostics."
  );
}

if (failures > 0) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
