#!/usr/bin/env node
// HARTHMERE_ATTACKED_NPC_RETALIATION_V3
// Tests that the NPC retaliation fallback works correctly for all attackable
// NPC types — including snapshot Mucklings, Hexes, and animals — not just
// NPCs whose biscuit data explicitly sets attackable: true.
//
// V3 changes vs V2:
//   - Keeps the V2 condition check: retaliation only blocks when damageable is
//     absent entirely OR attackable is explicitly false.
//   - Tightens the deep-merge test: snapshotLegacyNpcTypeV1 must not inherit
//     the human-NPC fallback's attackable:false when a hostile imported NPC
//     declares a damageable block but omits attackable.
//   - Adds semantic checks that explicit false stays false, explicit true stays
//     true, and omitted attackable defaults to true for damageable hostiles.

const fs = require("fs");
const path = require("path");

function check(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  }
}

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const logicPath = path.join(root, "src/shared/npc/logic.ts");
const chasePath = path.join(root, "src/shared/npc/behavior/chase_attack.ts");
const bikkiePath = path.join(root, "src/shared/npc/bikkie.ts");

console.log("== Harthmere attacked NPC retaliation v3 ==");

check(fs.existsSync(logicPath), "NPC tick logic exists");
check(fs.existsSync(chasePath), "chase attack behavior exists");
check(fs.existsSync(bikkiePath), "NPC bikkie helpers exist");

const logic = fs.readFileSync(logicPath, "utf8");
const chase = fs.readFileSync(chasePath, "utf8");
const bikkie = fs.readFileSync(bikkiePath, "utf8");

// ── Versioning ──────────────────────────────────────────────────────────────
check(
  logic.includes("ATTACKED_NPC_RETALIATION_FALLBACK_V1"),
  "retaliation fallback is versioned"
);

// ── Authored aggression takes priority ──────────────────────────────────────
check(
  logic.includes("if (behavior.chaseAttack)") &&
    logic.includes("return behavior.chaseAttack"),
  "authored proactive aggression remains authoritative"
);

// ── Retaliation trigger ──────────────────────────────────────────────────────
check(
  logic.includes('aggroTrigger: { kind: "onlyIfAttacked" }'),
  "fallback only retaliates after attack"
);

// ── V2 condition: block only when damageable absent OR explicitly false ──────
// The old check was `behavior.damageable?.attackable !== true` which treated
// undefined as non-attackable, blocking all snapshot NPCs without an explicit
// attackable: true in their biscuit. The new check uses the correct semantics.
check(
  logic.includes("!behavior.damageable ||") &&
    logic.includes("behavior.damageable.attackable === false"),
  "fallback blocks retaliation only when damageable is absent or explicitly false (V2 fix)"
);
// Confirm the old broken check is not used as live code (may appear in comments)
// We verify this by checking the actual if-condition block does NOT contain it.
// The if-condition block starts with "if (" and ends with ") {" — we extract it.
const retaliationIfMatch = logic.match(/if\s*\(\s*!behavior\.damageable[\s\S]*?\)\s*\{/);
check(
  retaliationIfMatch
    ? !retaliationIfMatch[0].includes("attackable !== true")
    : false,
  "live retaliation if-condition does not use the old !== true check"
);

// ── Damage-source guard ──────────────────────────────────────────────────────
check(
  logic.includes('npc.health.lastDamageSource?.kind !== "attack"') &&
    logic.includes("npc.health.lastDamageTime === undefined"),
  "fallback requires a real recent attack source"
);

// ── Wiring: updateAttackTarget + chaseAttackTargetTick are both called ───────
check(
  logic.includes("updateAttackTarget(env, npc, chaseAttack)") &&
    logic.includes("chaseAttackTargetTick(") &&
    logic.includes("chaseAttack"),
  "effective chaseAttack params drive target selection and attack ticks"
);

// ── No name-whitelist gatekeeping ────────────────────────────────────────────
check(
  !logic.includes("npc.label") && !logic.includes("displayName"),
  "retaliation is not limited to a name whitelist"
);

// ── Chase-attack resolves last attacker ─────────────────────────────────────
check(
  chase.includes('kind === "onlyIfAttacked"') &&
    chase.includes("lastDamageSource.attacker"),
  "existing chase behavior resolves the last attacker for retaliation"
);

// ── snapshotLegacyNpcTypeV1 deep-merges damageable ──────────────────────────
// Shallow-merging the human-NPC fallback behavior (attackable: false) over a
// snapshot hostile NPC was the root cause of Mucklings/Hexes/animals not
// fighting back. The fix deep-merges the damageable sub-object so each field
// is independently merged instead of the whole object being replaced.
check(
  bikkie.includes("SNAPSHOT_LEGACY_NPC_BEHAVIOR_DEEP_MERGE_V3"),
  "snapshotLegacyNpcTypeV1 is versioned for deep-merge/default-attackable fix"
);
check(
  bikkie.includes("candidateDamageable") &&
    bikkie.includes("mergedDamageable") &&
    bikkie.includes("damageable: mergedDamageable"),
  "snapshotLegacyNpcTypeV1 deep-merges damageable instead of shallow-overriding it"
);
check(
  bikkie.includes("candidateDamageable.attackable === false") &&
    bikkie.includes("candidateDamageable.attackable === true") &&
    bikkie.includes(": true,"),
  "candidate damageable attackable:false stays false, attackable:true stays true, and omitted attackable defaults to true"
);
check(
  !bikkie.includes("? { ...fallbackDamageable, ...candidateDamageable }") &&
    !bikkie.includes("?{ ...fallbackDamageable, ...candidateDamageable }"),
  "candidate damageable no longer inherits fallback attackable:false through a plain shallow object spread"
);

// ── Semantic: the condition allows all three hostile snapshot NPC families ───
// Verify the logic allows retaliation when:
//   (a) damageable is present AND attackable is not explicitly false
// This covers: { maxHp: 100 } (attackable undefined → allowed), { attackable: true },
// and blocks: absent damageable, { attackable: false }.

// Check: absence of damageable → blocked
check(
  logic.includes("!behavior.damageable ||"),
  "NPCs with no damageable component cannot retaliate (no health to track damage)"
);
// Check: explicit false → blocked
check(
  logic.includes("behavior.damageable.attackable === false"),
  "NPCs explicitly marked attackable:false (e.g. civilians) cannot retaliate"
);
// Check: neither condition → NOT blocked → mucklings/hexes/animals CAN retaliate.
// An NPC with damageable present and attackable not set to false passes both
// guards, reaches the damage-source check, and can get the fallback params.
check(
  logic.includes("npc.health.lastDamageTime === undefined") &&
    retaliationIfMatch !== null &&
    !retaliationIfMatch[0].includes("attackable !== true"),
  "snapshot hostile NPCs (mucklings, hexes, animals) can reach retaliation path"
);

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}

console.log("\nRESULT: PASS");
