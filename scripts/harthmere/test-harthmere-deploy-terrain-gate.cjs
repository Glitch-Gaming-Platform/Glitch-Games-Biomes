#!/usr/bin/env node
/*
 * test-harthmere-deploy-terrain-gate.cjs (2026-07-30)
 *
 * Pins the deployment contract that keeps the sunken black pits out of a
 * release. This is a source-level test — it reads the reconciliation script and
 * the audit script rather than talking to Redis — because the property being
 * protected is the ORDER of the phases, and order is exactly what regressed.
 *
 * The history: the terrain audit ran first and threw on any damage, so a deploy
 * that found a pit aborted before reaching a repair, and there was no repair
 * phase to reach anyway. The runbook fix existed as a manual in-VNet chore.
 *
 * What must stay true:
 *   1. a non-fatal REPORT runs before any terrain writer;
 *   2. the surface repair runs, armed, after it;
 *   3. the interior vegetation clear runs, armed;
 *   4. a fatal VERIFY runs last, after every authored writer;
 *   5. the audit still fails hard when the non-fatal flag is absent.
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..", "..");
const RECONCILE = path.join(
  ROOT,
  "scripts/glitch/run-harthmere-production-reconciliation.sh"
);
const AUDIT = path.join(
  ROOT,
  "scripts/harthmere/audit-production-extension-terrain.cjs"
);
const REPAIR = path.join(
  ROOT,
  "scripts/harthmere/repair-harthmere-extension-surface.cjs"
);
const CLEAR = path.join(
  ROOT,
  "scripts/harthmere/clear-harthmere-building-interior-vegetation.cjs"
);
const TOWN_REPAIR = path.join(
  ROOT,
  "scripts/harthmere/repair-harthmere-town-production.cjs"
);
const TOWN_AUDIT = path.join(
  ROOT,
  "scripts/harthmere/audit-harthmere-town-repair.cjs"
);
const EXACT_OVERLAP_REPAIR = path.join(
  ROOT,
  "scripts/harthmere/repair-harthmere-exact-terrain-overlaps.cjs"
);

let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`OK ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${label}\n  ${error.message}`);
  }
}

const reconcile = fs.readFileSync(RECONCILE, "utf8");
const audit = fs.readFileSync(AUDIT, "utf8");
const townRepair = fs.readFileSync(TOWN_REPAIR, "utf8");
const exactOverlapRepair = fs.readFileSync(EXACT_OVERLAP_REPAIR, "utf8");

/** Index of the phase CALL, not its function definition. */
function callIndex(name) {
  const lines = reconcile.split("\n");
  let found = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === name) {
      found = i;
    }
  }
  return found;
}

check("every terrain phase script exists", () => {
  for (const file of [
    AUDIT,
    REPAIR,
    CLEAR,
    TOWN_REPAIR,
    TOWN_AUDIT,
    EXACT_OVERLAP_REPAIR,
  ]) {
    assert.ok(fs.existsSync(file), `missing ${path.relative(ROOT, file)}`);
  }
});

check("the deploy calls exact terrain-overlap repair and verification", () => {
  for (const phase of [
    "repair_exact_terrain_overlaps",
    "verify_exact_terrain_overlaps",
  ]) {
    assert.ok(callIndex(phase) >= 0, `${phase} is never called`);
  }
});

check("the deploy calls the persisted town repair and fatal audit", () => {
  for (const phase of ["repair_harthmere_town", "verify_harthmere_town"]) {
    assert.ok(callIndex(phase) >= 0, `${phase} is never called`);
  }
});

check("the deploy calls all four terrain phases", () => {
  for (const phase of [
    "report_extension_terrain",
    "repair_extension_surface",
    "clear_building_interior_vegetation",
    "verify_extension_terrain",
  ]) {
    assert.ok(callIndex(phase) >= 0, `${phase} is never called`);
  }
});

check("the report runs before the repair", () => {
  assert.ok(
    callIndex("report_extension_terrain") <
      callIndex("repair_extension_surface"),
    "the repair would run before the damage is described"
  );
});

check("the repair runs before the verification gate", () => {
  assert.ok(
    callIndex("repair_extension_surface") <
      callIndex("verify_extension_terrain"),
    "the gate would fire before the repair could fix anything — the original bug"
  );
});

