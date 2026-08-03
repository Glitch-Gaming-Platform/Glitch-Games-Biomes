#!/usr/bin/env node
/*
 * test-harthmere-deploy-chapter1-seed-gate.cjs (2026-08-03)
 *
 * Pins the deployment contract for the Chapter 1 seed readback, in the same
 * source-level style as test-harthmere-deploy-terrain-gate.cjs: it reads the
 * deploy script and the audit script rather than talking to Redis, because the
 * property being protected is WHETHER AND WHERE the gate is wired, and that is
 * exactly what was missing.
 *
 * The history: before 2026-08-03 the strings "ch1" and "chapter1" did not
 * appear anywhere in deploy-production-local-redis-smoke.sh. The shim seeded
 * the Chapter 1 world correctly, and nothing outside it ever confirmed the
 * rows landed. Because chapter1_progress treats a MISSING encounter entity as
 * still alive (`!entity || hp > 0` — correct for anti-cheat, catastrophic for a
 * missing seed), a silent miss is an unrecoverable Act 3 stop that logs
 * nothing. This repository has shipped silent seed misses twice before.
 *
 * What must stay true:
 *   1. the Chapter 1 readback script exists and is fatal by default;
 *   2. the deploy invokes it;
 *   3. it runs AFTER the shim seed completes and AFTER the terrain audit;
 *   4. it runs BEFORE the readiness marker, so a bad world is never "ready";
 *   5. a non-zero exit aborts the deploy rather than being logged and ignored;
 *   6. it covers all five seeded populations, not just the easy one;
 *   7. it keeps a documented skip switch, like every other phase.
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..", "..");
const DEPLOY = path.join(
  ROOT,
  "scripts/glitch/deploy-production-local-redis-smoke.sh"
);
const CH1_AUDIT = path.join(
  ROOT,
  "scripts/harthmere/audit-production-chapter1-seed.cjs"
);
const WORLD_SYNC = path.join(
  ROOT,
  "scripts/harthmere/reconcile-production-world-sync.cjs"
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

const deploy = fs.readFileSync(DEPLOY, "utf8");
const audit = fs.readFileSync(CH1_AUDIT, "utf8");
const worldSync = fs.readFileSync(WORLD_SYNC, "utf8");

const index = (needle) => deploy.indexOf(needle);

/**
 * True when `source` sets `name` to a truthy value in any spelling the deploy
 * actually uses: shell assignment (`NAME=1 node …`), export, or a spawnSync
 * env object (`{ ...process.env, NAME: "1" }`). Checking only one spelling is
 * how a disarmed gate passes its own contract test.
 */
function armsEnvFlag(source, name) {
  const patterns = [
    new RegExp(`\\b${name}=(?!0\\b)["']?[^\\s"']+`),
    new RegExp(`${name}\\s*:\\s*["'\`](?!0["'\`])[^"'\`]+["'\`]`),
    new RegExp(`${name}\\s*:\\s*(?!0\\b|false\\b)(true|[1-9])`),
  ];
  return patterns.some((pattern) => pattern.test(source));
}

check("the Chapter 1 seed readback script exists", () => {
  assert.ok(fs.existsSync(CH1_AUDIT), `${CH1_AUDIT} is missing`);
});

check("the deploy invokes the Chapter 1 seed readback", () => {
  assert.ok(
    index("scripts/harthmere/audit-production-chapter1-seed.cjs") >= 0,
    "the deploy never runs the Chapter 1 readback"
  );
});

check("the readback runs after the shim seed completes", () => {
  const seedComplete = index("Seeded local dev starter town");
  const ch1 = index("scripts/harthmere/audit-production-chapter1-seed.cjs");
  assert.ok(seedComplete >= 0, "the shim completion sentinel is gone");
  assert.ok(
    seedComplete < ch1,
    "the readback would run before the seed it is checking"
  );
});

check("the readback runs after the terrain audit", () => {
  const terrain = index(
    "scripts/harthmere/audit-production-extension-terrain.cjs"
  );
  const ch1 = index("scripts/harthmere/audit-production-chapter1-seed.cjs");
  assert.ok(terrain >= 0, "the terrain audit is gone");
  assert.ok(
    terrain < ch1,
    "Chapter 1 entities would be checked against unverified terrain"
  );
});

