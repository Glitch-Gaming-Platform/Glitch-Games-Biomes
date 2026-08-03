#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";

// Refresh a production-shaped local browser app without replacing or reseeding
// its external Redis world. The existing app container is the configuration
// source; the replacement uses the same immutable base image, network, ports,
// health check, and environment with all snapshot population/flush privileges
// forced off. Current .next, dist, and public trees are mounted read-only.

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const DEFAULT_APP = "biomes-prod-smoke-app";
const DEFAULT_REDIS = "biomes-prod-smoke-redis";
const CANONICAL_SEED_KEYS = [
  "b:8810000000019301",
  "b:8810000000019401",
  "b:8810000000019451",
];
const ARTIFACT_MOUNTS = [
  [".next", "/app/.next"],
  ["dist", "/app/dist"],
  ["public", "/app/public"],
];

function usage() {
  return `Usage: scripts/glitch/refresh-warm-local-stack.cjs [options]

Recreate only a retained production-shaped app container while preserving its
already-populated external Redis container.

Options:
  --app NAME                 Existing app container (${DEFAULT_APP})
  --redis NAME               Retained Redis container (${DEFAULT_REDIS})
  --build MODE               none, next, server, or all (default: none)
  --build-id ID              Shared Next/server build id for --build
  --ready-timeout-seconds N  Complete lifecycle timeout (default: 900)
  --min-dbsize N             Minimum retained-world Redis size (default: 1000)
  --keep-previous            Keep the stopped previous app after a green swap
  --dry-run                  Validate and print the plan without changing state
  -h, --help                 Show this help

The helper never removes, restarts, flushes, or populates Redis. If the current
build replaced the .next directory inode, this command recreates the app so the
new read-only bind mount follows the completed artifact tree.`;
}

function parseArgs(argv) {
  const options = {
    app: DEFAULT_APP,
    redis: DEFAULT_REDIS,
    build: "none",
    buildId: undefined,
    readyTimeoutSeconds: 900,
    minDbsize: 1000,
    keepPrevious: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--app":
        options.app = argv[++i];
        break;
      case "--redis":
        options.redis = argv[++i];
        break;
      case "--build":
        options.build = argv[++i];
        break;
      case "--build-id":
        options.buildId = argv[++i];
        break;
      case "--ready-timeout-seconds":
        options.readyTimeoutSeconds = Number(argv[++i]);
        break;
      case "--min-dbsize":
        options.minDbsize = Number(argv[++i]);
        break;
      case "--keep-previous":
        options.keepPrevious = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.app || !options.redis) {
    throw new Error("--app and --redis require non-empty container names");
  }
  if (!new Set(["none", "next", "server", "all"]).has(options.build)) {
    throw new Error("--build must be one of: none, next, server, all");
  }
  if (
    !Number.isFinite(options.readyTimeoutSeconds) ||
    options.readyTimeoutSeconds < 30
  ) {
    throw new Error("--ready-timeout-seconds must be at least 30");
  }
  if (!Number.isInteger(options.minDbsize) || options.minDbsize < 1) {
    throw new Error("--min-dbsize must be a positive integer");
  }
  return options;
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: options.cwd || ROOT,
    encoding: "utf8",
    env: options.env || process.env,
    timeout: options.timeout,
    maxBuffer: options.maxBuffer || 16 * 1024 * 1024,
    stdio: options.stdio || "pipe",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    const detail = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(
      `${commandName} ${args.join(" ")} failed with exit ${result.status}${
        detail ? `:\n${detail}` : ""
      }`
    );
  }
  return result;
}

function docker(args, options = {}) {
  return command("docker", args, options);
}

function inspectContainer(name) {
  const parsed = JSON.parse(docker(["inspect", name]).stdout);
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error(`Expected exactly one Docker container named ${name}`);
  }
  return parsed[0];
}

function inspectImage(id) {
  const parsed = JSON.parse(docker(["image", "inspect", id]).stdout);
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error(`Expected exactly one Docker image ${id}`);
  }
  return parsed[0];
}