check("the interior clear runs before the verification gate", () => {
  assert.ok(
    callIndex("clear_building_interior_vegetation") <
      callIndex("verify_extension_terrain")
  );
});

check("verification is the last terrain phase", () => {
  const verify = callIndex("verify_extension_terrain");
  for (const phase of [
    "materialize_business_outposts",
    "materialize_connector_route",
    "materialize_chapter1_world_buildings",
  ]) {
    const index = callIndex(phase);
    assert.ok(
      index >= 0 && index < verify,
      `${phase} runs after the gate, so the gate checks a stale world`
    );
  }
});

check(
  "the town repair runs before every downstream town writer and audit",
  () => {
    const repair = callIndex("repair_harthmere_town");
    const verify = callIndex("verify_harthmere_town");
    assert.ok(
      repair >= 0 && verify > repair,
      "town audit does not follow repair"
    );
    for (const phase of [
      "materialize_business_outposts",
      "materialize_connector_route",
      "materialize_chapter1_world_buildings",
      "verify_extension_terrain",
    ]) {
      const index = callIndex(phase);
      assert.ok(
        index > repair && index < verify,
        `${phase} must run after town repair and before its final audit`
      );
    }
  }
);

check("exact-overlap repair brackets every downstream terrain writer", () => {
  const repair = callIndex("repair_exact_terrain_overlaps");
  const verify = callIndex("verify_exact_terrain_overlaps");
  assert.ok(repair > callIndex("repair_harthmere_town"));
  assert.ok(verify > repair);
  for (const phase of [
    "materialize_business_outposts",
    "materialize_connector_route",
    "materialize_chapter1_world_buildings",
  ]) {
    const index = callIndex(phase);
    assert.ok(
      index > repair && index < verify,
      `${phase} must run after overlap repair and before its final gate`
    );
  }
});

check(
  "town-only reconciliation also repairs and verifies exact overlaps",
  () => {
    const townOnly = reconcile.slice(
      reconcile.indexOf('if [ "${HARTHMERE_TOWN_REPAIR_ONLY:-0}" = "1" ]'),
      reconcile.indexOf("report_extension_terrain\n")
    );
    assert.ok(
      townOnly.includes(
        [
          "repair_harthmere_town",
          "repair_exact_terrain_overlaps",
          "verify_exact_terrain_overlaps",
          "verify_harthmere_town",
        ].join("\n  ")
      ),
      "town-only mode can leave shadow terrain behind"
    );
  }
);

check(
  "exact-overlap repair fails closed and has a separate readback gate",
  () => {
    assert.ok(
      exactOverlapRepair.includes("planHarthmereExactTerrainOverlapRepair") &&
        exactOverlapRepair.includes("harthmereTerrainBoxesEqual") &&
        exactOverlapRepair.includes("Refusing to retire canonical terrain") &&
        exactOverlapRepair.includes("shard_seed: null") &&
        exactOverlapRepair.includes("HARTHMERE_EXACT_OVERLAP_REQUIRE_CLEAN") &&
        exactOverlapRepair.includes("HARTHMERE_EXACT_TERRAIN_OVERLAP_READY"),
      "overlap repair lacks exact-box/canonical guards or fatal readback"
    );
    const repairBody = reconcile.slice(
      reconcile.indexOf("repair_exact_terrain_overlaps() {"),
      reconcile.indexOf("verify_extension_terrain() {")
    );
    const verifyBody = reconcile.slice(
      reconcile.indexOf("verify_exact_terrain_overlaps() {"),
      reconcile.indexOf("materialize_business_outposts() {")
    );
    assert.ok(
      repairBody.includes("APPLY=1") &&
        verifyBody.includes("APPLY=0") &&
        verifyBody.includes("HARTHMERE_EXACT_OVERLAP_REQUIRE_CLEAN=1"),
      "reconciliation does not apply then independently verify overlap cleanup"
    );
  }
);

check(
  "the town repair is armed and its audit ignores only the separate water gate",
  () => {
    const repairBody = reconcile.slice(
      reconcile.indexOf("repair_harthmere_town() {"),
      reconcile.indexOf("verify_extension_terrain() {")
    );
    const auditBody = reconcile.slice(
      reconcile.indexOf("verify_harthmere_town() {"),
      reconcile.indexOf("materialize_business_outposts() {")
    );
    assert.ok(repairBody.includes("APPLY=1"), "town repair runs as a dry run");
    assert.ok(
      repairBody.includes("repair-harthmere-town-production.cjs"),
      "town repair script is not invoked"
    );
    assert.ok(
      auditBody.includes("HARTHMERE_TOWN_REPAIR_SKIP_WATER=1") &&
        auditBody.includes("audit-harthmere-town-repair.cjs"),
      "town verification is not the focused persisted-world audit"
    );
  }
);

