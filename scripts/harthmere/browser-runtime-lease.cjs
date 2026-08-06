"use strict";

/**
 * Process-level browser lease for production-shaped Harthmere E2E runners.
 *
 * One process may open as many Chromium instances/contexts as its scenario
 * requires. Separate processes may also run concurrently when they target
 * different runtime lanes. Processes targeting the same app/sync/Redis lane
 * serialize through one atomic directory lease so they cannot compete for
 * player fixtures, Sync bandwidth, WebGL/CPU, or a transactional warm refresh.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_LEASE_ROOT = "/tmp/biomes-harthmere-browser-lanes";
const LEGACY_GLOBAL_LOCK = "/tmp/biomes-harthmere-native-ecs-browser.lock";
const activeProcessLeases = new Map();

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

function normalizedLaneDescriptor(input = {}) {
  const explicit =
    input.lane || process.env.HARTHMERE_E2E_BROWSER_RUNTIME_LANE;
  return JSON.stringify({
    lane: explicit ? String(explicit).trim() : undefined,
    baseUrl: String(
      input.baseUrl || process.env.HARTHMERE_E2E_BASE_URL || ""
    ).replace(/\/$/, ""),
    syncBaseUrl: String(
      input.syncBaseUrl || process.env.HARTHMERE_E2E_SYNC_BASE_URL || ""
    ).replace(/\/$/, ""),
  });
}

function browserRuntimeLaneId(input = {}) {
  const descriptor = normalizedLaneDescriptor(input);
  return crypto.createHash("sha256").update(descriptor).digest("hex").slice(0, 20);
}

function runtimeEndpointKey(descriptor) {
  try {
    const parsed = JSON.parse(descriptor);
    const baseUrl = String(parsed.baseUrl || "").replace(/\/$/, "");
    const syncBaseUrl = String(parsed.syncBaseUrl || "").replace(/\/$/, "");
    if (baseUrl || syncBaseUrl) {
      return JSON.stringify({ baseUrl, syncBaseUrl });
    }
    return `explicit:${String(parsed.lane || "").trim()}`;
  } catch {
    return String(descriptor);
  }
}

function ownerSummary(owner) {
  if (!owner) return "unknown owner";
  return `${owner.runner || "browser E2E"} pid ${owner.pid || "?"} run ${
    owner.runId || "unknown"
  }`;
}

function removeStaleLease(leaseDir) {
  const stale = `${leaseDir}.stale-${process.pid}-${Date.now()}`;
  try {
    fs.renameSync(leaseDir, stale);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  fs.rmSync(stale, { recursive: true, force: true });
}

function compatibleLiveLease(leaseRoot, laneDescriptor, ownLeaseDir) {
  const endpointKey = runtimeEndpointKey(laneDescriptor);
  for (const entry of fs.readdirSync(leaseRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.includes(".stale-")) continue;
    const candidateDir = path.join(leaseRoot, entry.name);
    if (candidateDir === ownLeaseDir) continue;
    const candidate = readJson(path.join(candidateDir, "owner.json"));
    const candidatePid = Number(candidate?.pid);
    if (!processAlive(candidatePid)) {
      removeStaleLease(candidateDir);
      continue;
    }
    if (
      candidatePid !== process.pid &&
      runtimeEndpointKey(candidate?.laneDescriptor) === endpointKey
    ) {
      return { owner: candidate, leaseDir: candidateDir };
    }
  }
  return undefined;
}

function waitForLegacyGlobalLock(options) {
  const legacyPath =
    options.legacyLockPath ||
    process.env.HARTHMERE_E2E_LEGACY_BROWSER_LOCK_PATH || LEGACY_GLOBAL_LOCK;
  const startedAt = Date.now();
  while (fs.existsSync(legacyPath)) {
    const owner = readJson(legacyPath);
    if (!processAlive(Number(owner?.pid))) {
      try {
        fs.unlinkSync(legacyPath);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      continue;
    }
    if (Number(owner?.pid) === process.pid) return;
    if (Date.now() - startedAt >= options.waitTimeoutMs) {
      throw new Error(
        `Timed out waiting for legacy browser lock ${legacyPath}; ${ownerSummary(
          owner
        )} is still active`
      );
    }
    sleepSync(options.pollMs);
  }
}

function acquireBrowserRuntimeLease(input = {}) {
  const laneDescriptor = normalizedLaneDescriptor(input);
  const endpointKey = runtimeEndpointKey(laneDescriptor);
  const reentrant = activeProcessLeases.get(endpointKey);
  if (reentrant) {
    reentrant.references += 1;
    let released = false;
    return {
      ...reentrant.publicLease,
      release: () => {
        if (released) return;
        released = true;
        reentrant.references -= 1;
        if (reentrant.references === 0) {
          activeProcessLeases.delete(endpointKey);
          reentrant.releaseOwner();
        }
      },
    };
  }
  const laneId = browserRuntimeLaneId(input);
  const leaseRoot =
    input.leaseRoot ||
    process.env.HARTHMERE_E2E_BROWSER_LEASE_ROOT ||
    DEFAULT_LEASE_ROOT;
  const waitTimeoutMs = Number(
    input.waitTimeoutMs ??
      process.env.HARTHMERE_E2E_BROWSER_LEASE_WAIT_MS ??
      15 * 60_000
  );
  const pollMs = Math.max(50, Number(input.pollMs ?? 250));
  const leaseDir = path.join(leaseRoot, laneId);
  const ownerPath = path.join(leaseDir, "owner.json");
  const token = crypto.randomBytes(12).toString("hex");
  const startedAt = Date.now();
  const owner = {
    version: "harthmere-browser-runtime-lease-v1",
    pid: process.pid,
    token,
    runner: input.runner || path.basename(process.argv[1] || "browser-e2e"),
    runId: input.runId,
    laneId,
    laneDescriptor,
    acquiredAt: new Date().toISOString(),
  };

  fs.mkdirSync(leaseRoot, { recursive: true });
  // Transitional compatibility: wait for any already-running legacy runner.
  // New migrated runners use lane-specific leases and can run in parallel on
  // genuinely different app/sync/Redis stacks.
  waitForLegacyGlobalLock({
    waitTimeoutMs,
    pollMs,
    legacyLockPath: input.legacyLockPath,
  });

  while (true) {
    const compatible = compatibleLiveLease(
      leaseRoot,
      laneDescriptor,
      leaseDir
    );
    if (compatible) {
      if (Date.now() - startedAt >= waitTimeoutMs) {
        throw new Error(
          `Timed out waiting for compatible browser runtime lane ${compatible.leaseDir}; ${ownerSummary(
            compatible.owner
          )} is still active`
        );
      }
      sleepSync(pollMs);
      continue;
    }
    try {
      fs.mkdirSync(leaseDir);
      fs.writeFileSync(ownerPath, JSON.stringify(owner, null, 2));
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const current = readJson(ownerPath);
      const currentPid = Number(current?.pid);
      if (!processAlive(currentPid)) {
        removeStaleLease(leaseDir);
        continue;
      }
      if (Date.now() - startedAt >= waitTimeoutMs) {
        throw new Error(
          `Timed out waiting for browser runtime lane ${laneId}; ${ownerSummary(
            current
          )} is still active. Use a different HARTHMERE_E2E_BROWSER_RUNTIME_LANE only for a genuinely isolated stack.`
        );
      }
      sleepSync(pollMs);
    }
  }

  let ownerReleased = false;
  const releaseOwner = () => {
    if (ownerReleased) return;
    ownerReleased = true;
    const current = readJson(ownerPath);
    if (current?.token === token && Number(current?.pid) === process.pid) {
      fs.rmSync(leaseDir, { recursive: true, force: true });
    }
  };
  const publicLease = { laneId, laneDescriptor, leaseDir, owner };
  const processLease = {
    publicLease,
    references: 1,
    releaseOwner,
  };
  activeProcessLeases.set(endpointKey, processLease);
  process.on("exit", releaseOwner);
  let released = false;
  return {
    ...publicLease,
    release: () => {
      if (released) return;
      released = true;
      processLease.references -= 1;
      if (processLease.references === 0) {
        activeProcessLeases.delete(endpointKey);
        releaseOwner();
      }
    },
  };
}

module.exports = {
  DEFAULT_LEASE_ROOT,
  LEGACY_GLOBAL_LOCK,
  acquireBrowserRuntimeLease,
  browserRuntimeLaneId,
  normalizedLaneDescriptor,
  runtimeEndpointKey,
};