check("the readback runs before the readiness marker", () => {
  const ch1 = index("scripts/harthmere/audit-production-chapter1-seed.cjs");
  const ready = index("HARTHMERE_TERRAIN_MAINTENANCE_READY");
  assert.ok(ready >= 0, "the readiness marker is gone");
  assert.ok(
    ch1 < ready,
    "the world would be declared ready before Chapter 1 is verified — the " +
      "original bug shape"
  );
});

check("a failing readback aborts the deploy", () => {
  assert.ok(
    /ch1Audit\.status !== 0\)\s*throw new Error/.test(deploy),
    "the readback's exit status is not turned into a thrown error, so a " +
      "missing Chapter 1 world would be logged and shipped"
  );
});

check("the readback is fatal by default", () => {
  assert.ok(
    /throw new Error\(\s*`Chapter 1 seed readback failed/.test(audit),
    "the audit does not throw on problems"
  );
  assert.ok(
    audit.includes("HARTHMERE_CH1_SEED_AUDIT_NON_FATAL"),
    "there is no report-only escape hatch"
  );
  assert.ok(
    /NON_FATAL =\s*process\.env\.HARTHMERE_CH1_SEED_AUDIT_NON_FATAL === "1"/.test(
      audit
    ),
    "report-only must be opt-in, never the default"
  );
  // The deploy can arm an env flag in shell form (`FOO=1 node ...`) OR in the
  // JS spawnSync env-object form (`{ FOO: "1" }`). An earlier version of this
  // check only matched the shell spelling, and a mutation that armed the flag
  // via the env object passed cleanly. Match both.
  assert.ok(
    !armsEnvFlag(deploy, "HARTHMERE_CH1_SEED_AUDIT_NON_FATAL"),
    "the deploy arms the report-only flag, which disarms the whole gate"
  );
});

check("the readback covers every seeded Chapter 1 population", () => {
  for (const symbol of [
    "CH1_SEEDED_CAST",
    "CH1_DUNGEON_ENCOUNTER_NPCS",
    "CH1_DUNGEON_ESCORT_NPCS",
    "CH1_TESTIMONY_NPC_SEEDS",
    "ch1DungeonShardSpecs",
  ]) {
    assert.ok(
      audit.includes(symbol),
      `the readback does not check ${symbol}; a gap there is invisible`
    );
  }
});

check("production world sync upserts Chapter 1 testimony NPCs", () => {
  assert.ok(
    worldSync.includes("harthmereChapter1TestimonyNpcSeedEntityIds") &&
      worldSync.includes(
        "buildHarthmereChapter1TestimonyNpcSeedProposedChanges"
      ),
    "the production world-sync reconciler omits the testimony family, so " +
      "Grover can keep an old persisted position across deploys"
  );
});

check("production world sync repairs testimony positions in HFC", () => {
  assert.ok(
    worldSync.includes("reconcileChapter1TestimonyNpcHfcPositions") &&
      worldSync.includes('connectToRedis("ecs-hfc")') &&
      worldSync.includes(
        "Chapter 1 testimony positions persist in primary and HFC ECS"
      ),
    "the deployment does not repair/read back the HFC position that Sync " +
      "uses for Grover"
  );
});

check(
  "the Chapter 1 readback validates testimony position and respawn anchor",
  () => {
    assert.ok(
      audit.includes("requireSeedPosition: true") &&
        audit.includes("respawns at") &&
        audit.includes("expected X/Z"),
      "the readback still checks only that Grover exists, not where he is"
    );
  }
);

check("the readback requires encounter bosses to be alive", () => {
  // A corpse from a previous world is as unplayable as a missing entity: the
  // objective gate only accepts hp<=0 on an entity it can see, but the fight
  // itself cannot happen.
  assert.ok(
    /requireAlive:\s*true/.test(audit),
    "encounter NPCs are not checked for being alive"
  );
});

check("the readback keeps a documented skip switch", () => {
  assert.ok(
    audit.includes("HARTHMERE_SKIP_CH1_SEED_AUDIT"),
    "every deploy phase in this repo must be skippable by an explicit env flag"
  );
  assert.ok(
    !armsEnvFlag(deploy, "HARTHMERE_SKIP_CH1_SEED_AUDIT"),
    "the deploy hard-codes the skip, which disarms the gate"
  );
});

if (failures > 0) {
  console.error(
    `\n${failures} Chapter 1 deploy seed gate contract check(s) failed.`
  );
  process.exit(1);
}
console.log("\nOK Harthmere deploy Chapter 1 seed gate contract holds.");