check(
  "the packaged town repair evaluates shim with CommonJS require and has a loader self-test",
  () => {
    assert.ok(
      townRepair.includes("new Function(") &&
        townRepair.includes('"require"') &&
        townRepair.includes("executeBundle(") &&
        townRepair.includes("module.exports,") &&
        townRepair.includes("path.dirname(bundlePath)"),
      "town repair would evaluate dist/shim.js without CommonJS require"
    );
    assert.ok(
      townRepair.includes("HARTHMERE_TOWN_REPAIR_LOADER_SELF_TEST") &&
        townRepair.includes("HARTHMERE_TOWN_REPAIR_LOADER_READY"),
      "town repair lacks an exact built-shim loader regression mode"
    );
  }
);

check("town repair accepts canonical persisted upper-building shards", () => {
  assert.ok(
    townRepair.includes("canonicalSpecForTerrainId(id)") &&
      townRepair.includes("const box = entity.box?.()") &&
      townRepair.includes("harthmereExtensionTerrainEntityIdForShard(") &&
      townRepair.includes('entity ? "update" : "create"') &&
      townRepair.includes("editor.create(canonicalChange.entity)"),
    "town repair would reject or fail to create a valid upper-building shard omitted from the foundation spec list"
  );
});

check("the report phase is non-fatal and the gate phase is not", () => {
  const reportBody = reconcile.slice(
    reconcile.indexOf("report_extension_terrain() {"),
    reconcile.indexOf("repair_extension_surface() {")
  );
  assert.ok(
    reportBody.includes("HARTHMERE_TERRAIN_AUDIT_NON_FATAL=1"),
    "the report phase would abort the deploy before the repair runs"
  );
  const verifyBody = reconcile.slice(
    reconcile.indexOf("verify_extension_terrain() {")
  );
  assert.ok(
    !verifyBody.includes("HARTHMERE_TERRAIN_AUDIT_NON_FATAL=1"),
    "the gate is disarmed — a pit could ship"
  );
});

check("the repair and clear phases are armed", () => {
  for (const [name, next] of [
    ["repair_extension_surface", "clear_building_interior_vegetation"],
    ["clear_building_interior_vegetation", "verify_extension_terrain"],
  ]) {
    const body = reconcile.slice(
      reconcile.indexOf(`${name}() {`),
      reconcile.indexOf(`${next}() {`)
    );
    assert.ok(
      /APPLY=1/.test(body),
      `${name} runs as a dry run, so it writes nothing`
    );
  }
});

check("the audit still fails hard by default", () => {
  assert.ok(
    audit.includes("HARTHMERE_TERRAIN_AUDIT_NON_FATAL"),
    "the non-fatal escape hatch is missing"
  );
  assert.ok(
    audit.includes(
      'throw new Error("Harthmere extension terrain audit failed")'
    ),
    "the audit no longer throws, so nothing can gate a deploy"
  );
  // The escape hatch must be opt-in: the constant reads a specific env value.
  assert.ok(
    /NON_FATAL\s*=\s*process\.env\.HARTHMERE_TERRAIN_AUDIT_NON_FATAL === "1"/.test(
      audit
    ),
    "non-fatal mode is not strictly opt-in"
  );
});

check("every phase keeps a documented skip switch", () => {
  for (const flag of [
    "HARTHMERE_SKIP_EXTENSION_TERRAIN_AUDIT",
    "HARTHMERE_SKIP_EXTENSION_SURFACE_REPAIR",
    "HARTHMERE_SKIP_INTERIOR_VEGETATION_CLEAR",
    "HARTHMERE_SKIP_TOWN_PRODUCTION_REPAIR",
    "HARTHMERE_SKIP_TOWN_REPAIR_AUDIT",
  ]) {
    assert.ok(reconcile.includes(flag), `${flag} has no escape hatch`);
  }
});

if (failures) {
  console.error(`\n${failures} deploy terrain gate check(s) failed.`);
  process.exit(1);
}
console.log("\nOK Harthmere deploy terrain gate contract holds.");
