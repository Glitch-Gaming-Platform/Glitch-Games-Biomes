#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const {
  applyAndPersistGlitchMutableHotfixManifest,
  applyGlitchMutableHotfixManifest,
  closeGlitchMutableHotfixRedis,
  getGlitchMutableHotfixStatus,
} = require("../../src/server/glitch/mutable_hotfix");
const {
  glitchMutableHotfixClientDescriptor,
  renderGlitchMutableHotfixClientScript,
} = require("../../src/server/glitch/mutable_hotfix_client");

function makeClientSandbox() {
  const elements = new Map();
  const events = [];
  const head = {
    appendChild(element) {
      element.parent = head;
      if (element.id) elements.set(element.id, element);
    },
  };
  const document = {
    head,
    createElement(tagName) {
      return {
        tagName,
        id: "",
        textContent: "",
        parent: undefined,
        remove() {
          if (this.id) elements.delete(this.id);
          this.parent = undefined;
        },
      };
    },
    getElementById(id) {
      return elements.get(id) ?? null;
    },
  };
  class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  }
  const window = {
    dispatchEvent(event) {
      events.push(event);
    },
  };
  return {
    sandbox: { window, document, CustomEvent, console },
    window,
    document,
    events,
  };
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "biomes-mutable-hotfix-"));
  process.env.GLITCH_MUTABLE_HOTFIX_ROOT = root;
  process.env.GLITCH_MUTABLE_HOTFIX_STATE_FILE = path.join(root, "state.json");
  process.env.GLITCH_MUTABLE_HOTFIX_ENABLED = "1";
  process.env.BUILD_ID = "test-build";
  process.env.GLITCH_STACK_ROLE = "web";

  const initialManifest = {
    version: "test-v1",
    description: "mutable hotfix test",
    operations: [
      { type: "mkdir", path: "nested" },
      {
        type: "writeFile",
        path: "nested/target.txt",
        content: "hello old world",
      },
      {
        type: "replace",
        path: "nested/target.txt",
        search: "old",
        replace: "mutable",
        expectCount: 1,
      },
      {
        type: "exec",
        cwd: ".",
        command:
          "node -e \"require('fs').writeFileSync('exec-output.txt','ok')\"",
      },
      {
        type: "eval",
        code: "globalThis.__mutableHotfixEvalWorked = true;",
      },
    ],
  };
  const result = await applyGlitchMutableHotfixManifest(initialManifest, {
    force: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.applied, true);
  assert.equal(result.version, "test-v1");
  assert.equal(
    fs.readFileSync(path.join(root, "nested/target.txt"), "utf8"),
    "hello mutable world"
  );
  assert.equal(
    fs.readFileSync(path.join(root, "exec-output.txt"), "utf8"),
    "ok"
  );
  assert.equal(globalThis.__mutableHotfixEvalWorked, true);
  assert.equal(
    fs.existsSync(process.env.GLITCH_MUTABLE_HOTFIX_STATE_FILE),
    true
  );
  delete globalThis.__glitchMutableHotfixState;
  const duplicateFromAnotherProcess =
    await applyGlitchMutableHotfixManifest(initialManifest);
  assert.equal(duplicateFromAnotherProcess.hash, result.hash);
  assert.equal(
    fs.readFileSync(path.join(root, "nested/target.txt"), "utf8"),
    "hello mutable world",
    "another process reads the shared applied-state marker instead of applying twice"
  );

  fs.writeFileSync(path.join(root, "rollback.txt"), "before");
  await assert.rejects(
    applyGlitchMutableHotfixManifest(
      {
        version: "test-rollback",
        operations: [
          {
            type: "writeFile",
            path: "rollback.txt",
            content: "after",
          },
          {
            type: "replace",
            path: "rollback.txt",
            search: "missing text",
            replace: "never",
            expectCount: 1,
          },
        ],
      },
      { force: true, scheduleRestart: false }
    ),
    /replace_count_mismatch/
  );
  assert.equal(
    fs.readFileSync(path.join(root, "rollback.txt"), "utf8"),
    "before",
    "a failed manifest rolls earlier file writes back"
  );

  const incompatible = await applyGlitchMutableHotfixManifest(
    {
      version: "test-incompatible",
      compatibleBuildIds: ["another-build"],
      operations: [
        { type: "writeFile", path: "must-not-exist.txt", content: "bad" },
      ],
    },
    { force: true, scheduleRestart: false }
  );
  assert.equal(incompatible.applied, false);
  assert.equal(incompatible.skippedReason, "incompatible_build");
  assert.equal(fs.existsSync(path.join(root, "must-not-exist.txt")), false);

  const wrongRole = await applyGlitchMutableHotfixManifest(
    {
      version: "test-wrong-role",
      compatibleBuildIds: ["test-build"],
      targetRoles: ["simulation"],
      operations: [
        { type: "writeFile", path: "wrong-role.txt", content: "bad" },
      ],
    },
    { force: true, scheduleRestart: false }
  );
  assert.equal(wrongRole.applied, false);
  assert.equal(wrongRole.skippedReason, "incompatible_role");
  assert.equal(fs.existsSync(path.join(root, "wrong-role.txt")), false);

  let persistCalls = 0;
  await assert.rejects(
    applyAndPersistGlitchMutableHotfixManifest(
      {
        version: "test-no-poison",
        compatibleBuildIds: ["test-build"],
        operations: [
          {
            type: "replace",
            path: "rollback.txt",
            search: "not present",
            replace: "never",
            expectCount: 1,
          },
        ],
      },
      {
        scheduleRestart: false,
        persist: async () => {
          persistCalls += 1;
        },
      }
    ),
    /replace_count_mismatch/
  );
  assert.equal(persistCalls, 0, "a failed apply is never persisted");

  await applyAndPersistGlitchMutableHotfixManifest(
    {
      version: "test-persist-after-apply",
      compatibleBuildIds: ["test-build"],
      targetRoles: ["web"],
      operations: [
        {
          type: "writeFile",
          path: "persist-order.txt",
          content: "applied",
        },
      ],
    },
    {
      scheduleRestart: false,
      persist: async () => {
        persistCalls += 1;
        assert.equal(
          fs.readFileSync(path.join(root, "persist-order.txt"), "utf8"),
          "applied",
          "persistence happens only after the local apply succeeds"
        );
      },
    }
  );
  assert.equal(persistCalls, 1);

  const clientV1 = {
    version: "client-v1",
    operations: [],
    client: {
      script: `window.clientHotfixValue = "v1";
window.__biomesGlitchMutableHotfix.registerCleanup(() => {
  window.clientCleanupCount = (window.clientCleanupCount || 0) + 1;
});`,
      style: "body { --mutable-hotfix-test: 1; }",
    },
  };
  const clientV2 = {
    version: "client-v2",
    operations: [],
    client: {
      script: `window.clientHotfixValue = "v2";`,
      style: "body { --mutable-hotfix-test: 2; }",
      reload: "on-change",
    },
  };
  const descriptor = glitchMutableHotfixClientDescriptor(clientV1);
  assert.equal(descriptor.active, true);
  assert(descriptor.scriptUrl.includes("asset=script"));
  assert(descriptor.scriptUrl.includes(descriptor.hash));

  const client = makeClientSandbox();
  vm.runInNewContext(
    renderGlitchMutableHotfixClientScript(clientV1),
    client.sandbox
  );
  assert.equal(client.window.clientHotfixValue, "v1");
  assert.equal(
    client.document.getElementById("biomes-glitch-mutable-hotfix-style")
      .textContent,
    "body { --mutable-hotfix-test: 1; }"
  );
  vm.runInNewContext(
    renderGlitchMutableHotfixClientScript(clientV2),
    client.sandbox
  );
  assert.equal(client.window.clientHotfixValue, "v2");
  assert.equal(client.window.clientCleanupCount, 1);
  assert.equal(client.events.at(-1).type, "biomes:mutable-hotfix-applied");

  const status = getGlitchMutableHotfixStatus();
  assert.equal(status.enabled, true);
  assert.equal(status.lastAppliedVersion, "test-persist-after-apply");
  assert.equal(typeof closeGlitchMutableHotfixRedis, "function");

  const startupCli = fs.readFileSync(
    path.join(__dirname, "apply-mutable-hotfix.ts"),
    "utf8"
  );
  assert(
    startupCli.includes("closeGlitchMutableHotfixRedis") &&
      startupCli.includes(".finally(closeStartupResources)") &&
      startupCli.includes("scheduleRestart: false") &&
      startupCli.includes('process.argv.includes("--watch")') &&
      startupCli.includes("maybeApplyGlitchMutableHotfixFromRedis") &&
      startupCli.includes("GLITCH_MUTABLE_HOTFIX Redis close failed"),
    "startup apply suppresses restart loops and the long-lived watcher retains Redis"
  );

  const stackRunner = fs.readFileSync(
    path.join(__dirname, "run-glitch-local-game-stack.sh"),
    "utf8"
  );
  assert(
    stackRunner.includes(
      'node "$APP_ROOT/dist/apply-mutable-hotfix.js" --watch'
    ) && stackRunner.includes("PID mutable-hotfix-watcher="),
    "every stack replica starts the mutable hotfix watcher"
  );

  const publicApi = fs.readFileSync(
    path.join(__dirname, "../../src/pages/api/mutable_hotfix.ts"),
    "utf8"
  );
  const appSource = fs.readFileSync(
    path.join(__dirname, "../../src/pages/_app.tsx"),
    "utf8"
  );
  const documentSource = fs.readFileSync(
    path.join(__dirname, "../../src/pages/_document.tsx"),
    "utf8"
  );
  assert(
    publicApi.includes("private, no-store, max-age=0") &&
      publicApi.includes("renderGlitchMutableHotfixClientScript") &&
      appSource.includes("installGlitchMutableHotfixClient") &&
      documentSource.includes("asset=script&bootstrap=1"),
    "browser hotfixes use a no-store bootstrap plus a live version poller"
  );

  fs.rmSync(root, { recursive: true, force: true });
  console.log("mutable hotfix layer test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
