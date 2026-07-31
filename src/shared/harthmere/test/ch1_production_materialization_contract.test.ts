/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import fs from "fs";
import path from "path";

// See the note in ch1_native_e2e_runner_contract.test.ts: `__dirname` does not
// exist when mocha loads this file as an ES module, which aborts the entire run
// before any assertion. Mocha is always invoked from the repo root.
const REPO_ROOT = path.resolve(process.cwd());
const read = (relativePath: string) =>
  fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

describe("Chapter 1 production world-building materialization", () => {
  const materializer = read(
    "scripts/harthmere/materialize-chapter1-world-buildings-redis.cjs"
  );
  const reconciliation = read(
    "scripts/glitch/run-harthmere-production-reconciliation.sh"
  );

  it("applies the canonical Road-House and Watch House plans to native terrain", () => {
    assert.match(materializer, /CH1_WORLD_BUILDING_PLANS/);
    assert.match(materializer, /Missing[\s\S]*world-building terrain shards/);
    assert.match(materializer, /new RedisWorld/);
    assert.match(materializer, /entity\.mutableShardDiff\(\)\.buffer/);
    assert.match(materializer, /await editor\.commit\(\)/);
    assert.match(materializer, /process\.env\.APPLY === "1"/);
  });

  it("supports an idempotent readback gate and acknowledges only committed structures", () => {
    assert.match(materializer, /process\.env\.REQUIRE_CURRENT === "1"/);
    assert.match(materializer, /remainingPendingEditCount > 0/);
    assert.match(
      materializer,
      /APPLY\s*\?\s*pendingEditCount - appliedEditCount\s*:\s*pendingEditCount/
    );
    assert.match(materializer, /acknowledgeMaterializedBuildings/);
    assert.match(materializer, /materializedInEcs = true/);
    assert.ok(
      materializer.indexOf("await editor.commit()") <
        materializer.lastIndexOf("await acknowledgeMaterializedBuildings()"),
      "shared state must never claim materialization before native terrain commits"
    );
  });

  it("runs after shared-state reconciliation and before the connector's final terrain pass", () => {
    const worldSync = reconciliation.indexOf(
      "scripts/harthmere/reconcile-production-world-sync.cjs"
    );
    const buildings = reconciliation.lastIndexOf(
      "materialize_chapter1_world_buildings"
    );
    const connector = reconciliation.lastIndexOf("materialize_connector_route");
    assert.ok(worldSync >= 0, "production reconciliation must run world sync");
    assert.ok(
      buildings > worldSync,
      "the building plans must exist in shared state before terrain is applied"
    );
    assert.ok(
      connector > buildings,
      "the protected connector remains the final authoritative terrain writer"
    );
    assert.match(
      reconciliation,
      /HARTHMERE_SKIP_CH1_WORLD_BUILDING_MATERIALIZATION/
    );
    assert.match(
      reconciliation,
      /node scripts\/harthmere\/materialize-chapter1-world-buildings-redis\.cjs/
    );
  });
});
