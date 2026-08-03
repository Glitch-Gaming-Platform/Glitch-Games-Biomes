#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const helperPath = path.join(
  root,
  "scripts/glitch/refresh-warm-local-stack.cjs"
);
const jumpPath = path.join(root, "scripts/harthmere/e2e-jump.cjs");
const testingDocsPath = path.join(root, "docs/harthmere/TESTING_FASTER.md");
const helperSource = fs.readFileSync(helperPath, "utf8");
const jumpSource = fs.readFileSync(jumpPath, "utf8");
const testingDocs = fs.readFileSync(testingDocsPath, "utf8");
const {
  ARTIFACT_MOUNTS,
  CANONICAL_SEED_KEYS,
  parseArgs,
  publishedPortArgument,
  replacementCreateArgs,
  replacementEnvironment,
} = require(helperPath);

let failed = false;
function ok(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    failed = true;
    console.error(`FAIL ${message}`);
  }
}

const defaults = parseArgs([]);
ok(
  defaults.app === "biomes-prod-smoke-app" &&
    defaults.redis === "biomes-prod-smoke-redis" &&
    defaults.build === "none",
  "warm refresh defaults to the retained local smoke app/Redis without rebuilding"
);

const parsed = parseArgs([
  "--app",
  "warm-app",
  "--redis",
  "warm-redis",
  "--build",
  "all",
  "--build-id",
  "warm-contract",
  "--keep-previous",
]);
ok(
  parsed.app === "warm-app" &&
    parsed.redis === "warm-redis" &&
    parsed.build === "all" &&
    parsed.buildId === "warm-contract" &&
    parsed.keepPrevious,
  "warm refresh accepts explicit app, Redis, build, and rollback-retention options"
);

assert.throws(() => parseArgs(["--build", "docker"]), /--build must be one of/);
ok(true, "warm refresh rejects unsupported build modes");

const environment = replacementEnvironment(
  [
    "GLITCH_TITLE_ID=test-title",
    "GLITCH_REDIS_MODE=memory",
    "REDIS_HOST=old-redis",
    "GLITCH_REDIS_HOST=old-redis",
    "LOCAL_REDIS_HOST=old-redis",
    "REDIS_PORT=6379",
    "GLITCH_REDIS_PORT=6379",
    "GLITCH_POPULATE_SNAPSHOT_REDIS=1",
    "GLITCH_SNAPSHOT_BOOTSTRAP_ROLE=1",
    "GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=1",
    "GLITCH_REQUIRE_SNAPSHOT_REDIS=0",
    "HARTHMERE_NATIVE_ECS_E2E=1",
    "HARTHMERE_E2E_CONTROL_TOKEN=secret-not-printed",
    "CUSTOM_VALUE=preserved",
  ],
  "warm-redis",
  "warm-contract"
);
ok(
  environment.get("BUILD_ID") === "warm-contract" &&
    environment.get("GLITCH_REDIS_MODE") === "external" &&
    environment.get("REDIS_HOST") === "warm-redis" &&
    environment.get("GLITCH_REDIS_HOST") === "warm-redis" &&
    environment.get("LOCAL_REDIS_HOST") === "warm-redis" &&
    environment.get("GLITCH_POPULATE_SNAPSHOT_REDIS") === "0" &&
    environment.get("GLITCH_SNAPSHOT_BOOTSTRAP_ROLE") === "0" &&
    environment.get("GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH") === "0" &&
    environment.get("GLITCH_REQUIRE_SNAPSHOT_REDIS") === "1" &&
    environment.get("CUSTOM_VALUE") === "preserved",
  "replacement app preserves ordinary environment, adopts the mounted artifact build id, and forces external Redis no-flush/no-bootstrap mode"
);

assert.throws(
  () =>
    replacementEnvironment(
      ["HARTHMERE_NATIVE_ECS_E2E=1", "HARTHMERE_E2E_CONTROL_TOKEN="],
      "warm-redis"
    ),
  /has no control token/
);
ok(
  true,
  "native E2E replacement refuses to lose its browser authorization token"
);