function envMap(values = []) {
  const map = new Map();
  for (const value of values) {
    const separator = value.indexOf("=");
    if (separator === -1) {
      map.set(value, "");
    } else {
      map.set(value.slice(0, separator), value.slice(separator + 1));
    }
  }
  return map;
}

function replacementEnvironment(sourceValues, redisName, buildId) {
  const map = envMap(sourceValues);
  const redisPort =
    map.get("GLITCH_REDIS_PORT") || map.get("REDIS_PORT") || "6379";
  const forced = {
    ...(buildId ? { BUILD_ID: buildId } : {}),
    GLITCH_REDIS_MODE: "external",
    REDIS_HOST: redisName,
    GLITCH_REDIS_HOST: redisName,
    LOCAL_REDIS_HOST: redisName,
    REDIS_PORT: redisPort,
    GLITCH_REDIS_PORT: redisPort,
    GLITCH_POPULATE_SNAPSHOT_REDIS: "0",
    GLITCH_SNAPSHOT_BOOTSTRAP_ROLE: "0",
    GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH: "0",
    GLITCH_REQUIRE_SNAPSHOT_REDIS: "1",
  };
  for (const [key, value] of Object.entries(forced)) {
    map.set(key, value);
  }
  if (
    map.get("HARTHMERE_NATIVE_ECS_E2E") === "1" &&
    !map.get("HARTHMERE_E2E_CONTROL_TOKEN")
  ) {
    throw new Error(
      "The source app enables HARTHMERE_NATIVE_ECS_E2E but has no control token"
    );
  }
  return map;
}

function writeEnvFile(map) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "biomes-warm-env-"));
  const filename = path.join(directory, "app.env");
  const rows = [];
  for (const [key, value] of map) {
    if (/\r|\n/.test(value)) {
      throw new Error(
        `Cannot safely copy multiline Docker environment value: ${key}`
      );
    }
    rows.push(`${key}=${value}`);
  }
  fs.writeFileSync(filename, `${rows.join("\n")}\n`, { mode: 0o600 });
  return { directory, filename };
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function mountArgument(mount) {
  if (mount.Type === "bind") {
    const fields = [
      "type=bind",
      `source=${mount.Source}`,
      `target=${mount.Destination}`,
    ];
    if (!mount.RW) fields.push("readonly");
    if (mount.Propagation && mount.Propagation !== "rprivate") {
      fields.push(`bind-propagation=${mount.Propagation}`);
    }
    return ["--mount", fields.join(",")];
  }
  if (mount.Type === "volume") {
    const fields = [
      "type=volume",
      `source=${mount.Name || mount.Source}`,
      `target=${mount.Destination}`,
    ];
    if (!mount.RW) fields.push("readonly");
    return ["--mount", fields.join(",")];
  }
  if (mount.Type === "tmpfs") {
    return ["--tmpfs", mount.Destination];
  }
  throw new Error(`Unsupported source app mount type: ${mount.Type}`);
}

function publishedPortArgument(containerPort, binding) {
  const hostIp =
    binding.HostIp && !["0.0.0.0", "::"].includes(binding.HostIp)
      ? `${binding.HostIp}:`
      : "";
  const protocol = containerPort.endsWith("/udp") ? "/udp" : "";
  const bareContainerPort = containerPort.replace(/\/(tcp|udp)$/, "");
  return `${hostIp}${binding.HostPort}:${bareContainerPort}${protocol}`;
}

