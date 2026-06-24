#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const {
  applyGlitchMutableHotfixManifest,
  getGlitchMutableHotfixStatus,
} = require("../../src/server/glitch/mutable_hotfix");

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "biomes-mutable-hotfix-"));
  process.env.GLITCH_MUTABLE_HOTFIX_ROOT = root;
  process.env.GLITCH_MUTABLE_HOTFIX_ENABLED = "1";

  const result = await applyGlitchMutableHotfixManifest(
    {
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
    },
    { force: true }
  );

  assert.equal(result.ok, true);
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

  const status = getGlitchMutableHotfixStatus();
  assert.equal(status.enabled, true);
  assert.equal(status.lastAppliedVersion, "test-v1");

  fs.rmSync(root, { recursive: true, force: true });
  console.log("mutable hotfix layer test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