const source = {
  Image: "sha256:immutable-base-image",
  Config: {
    Entrypoint: null,
    Cmd: ["./scripts/glitch/run-glitch-local-game-stack.sh"],
    StopTimeout: 90,
    Healthcheck: {
      Test: ["CMD-SHELL", "node scripts/glitch/healthcheck-glitch-web.cjs"],
      Interval: 30_000_000_000,
      Timeout: 10_000_000_000,
      StartPeriod: 300_000_000_000,
      Retries: 3,
    },
  },
  HostConfig: {
    RestartPolicy: { Name: "unless-stopped" },
    Memory: 0,
    MemorySwap: 0,
    NanoCpus: 0,
    ShmSize: 64 * 1024 * 1024,
    ReadonlyRootfs: false,
    ExtraHosts: [],
    PortBindings: {
      "3000/tcp": [{ HostIp: "127.0.0.1", HostPort: "3017" }],
      "4900/tcp": [{ HostIp: "127.0.0.1", HostPort: "4907" }],
    },
  },
  NetworkSettings: { Networks: { "warm-net": {} } },
  Mounts: [
    {
      Type: "bind",
      Source: "/tmp/old-next",
      Destination: "/app/.next",
      RW: false,
      Propagation: "rprivate",
    },
    {
      Type: "volume",
      Name: "unrelated-cache",
      Source: "/var/lib/docker/volumes/unrelated-cache/_data",
      Destination: "/cache",
      RW: true,
    },
  ],
};
const image = {
  Config: {
    Entrypoint: null,
    Cmd: ["./scripts/glitch/run-glitch-local-game-stack.sh"],
  },
};
const create = replacementCreateArgs({
  source,
  image,
  appName: "warm-app",
  redisName: "warm-redis",
  temporaryName: "warm-app.next",
  envFile: "/tmp/warm.env",
  root: "/workspace",
});
const createText = create.args.join(" ");
ok(
  create.network === "warm-net" &&
    createText.includes("--network warm-net") &&
    createText.includes("--network-alias warm-app") &&
    createText.includes("127.0.0.1:3017:3000") &&
    createText.includes("127.0.0.1:4907:4900") &&
    create.args.at(-1) === source.Image,
  "replacement is created first on the same network, ports, and immutable image"
);
ok(
  ARTIFACT_MOUNTS.every(([relative, target]) =>
    createText.includes(
      `type=bind,source=/workspace/${relative},target=${target},readonly`
    )
  ) && !createText.includes("source=/tmp/old-next,target=/app/.next"),
  "replacement discards stale artifact mounts and binds current .next/dist/public read-only"
);
ok(
  createText.includes("type=volume,source=unrelated-cache,target=/cache"),
  "replacement preserves unrelated source-container mounts"
);
ok(
  publishedPortArgument("4900/tcp", {
    HostIp: "0.0.0.0",
    HostPort: "4997",
  }) === "4997:4900",
  "published-port cloning handles wildcard TCP bindings"
);

ok(
  CANONICAL_SEED_KEYS.length === 3 &&
    helperSource.includes("snapshot_backup.json") &&
    helperSource.includes("RestartCount") &&
    helperSource.includes("OOMKilled") &&
    helperSource.includes('redisValue(redisName, ["PING"]) !== "PONG"'),
  "warm refresh validates Redis identity, lifecycle, snapshot hash, size, and canonical seeds"
);
ok(
  helperSource.includes("Retained Redis changed while preparing") &&
    helperSource.includes(
      "Redis container identity changed during the app refresh"
    ) &&
    !helperSource.includes('["stop", options.redis]') &&
    !helperSource.includes('["restart", options.redis]') &&
    !helperSource.includes('["rm", "-f", options.redis]'),
  "warm refresh never stops, restarts, or removes the retained Redis container"
);
ok(
  helperSource.indexOf("docker(create.args)") <
    helperSource.indexOf(
      '["stop", "--time", String(stopTimeout), options.app]'
    ) && helperSource.includes("restoring the previous app container"),
  "replacement is created and verified before the old app stops, with rollback on readiness failure"
);
ok(
  jumpSource.includes("HARTHMERE_E2E_REDIS_CONTAINER") &&
    jumpSource.includes("redisContainerReady") &&
    jumpSource.includes('"redis-cli", "--raw", "PING"'),
  "e2e-jump readiness supports an unexposed retained Docker Redis"
);
ok(
  testingDocs.includes("Supported warm-Redis application refresh") &&
    testingDocs.includes(
      "scripts/glitch/refresh-warm-local-stack.cjs --build all"
    ) &&
    testingDocs.includes("do **not** run `--local-smoke` again") &&
    testingDocs.includes("GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH=0"),
  "testing docs name the supported one-Redis inner loop and its no-flush contract"
);

if (failed) process.exitCode = 1;