function replacementCreateArgs({
  source,
  image,
  appName,
  redisName,
  temporaryName,
  envFile,
  root = ROOT,
}) {
  if (!sameJson(source.Config.Entrypoint, image.Config.Entrypoint)) {
    throw new Error(
      "The source app overrides the image entrypoint; warm refresh refuses to guess it"
    );
  }
  if (!sameJson(source.Config.Cmd, image.Config.Cmd)) {
    throw new Error(
      "The source app overrides the image command; warm refresh refuses to guess it"
    );
  }
  const networks = Object.keys(source.NetworkSettings.Networks || {});
  if (networks.length !== 1) {
    throw new Error(
      `Warm refresh requires exactly one app Docker network; found ${networks.length}`
    );
  }
  const network = networks[0];
  const args = [
    "create",
    "--name",
    temporaryName,
    "--label",
    "com.biomes.warm-stack=true",
    "--label",
    `com.biomes.warm-stack.redis=${redisName}`,
    "--network",
    network,
    "--network-alias",
    appName,
    "--env-file",
    envFile,
  ];

  const restartName = source.HostConfig.RestartPolicy?.Name || "no";
  args.push("--restart", restartName);
  if (source.Config.StopTimeout) {
    args.push("--stop-timeout", String(source.Config.StopTimeout));
  }
  if (source.HostConfig.Memory > 0) {
    args.push("--memory", String(source.HostConfig.Memory));
  }
  if (source.HostConfig.MemorySwap > 0) {
    args.push("--memory-swap", String(source.HostConfig.MemorySwap));
  }
  if (source.HostConfig.NanoCpus > 0) {
    args.push("--cpus", String(source.HostConfig.NanoCpus / 1_000_000_000));
  }
  if (source.HostConfig.ShmSize > 0) {
    args.push("--shm-size", String(source.HostConfig.ShmSize));
  }
  if (source.HostConfig.ReadonlyRootfs) {
    args.push("--read-only");
  }
  for (const host of source.HostConfig.ExtraHosts || []) {
    args.push("--add-host", host);
  }

  const health = source.Config.Healthcheck;
  if (health?.Test?.[0] === "NONE") {
    args.push("--no-healthcheck");
  } else if (health?.Test?.[0] === "CMD-SHELL") {
    args.push("--health-cmd", health.Test.slice(1).join(" "));
    if (health.Interval) args.push("--health-interval", `${health.Interval}ns`);
    if (health.Timeout) args.push("--health-timeout", `${health.Timeout}ns`);
    if (health.StartPeriod)
      args.push("--health-start-period", `${health.StartPeriod}ns`);
    if (health.Retries) args.push("--health-retries", String(health.Retries));
  } else if (health?.Test?.length) {
    throw new Error(
      "Warm refresh supports Docker CMD-SHELL health checks only"
    );
  }

  for (const [containerPort, bindings] of Object.entries(
    source.HostConfig.PortBindings || {}
  )) {
    for (const binding of bindings || []) {
      if (!binding.HostPort) {
        throw new Error(
          `Source app has an unassigned published port: ${containerPort}`
        );
      }
      args.push("--publish", publishedPortArgument(containerPort, binding));
    }
  }

  const replacedDestinations = new Set(
    ARTIFACT_MOUNTS.map(([, target]) => target)
  );
  for (const mount of source.Mounts || []) {
    if (replacedDestinations.has(mount.Destination)) continue;
    args.push(...mountArgument(mount));
  }
  for (const [relativeSource, target] of ARTIFACT_MOUNTS) {
    args.push(
      "--mount",
      `type=bind,source=${path.join(root, relativeSource)},target=${target},readonly`
    );
  }
  args.push(source.Image);
  return { args, network };
}

function dockerExec(containerName, executable, args = [], options = {}) {
  return docker(["exec", containerName, executable, ...args], options);
}

function redisValue(containerName, args) {
  return dockerExec(containerName, "redis-cli", [
    "--raw",
    ...args,
  ]).stdout.trim();
}

