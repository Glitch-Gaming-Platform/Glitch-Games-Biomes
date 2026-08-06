#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const {
  acquireBrowserRuntimeLease,
  browserRuntimeLaneId,
  runtimeEndpointKey,
} = require("./browser-runtime-lease.cjs");
const {
  leasePlaywright,
} = require("./harthmere-live-runtime-probe.cjs");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "harthmere-browser-lease-"));
const helper = path.join(root, "holder.cjs");
const legacyLockPath = path.join(root, "legacy.lock");
fs.writeFileSync(
  helper,
  `const { acquireBrowserRuntimeLease } = require(${JSON.stringify(
    path.join(__dirname, "browser-runtime-lease.cjs")
  )});
const lease = acquireBrowserRuntimeLease({
  lane: process.argv[2],
  leaseRoot: process.argv[3],
  runner: process.argv[4],
  waitTimeoutMs: Number(process.argv[5]),
  pollMs: 25,
  legacyLockPath: process.argv[8],
});
if (process.argv[6] === "hold") {
  process.send?.({ laneId: lease.laneId });
  setTimeout(() => { lease.release(); process.exit(0); }, Number(process.argv[7]));
} else {
  lease.release();
}
`
);

async function main() {
  const chromiumLaunchers = fs
    .readdirSync(__dirname)
    .filter((name) => name.endsWith(".cjs"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(__dirname, name), "utf8"),
    }))
    .filter(({ source }) => source.includes("chromium.launch"));
  const unleasedLaunchers = chromiumLaunchers
    .filter(
      ({ source }) =>
        !source.includes("acquireBrowserRuntimeLease") &&
        !source.includes("leasePlaywright") &&
        !source.includes("resolvePlaywright")
    )
    .map(({ name }) => name);
  assert.deepEqual(
    unleasedLaunchers,
    [],
    `every Harthmere Chromium launcher must use the runtime lease: ${unleasedLaunchers.join(
      ", "
    )}`
  );

  const laneA = browserRuntimeLaneId({ lane: "stack-a" });
  const laneB = browserRuntimeLaneId({ lane: "stack-b" });
  assert.notEqual(laneA, laneB, "isolated stacks need independent lanes");
  assert.equal(
    browserRuntimeLaneId({
      baseUrl: "http://127.0.0.1:3017",
      syncBaseUrl: "http://127.0.0.1:4907",
      stackContainer: "app",
      redisContainer: "redis",
    }),
    browserRuntimeLaneId({
      baseUrl: "http://127.0.0.1:3017/",
      syncBaseUrl: "http://127.0.0.1:4907/",
    }),
    "optional container metadata must not split one endpoint runtime into two lanes"
  );
  assert.equal(
    runtimeEndpointKey(
      JSON.stringify({
        baseUrl: "http://127.0.0.1:3017",
        syncBaseUrl: "http://127.0.0.1:4907",
        stackContainer: "old-app-field",
        redisContainer: "old-redis-field",
      })
    ),
    runtimeEndpointKey(
      JSON.stringify({
        baseUrl: "http://127.0.0.1:3017/",
        syncBaseUrl: "http://127.0.0.1:4907/",
      })
    ),
    "old and new descriptor formats must conflict on the same endpoints"
  );
  assert.equal(
    runtimeEndpointKey(
      JSON.stringify({
        lane: "misnamed-stack-a",
        baseUrl: "http://127.0.0.1:3017",
        syncBaseUrl: "http://127.0.0.1:4907",
      })
    ),
    runtimeEndpointKey(
      JSON.stringify({
        lane: "misnamed-stack-b",
        baseUrl: "http://127.0.0.1:3017",
        syncBaseUrl: "http://127.0.0.1:4907",
      })
    ),
    "different labels must not bypass endpoint collision protection"
  );

  const first = spawn(
    process.execPath,
    [helper, "stack-a", root, "first", "2000", "hold", "350", legacyLockPath],
    { stdio: ["ignore", "ignore", "inherit", "ipc"] }
  );
  await new Promise((resolve, reject) => {
    first.once("message", resolve);
    first.once("error", reject);
  });

  const isolated = spawnSync(
    process.execPath,
    [helper, "stack-b", root, "isolated", "200", "release", "0", legacyLockPath],
    { encoding: "utf8" }
  );
  assert.equal(isolated.status, 0, isolated.stderr);

  const competing = spawnSync(
    process.execPath,
    [helper, "stack-a", root, "competing", "100", "release", "0", legacyLockPath],
    { encoding: "utf8" }
  );
  assert.notEqual(competing.status, 0, "same-lane overlap must be rejected");
  assert.match(competing.stderr, /Timed out waiting for browser runtime lane/);

  await new Promise((resolve, reject) => {
    first.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(String(code)))));
  });
  const afterRelease = spawnSync(
    process.execPath,
    [helper, "stack-a", root, "after-release", "200", "release", "0", legacyLockPath],
    { encoding: "utf8" }
  );
  assert.equal(afterRelease.status, 0, afterRelease.stderr);

  const local = acquireBrowserRuntimeLease({
    lane: "stack-local-primary",
    baseUrl: "http://127.0.0.1:3417",
    syncBaseUrl: "http://127.0.0.1:5307",
    leaseRoot: root,
    runner: "local",
    waitTimeoutMs: 100,
    legacyLockPath,
  });
  const secondLocalBrowser = acquireBrowserRuntimeLease({
    lane: "stack-local-secondary-label",
    baseUrl: "http://127.0.0.1:3417",
    syncBaseUrl: "http://127.0.0.1:5307",
    leaseRoot: root,
    runner: "local-second-browser",
    waitTimeoutMs: 100,
    legacyLockPath,
  });
  assert.equal(
    secondLocalBrowser.leaseDir,
    local.leaseDir,
    "one process may share its runtime lease across multiple browser instances"
  );
  assert.ok(fs.existsSync(local.leaseDir));
  local.release();
  assert.equal(
    fs.existsSync(local.leaseDir),
    true,
    "the runtime lease remains until the final browser instance closes"
  );
  secondLocalBrowser.release();
  assert.equal(fs.existsSync(local.leaseDir), false);

  const fakePlaywright = {
    chromium: {
      launch: async () => ({
        close: async () => undefined,
      }),
    },
  };
  const leasedPlaywright = leasePlaywright(fakePlaywright, {
    baseUrl: "http://127.0.0.1:3517",
    syncBaseUrl: "http://127.0.0.1:5407",
    leaseRoot: root,
    legacyLockPath,
    waitTimeoutMs: 100,
  });
  const firstBrowser = await leasedPlaywright.chromium.launch();
  const secondBrowser = await leasedPlaywright.chromium.launch();
  const wrappedLeaseDirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.includes(".stale-"));
  assert.equal(
    wrappedLeaseDirs.length,
    1,
    "two browsers launched by one process share one runtime lease"
  );
  await firstBrowser.close();
  assert.equal(
    fs.existsSync(path.join(root, wrappedLeaseDirs[0].name)),
    true,
    "closing one browser keeps the shared lease for its sibling"
  );
  await secondBrowser.close();
  assert.equal(
    fs.existsSync(path.join(root, wrappedLeaseDirs[0].name)),
    false,
    "the wrapped lease releases after the final browser closes"
  );

  fs.rmSync(root, { recursive: true, force: true });
  console.log("Browser runtime lease tests passed.");
}

main().catch((error) => {
  fs.rmSync(root, { recursive: true, force: true });
  console.error(error.stack || error);
  process.exit(1);
});