function hashFile(filename) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filename);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function verifyRedisWorld(
  redisName,
  titleId,
  minDbsize,
  expectedSnapshotHash
) {
  const redis = inspectContainer(redisName);
  if (!redis.State.Running) {
    throw new Error(`Retained Redis ${redisName} is not running`);
  }
  if (redis.RestartCount !== 0) {
    throw new Error(
      `Retained Redis ${redisName} has RestartCount=${redis.RestartCount}`
    );
  }
  if (redis.State.OOMKilled) {
    throw new Error(`Retained Redis ${redisName} was OOM-killed`);
  }
  if (redisValue(redisName, ["PING"]) !== "PONG") {
    throw new Error(`Retained Redis ${redisName} did not return literal PONG`);
  }
  const dbsize = Number(redisValue(redisName, ["DBSIZE"]));
  if (!Number.isInteger(dbsize) || dbsize < minDbsize) {
    throw new Error(
      `Retained Redis ${redisName} has implausible DBSIZE=${dbsize}; expected >=${minDbsize}`
    );
  }
  const requiredCount = Number(
    redisValue(redisName, ["EXISTS", ...CANONICAL_SEED_KEYS])
  );
  if (requiredCount !== CANONICAL_SEED_KEYS.length) {
    throw new Error(
      `Retained Redis ${redisName} has ${requiredCount}/${CANONICAL_SEED_KEYS.length} canonical seed keys`
    );
  }
  const snapshotPath = path.join(ROOT, "snapshot_backup.json");
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(
      "snapshot_backup.json is required to validate the retained world hash"
    );
  }
  const expectedHash = expectedSnapshotHash || (await hashFile(snapshotPath));
  const scopedHash = redisValue(redisName, [
    "GET",
    `biomes:${titleId}:snapshot_hash`,
  ]);
  const actualHash =
    scopedHash || redisValue(redisName, ["GET", "biomes_data_snapshot_hash"]);
  if (actualHash !== expectedHash) {
    throw new Error(
      `Retained Redis ${redisName} snapshot hash mismatch (actual=${actualHash || "missing"}, expected=${expectedHash})`
    );
  }
  return {
    id: redis.Id,
    dbsize,
    expectedSnapshotHash: expectedHash,
    snapshotHash: actualHash,
    requiredCount,
  };
}

function findBuildOwners() {
  const result = command("ps", ["-axo", "pid=,command="], {
    allowFailure: true,
  });
  if (result.status !== 0) return [];
  const pattern =
    /(?:scripts\/glitch\/deploy-production-local-redis-smoke[.]sh|(?:^|\s)(?:[.]\/)?b\s+build\s+(?:next|server)|node_modules\/(?:[.]bin\/)?next\s+build|next\/dist\/bin\/next\s+build|server[.]webpack[.]config[.]cjs|webpack[^\n]*server)/i;
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) => !line.startsWith(`${process.pid} `) && pattern.test(line)
    );
}

function requireNoBuildOwners() {
  const owners = findBuildOwners();
  if (owners.length) {
    throw new Error(
      `Build outputs are currently owned by another compiler:\n${owners.join("\n")}`
    );
  }
}

function pinnedBuildEnvironment(buildId) {
  const requiredVersion = fs
    .readFileSync(path.join(ROOT, ".nvmrc"), "utf8")
    .trim();
  const candidates = [
    path.dirname(process.execPath),
    path.join(os.homedir(), ".nvm/versions/node", `v${requiredVersion}`, "bin"),
    "/opt/homebrew/opt/node@24/bin",
    "/usr/local/opt/node@24/bin",
    path.join(
      os.homedir(),
      ".fnm/node-versions",
      `v${requiredVersion}`,
      "installation/bin"
    ),
    path.join(os.homedir(), ".volta/bin"),
  ];
  const pinnedBin = candidates.find((candidate) => {
    const node = path.join(candidate, "node");
    if (!fs.existsSync(node)) return false;
    const version = command(node, ["-p", "process.versions.node"], {
      allowFailure: true,
    });
    return version.status === 0 && version.stdout.trim() === requiredVersion;
  });
  if (!pinnedBin) {
    throw new Error(
      `Pinned Node ${requiredVersion} from .nvmrc is not available in the supported local runtimes`
    );
  }
  return {
    ...process.env,
    PATH: `${pinnedBin}:${process.env.PATH || ""}`,
    BIOMES_BUILD_ID: buildId,
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

function runBuild(mode, buildId) {
  if (mode === "none") return;
  requireNoBuildOwners();
  const env = pinnedBuildEnvironment(buildId);
  const targets = mode === "all" ? ["next", "server"] : [mode];
  for (const target of targets) {
    console.log(`Building ${target} with BIOMES_BUILD_ID=${buildId}`);
    const result = command("./b", ["build", target], {
      env,
      stdio: "inherit",
      allowFailure: true,
    });
    if (result.status !== 0) {
      const owners = findBuildOwners();
      throw new Error(
        `Build ${target} failed with exit ${result.status}${
          owners.length
            ? ` while compiler processes remain active:\n${owners.join("\n")}`
            : ""
        }`
      );
    }
    requireNoBuildOwners();
  }
}

function artifactFingerprint() {
  const required = [
    ".next/BUILD_ID",
    ".next/server",
    ".next/static",
    "dist/web.js",
    "public",
  ];
  const fingerprint = {};
  for (const relativePath of required) {
    const absolutePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `Required warm-stack artifact is missing: ${relativePath}`
      );
    }
    const stat = fs.statSync(absolutePath);
    fingerprint[relativePath] = {
      ino: stat.ino,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      directory: stat.isDirectory(),
    };
  }
  fingerprint.buildId = fs
    .readFileSync(path.join(ROOT, ".next/BUILD_ID"), "utf8")
    .trim();
  if (!fingerprint.buildId) {
    throw new Error(".next/BUILD_ID is empty");
  }
  return fingerprint;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requireStableArtifacts() {
  requireNoBuildOwners();
  const first = artifactFingerprint();
  await sleep(1000);
  requireNoBuildOwners();
  const second = artifactFingerprint();
  if (!sameJson(first, second)) {
    throw new Error(
      "Build artifacts changed during the warm-refresh stability check"
    );
  }
  return second;
}

function inferPublishedPort(source, containerPort) {
  const bindings = source.HostConfig.PortBindings?.[`${containerPort}/tcp`];
  if (!bindings?.length || !bindings[0].HostPort) {
    throw new Error(`Source app does not publish TCP port ${containerPort}`);
  }
  return Number(bindings[0].HostPort);
}

function verifyReplacementContainer(name, redisName, root = ROOT) {
  const replacement = inspectContainer(name);
  const env = envMap(replacement.Config.Env);
  const requiredEnv = {
    GLITCH_REDIS_MODE: "external",
    REDIS_HOST: redisName,
    GLITCH_REDIS_HOST: redisName,
    LOCAL_REDIS_HOST: redisName,
    GLITCH_POPULATE_SNAPSHOT_REDIS: "0",
    GLITCH_SNAPSHOT_BOOTSTRAP_ROLE: "0",
    GLITCH_ALLOW_SNAPSHOT_REDIS_FLUSH: "0",
    GLITCH_REQUIRE_SNAPSHOT_REDIS: "1",
  };
  for (const [key, expected] of Object.entries(requiredEnv)) {
    if (env.get(key) !== expected) {
      throw new Error(
        `Replacement app has ${key}=${env.get(key)}; expected ${expected}`
      );
    }
  }
  const mounts = new Map(
    replacement.Mounts.map((mount) => [mount.Destination, mount])
  );
  for (const [relativeSource, target] of ARTIFACT_MOUNTS) {
    const mount = mounts.get(target);
    const expectedSource = path.join(root, relativeSource);
    if (
      !mount ||
      mount.Type !== "bind" ||
      mount.Source !== expectedSource ||
      mount.RW
    ) {
      throw new Error(
        `Replacement app must mount ${expectedSource} read-only at ${target}`
      );
    }
  }
  return replacement;
}

async function waitForReady(appName, redisName, source, timeoutSeconds) {
  const webPort = inferPublishedPort(source, 3000);
  const syncPort = inferPublishedPort(source, 4900);
  const env = {
    ...process.env,
    HARTHMERE_E2E_URL: `http://127.0.0.1:${webPort}`,
    HARTHMERE_E2E_SYNC_BASE_URL: `http://127.0.0.1:${syncPort}`,
    HARTHMERE_E2E_STACK_CONTAINER: appName,
    HARTHMERE_E2E_REDIS_CONTAINER: redisName,
  };
  const deadline = Date.now() + timeoutSeconds * 1000;
  let lastOutput = "";
  while (Date.now() < deadline) {
    const current = inspectContainer(appName);
    if (!current.State.Running) {
      throw new Error(`Replacement app ${appName} exited before readiness`);
    }
    if (current.State.OOMKilled || current.RestartCount !== 0) {
      throw new Error(
        `Replacement app became invalid during readiness (RestartCount=${current.RestartCount}, OOMKilled=${current.State.OOMKilled})`
      );
    }
    const result = command(
      process.execPath,
      [path.join(ROOT, "scripts/harthmere/e2e-jump.cjs"), "ready"],
      { env, allowFailure: true, timeout: 30_000 }
    );
    lastOutput = `${result.stdout || ""}${result.stderr || ""}`.trim();
    if (result.status === 0) {
      console.log(lastOutput);
      return { webPort, syncPort };
    }
    await sleep(5000);
  }
  const logs = docker(["logs", "--tail", "240", appName], {
    allowFailure: true,
  });
  throw new Error(
    `Timed out waiting for ${appName} readiness.\n${lastOutput}\n${logs.stdout}${logs.stderr}`
  );
}

async function refresh(options) {
  process.chdir(ROOT);
  if (options.help) {
    console.log(usage());
    return;
  }
  if (options.app === options.redis) {
    throw new Error("--app and --redis must name different containers");
  }

  const source = inspectContainer(options.app);
  if (!source.State.Running) {
    throw new Error(`Source app ${options.app} must be running before refresh`);
  }
  if (source.State.OOMKilled || source.RestartCount !== 0) {
    throw new Error(
      `Source app is not valid warm-stack evidence (RestartCount=${source.RestartCount}, OOMKilled=${source.State.OOMKilled})`
    );
  }
  const image = inspectImage(source.Image);
  const sourceEnv = envMap(source.Config.Env);
  const titleId =
    sourceEnv.get("GLITCH_TITLE_ID") || "42de534c-600f-4228-af9e-b69faef94cce";
  const sourceNetworks = Object.keys(source.NetworkSettings.Networks || {});
  const redis = inspectContainer(options.redis);
  for (const network of sourceNetworks) {
    if (!redis.NetworkSettings.Networks?.[network]) {
      throw new Error(
        `Retained Redis ${options.redis} is not attached to app network ${network}`
      );
    }
  }

  const buildId =
    options.buildId ||
    `warm-${new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14)}`;
  if (!options.dryRun) {
    runBuild(options.build, buildId);
  } else if (options.build !== "none") {
    console.log(
      `DRY RUN: would build ${options.build} with BIOMES_BUILD_ID=${buildId}`
    );
  }
  const artifacts = await requireStableArtifacts();
  const redisBefore = await verifyRedisWorld(
    options.redis,
    titleId,
    options.minDbsize
  );
  const replacementEnv = replacementEnvironment(
    source.Config.Env,
    options.redis,
    artifacts.buildId
  );
  replacementCreateArgs({
    source,
    image,
    appName: options.app,
    redisName: options.redis,
    temporaryName: `${options.app}.warm-next-plan`,
    envFile: "<runtime-env-file>",
  });
  inferPublishedPort(source, 3000);
  inferPublishedPort(source, 4900);

  console.log(
    `Warm refresh plan: app=${options.app} redis=${options.redis} image=${source.Image} build=${artifacts.buildId} dbsize=${redisBefore.dbsize}`
  );
  if (options.dryRun) {
    console.log(
      "DRY RUN: validation passed; no container was created, stopped, or removed."
    );
    return;
  }

  const stamp = `${Date.now()}-${process.pid}`;
  const temporaryName = `${options.app}.warm-next-${stamp}`;
  const previousName = `${options.app}.warm-previous-${stamp}`;
  const envFile = writeEnvFile(replacementEnv);
  let envFileCleaned = false;
  const cleanupEnvFile = () => {
    if (envFileCleaned) return;
    fs.rmSync(envFile.directory, { recursive: true, force: true });
    envFileCleaned = true;
  };
  process.once("exit", cleanupEnvFile);
  let created = false;
  let swapped = false;
  try {
    const create = replacementCreateArgs({
      source,
      image,
      appName: options.app,
      redisName: options.redis,
      temporaryName,
      envFile: envFile.filename,
    });
    docker(create.args);
    // Docker has copied the environment into the stopped replacement. Remove
    // the secret-bearing temporary file before any potentially long readiness
    // wait rather than retaining it for the whole refresh.
    cleanupEnvFile();
    created = true;
    const replacement = verifyReplacementContainer(
      temporaryName,
      options.redis
    );
    if (replacement.Image !== source.Image) {
      throw new Error(
        `Replacement image ${replacement.Image} does not match source image ${source.Image}`
      );
    }
    const redisAfterCreate = inspectContainer(options.redis);
    if (
      redisAfterCreate.Id !== redisBefore.id ||
      !redisAfterCreate.State.Running
    ) {
      throw new Error(
        "Retained Redis changed while preparing the replacement app"
      );
    }

    const stopTimeout = source.Config.StopTimeout || 90;
    docker(["stop", "--time", String(stopTimeout), options.app]);
    docker(["rename", options.app, previousName]);
    docker(["rename", temporaryName, options.app]);
    created = false;
    swapped = true;
    docker(["start", options.app]);

    const ready = await waitForReady(
      options.app,
      options.redis,
      source,
      options.readyTimeoutSeconds
    );
    verifyReplacementContainer(options.app, options.redis);
    const redisAfter = await verifyRedisWorld(
      options.redis,
      titleId,
      options.minDbsize,
      redisBefore.expectedSnapshotHash
    );
    if (redisAfter.id !== redisBefore.id) {
      throw new Error(
        "Redis container identity changed during the app refresh"
      );
    }

    if (!options.keepPrevious) {
      docker(["rm", previousName]);
    }
    console.log(
      `Warm refresh complete: app=${options.app} web=http://127.0.0.1:${ready.webPort} sync=http://127.0.0.1:${ready.syncPort} redis=${options.redis} redis_id=${redisAfter.id.slice(0, 12)} dbsize=${redisAfter.dbsize}`
    );
    if (options.keepPrevious) {
      console.log(`Previous stopped app retained as ${previousName}`);
    }
  } catch (error) {
    if (swapped) {
      console.error(
        "Warm refresh failed; restoring the previous app container."
      );
      docker(["rm", "-f", options.app], { allowFailure: true });
      docker(["rename", previousName, options.app], { allowFailure: true });
      docker(["start", options.app], { allowFailure: true });
    } else if (created) {
      docker(["rm", "-f", temporaryName], { allowFailure: true });
    }
    throw error;
  } finally {
    cleanupEnvFile();
    process.removeListener("exit", cleanupEnvFile);
  }
}

if (require.main === module) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    console.error(usage());
    process.exitCode = 2;
  }
  if (options) {
    refresh(options).catch((error) => {
      console.error(`ERROR ${error.stack || error.message}`);
      process.exitCode = 1;
    });
  }
}

module.exports = {
  ARTIFACT_MOUNTS,
  CANONICAL_SEED_KEYS,
  envMap,
  parseArgs,
  publishedPortArgument,
  replacementCreateArgs,
  replacementEnvironment,
  usage,
  verifyReplacementContainer,
};
