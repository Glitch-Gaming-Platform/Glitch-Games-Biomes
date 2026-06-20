// HARTHMERE_COMBAT_AI_TESTS:
// Self-contained combat-system test suite. Designed to run without the full
// server bootstrap so we can verify the AI retaliation, threat-table, and
// projectile/swing collateral logic in isolation.
//
// To run:
//   npx ts-node --transpile-only -P tsconfig.json \
//     src/shared/npc/combat_ai_tests.ts
//
// References:
//   MMO_RULES.txt sections 37 (Death/Threat), 42 (Threat & Aggro), 46 (Server
//   Death Pipeline), 51 (NPC Level data structure), and the AOE/projectile
//   guidance throughout the combat rules.

import assert from "assert";

import {
  addThreat,
  decayThreat,
  THREAT_DECAY_INTERVAL,
  THREAT_PER_DAMAGE_DEALT,
  topThreat,
  type ThreatTable,
} from "@/shared/npc/threat";
import type { BiomesId } from "@/shared/ids";
import {
  ATTACK_MEMORY_SECONDS,
  evaluateRetaliationTarget,
  type RetaliationDecisionInputs,
} from "@/shared/npc/behavior/chase_attack";
import {
  applyProjectileHitPolicy,
  entitiesInProjectilePath,
  entitiesInSwingArc,
  expandSwingHitsAroundPrimary,
  rayAabbIntersection,
  type CollidableEntity,
} from "@/shared/npc/combat_collateral_hits";

// ---------------------------------------------------------------------------
// Lightweight test harness
// ---------------------------------------------------------------------------

interface TestRecord {
  name: string;
  pass: boolean;
  error?: unknown;
}

const results: TestRecord[] = [];

function test(name: string, body: () => void) {
  try {
    body();
    results.push({ name, pass: true });
    // eslint-disable-next-line no-console
    console.log(`  ok  ${name}`);
  } catch (error) {
    results.push({ name, pass: false, error });
    // eslint-disable-next-line no-console
    console.error(`  FAIL ${name}`);
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

function section(title: string) {
  // eslint-disable-next-line no-console
  console.log(`\n# ${title}`);
}

// ---------------------------------------------------------------------------
// Retaliation decision tests
// ---------------------------------------------------------------------------

section("Retaliation decision (evaluateRetaliationTarget)");

const PLAYER_ID = 1001 as BiomesId;
const SECOND_PLAYER_ID = 1002 as BiomesId;

type RetalInputBuilder = Partial<RetaliationDecisionInputs>;

function makeInputs(over: RetalInputBuilder = {}): RetaliationDecisionInputs {
  const now = 1_000_000;
  const defaults: RetaliationDecisionInputs = {
    lastDamageSource: { kind: "attack", attacker: PLAYER_ID },
    lastDamageTime: now - 1,
    npcPosition: [0, 0, 0],
    deAggroDistanceSq: 24 * 24,
    lookupEntity: (id) =>
      id === PLAYER_ID
        ? { position: { v: [3, 0, 0] }, health: { hp: 80 } }
        : id === SECOND_PLAYER_ID
        ? { position: { v: [4, 0, 0] }, health: { hp: 80 } }
        : undefined,
    now,
    memorySeconds: ATTACK_MEMORY_SECONDS,
  };
  return { ...defaults, ...over };
}

test("Recent attack within memory window → attacker is retaliation target", () => {
  const target = evaluateRetaliationTarget(makeInputs());
  assert.strictEqual(target, PLAYER_ID);
});

test("Attack older than memory window → no retaliation", () => {
  const target = evaluateRetaliationTarget(
    makeInputs({ lastDamageTime: 1_000_000 - ATTACK_MEMORY_SECONDS - 5 })
  );
  assert.strictEqual(target, undefined);
});

test("No damage source → no retaliation", () => {
  const target = evaluateRetaliationTarget(
    makeInputs({ lastDamageSource: undefined })
  );
  assert.strictEqual(target, undefined);
});

test("Non-attack damage (fall, environment) → no retaliation", () => {
  const target = evaluateRetaliationTarget(
    makeInputs({
      lastDamageSource: { kind: "fall", attacker: PLAYER_ID } as any,
    })
  );
  assert.strictEqual(
    target,
    undefined,
    "Only `attack` damage sources should drive retaliation"
  );
});

test("Attacker beyond leash distance → drop target", () => {
  const target = evaluateRetaliationTarget(
    makeInputs({
      lookupEntity: () => ({
        position: { v: [100, 0, 0] },
        health: { hp: 80 },
      }),
    })
  );
  assert.strictEqual(
    target,
    undefined,
    "Attacker outside disengage distance must not be chased"
  );
});

test("Attacker is dead → drop target", () => {
  const target = evaluateRetaliationTarget(
    makeInputs({
      lookupEntity: () => ({ position: { v: [3, 0, 0] }, health: { hp: 0 } }),
    })
  );
  assert.strictEqual(
    target,
    undefined,
    "Dead attacker must not remain a retaliation target (Rule 37)"
  );
});

test("Attacker entity missing position → no target", () => {
  const target = evaluateRetaliationTarget(
    makeInputs({ lookupEntity: () => ({ health: { hp: 50 } }) })
  );
  assert.strictEqual(target, undefined);
});

test("Attacker entity not found → no target", () => {
  const target = evaluateRetaliationTarget(
    makeInputs({ lookupEntity: () => undefined })
  );
  assert.strictEqual(target, undefined);
});

test("Right on edge of leash (exactly disengageDistance) → drop (strict <)", () => {
  const target = evaluateRetaliationTarget(
    makeInputs({
      deAggroDistanceSq: 9,
      lookupEntity: () => ({
        position: { v: [3, 0, 0] },
        health: { hp: 80 },
      }),
    })
  );
  assert.strictEqual(target, undefined);
});

test("Memory boundary: hit at exactly memorySeconds ago → forgotten", () => {
  const target = evaluateRetaliationTarget(
    makeInputs({ lastDamageTime: 1_000_000 - ATTACK_MEMORY_SECONDS })
  );
  assert.strictEqual(target, undefined);
});

test("Memory boundary: hit just inside the window → remembered", () => {
  const target = evaluateRetaliationTarget(
    makeInputs({ lastDamageTime: 1_000_000 - ATTACK_MEMORY_SECONDS + 1 })
  );
  assert.strictEqual(target, PLAYER_ID);
});

test("Multi-attacker: last hit decides retaliation memory", () => {
  // chase_attack tracks the *latest* attacker. Threat tables track full
  // history; the chase target is the most recent commitment.
  const target = evaluateRetaliationTarget(
    makeInputs({
      lastDamageSource: { kind: "attack", attacker: SECOND_PLAYER_ID },
      lookupEntity: (id) =>
        id === SECOND_PLAYER_ID
          ? { position: { v: [4, 0, 0] }, health: { hp: 80 } }
          : undefined,
    })
  );
  assert.strictEqual(target, SECOND_PLAYER_ID);
});

test("Safe-zone retaliation fix: a recent attacker is still valid", () => {
  // The pure function ignores safe-zone state (that's checked separately in
  // updateAttackTarget). This test documents that the retaliation decision
  // itself does not care about wards/quest-givers — the fix in
  // updateAttackTarget threads this result *past* the safe-zone gate.
  const target = evaluateRetaliationTarget(makeInputs());
  assert.strictEqual(target, PLAYER_ID);
});

// ---------------------------------------------------------------------------
// Threat table tests
// ---------------------------------------------------------------------------

section("Threat table mechanics");

test("addThreat accumulates positive threat", () => {
  const table: ThreatTable = {};
  addThreat(table, PLAYER_ID, 10);
  addThreat(table, PLAYER_ID, 5);
  assert.strictEqual(table[String(PLAYER_ID)], 15);
});

test("addThreat with negative amount cleans up zero entries", () => {
  const table: ThreatTable = {};
  addThreat(table, PLAYER_ID, 10);
  addThreat(table, PLAYER_ID, -15);
  assert.strictEqual(
    table[String(PLAYER_ID)],
    undefined,
    "Entries that drop to <= 0 must be removed (no negative threat)"
  );
});

test("topThreat picks the highest contributor", () => {
  const table: ThreatTable = {};
  addThreat(table, PLAYER_ID, 10);
  addThreat(table, SECOND_PLAYER_ID, 25);
  assert.strictEqual(topThreat(table), SECOND_PLAYER_ID);
});

test("topThreat returns undefined for empty table (NPC resets)", () => {
  const table: ThreatTable = {};
  assert.strictEqual(topThreat(table), undefined);
});

test("decayThreat fades threat over time", () => {
  const table: ThreatTable = {};
  addThreat(table, PLAYER_ID, 50);
  const t0 = 0;
  const t1 = THREAT_DECAY_INTERVAL * 4;
  const newLast = decayThreat(table, t1, t0);
  assert.ok(table[String(PLAYER_ID)] < 50, "threat should decay");
  assert.strictEqual(newLast, t1);
});

test("decayThreat removes zeroed entries", () => {
  const table: ThreatTable = {};
  addThreat(table, PLAYER_ID, 1);
  decayThreat(table, 100, 0); // huge dt → fully decay
  assert.strictEqual(
    table[String(PLAYER_ID)],
    undefined,
    "Fully decayed entries should be removed so NPC resets per rule"
  );
});

test("Damage threat scales by amount (THREAT_PER_DAMAGE_DEALT)", () => {
  const table: ThreatTable = {};
  addThreat(table, PLAYER_ID, 30 * THREAT_PER_DAMAGE_DEALT);
  assert.strictEqual(table[String(PLAYER_ID)], 30 * THREAT_PER_DAMAGE_DEALT);
});

test("Threat preserves relative ordering across two attackers", () => {
  const table: ThreatTable = {};
  addThreat(table, PLAYER_ID, 20);
  addThreat(table, SECOND_PLAYER_ID, 40);
  decayThreat(table, THREAT_DECAY_INTERVAL * 2, 0);
  // Both decayed equally; PLAYER_ID should still be lower than SECOND_PLAYER_ID
  assert.strictEqual(topThreat(table), SECOND_PLAYER_ID);
});

// ---------------------------------------------------------------------------
// Projectile collateral tests
// ---------------------------------------------------------------------------

section("Projectile path hits");

interface FakeCollideable extends CollidableEntity<string> {
  id: string;
  aabb: [[number, number, number], [number, number, number]];
}

function entity(id: string, center: [number, number, number]): FakeCollideable {
  return {
    id,
    aabb: [
      [center[0] - 0.5, center[1] - 0.9, center[2] - 0.5],
      [center[0] + 0.5, center[1] + 0.9, center[2] + 0.5],
    ],
  };
}

test("rayAabbIntersection: direct hit at expected distance", () => {
  const t = rayAabbIntersection(
    [0, 0, 0],
    [1, 0, 0],
    [
      [4, -1, -1],
      [6, 1, 1],
    ],
    100
  );
  assert.ok(t !== undefined && Math.abs(t - 4) < 1e-6);
});

test("rayAabbIntersection: miss returns undefined", () => {
  const t = rayAabbIntersection(
    [0, 0, 0],
    [1, 0, 0],
    [
      [4, 10, -1],
      [6, 12, 1],
    ],
    100
  );
  assert.strictEqual(t, undefined);
});

test("rayAabbIntersection: respects maxDistance", () => {
  const t = rayAabbIntersection(
    [0, 0, 0],
    [1, 0, 0],
    [
      [50, -1, -1],
      [52, 1, 1],
    ],
    10
  );
  assert.strictEqual(t, undefined, "Past-range targets are not hit");
});

test("Projectile pierces all entities in path", () => {
  const targets = [
    entity("a", [3, 0, 0]),
    entity("b", [6, 0, 0]),
    entity("c", [9, 0, 0]),
    entity("d", [3, 0, 9]), // off-line
  ];
  const hits = entitiesInProjectilePath(
    { origin: [0, 0, 0], direction: [1, 0, 0], maxDistance: 20 },
    targets
  );
  assert.deepStrictEqual(
    hits.map((h) => h.entity.id),
    ["a", "b", "c"],
    "Projectile should hit every entity along its path in distance order"
  );
});

test("Projectile honors radius for AOE projectiles", () => {
  const targets = [
    entity("a", [5, 0, 1.4]), // 1.4 z off but within +radius
    entity("b", [5, 0, 5]),
  ];
  const hits = entitiesInProjectilePath(
    { origin: [0, 0, 0], direction: [1, 0, 0], maxDistance: 20, radius: 1.0 },
    targets
  );
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].entity.id, "a");
});

test("Projectile path: zero direction is handled defensively", () => {
  const t = rayAabbIntersection(
    [0, 0, 0],
    [0, 0, 0],
    [
      [-1, -1, -1],
      [1, 1, 1],
    ],
    10
  );
  assert.strictEqual(t, 0, "Origin inside AABB returns 0");
});

test("Projectile path: backwards-pointing projectile cannot hit forward target", () => {
  const hits = entitiesInProjectilePath(
    { origin: [0, 0, 0], direction: [-1, 0, 0], maxDistance: 20 },
    [entity("a", [3, 0, 0])]
  );
  assert.strictEqual(hits.length, 0);
});

test("stopOnFirst policy only damages closest", () => {
  const hits = [
    { entity: entity("a", [3, 0, 0]), distance: 3 },
    { entity: entity("b", [5, 0, 0]), distance: 5 },
  ];
  const trimmed = applyProjectileHitPolicy(hits, "stopOnFirst");
  assert.deepStrictEqual(trimmed.map((h) => h.entity.id), ["a"]);
});

test("pierce policy keeps all hits", () => {
  const hits = [
    { entity: entity("a", [3, 0, 0]), distance: 3 },
    { entity: entity("b", [5, 0, 0]), distance: 5 },
  ];
  const trimmed = applyProjectileHitPolicy(hits, "pierce");
  assert.strictEqual(trimmed.length, 2);
});

// ---------------------------------------------------------------------------
// Swing AOE tests — the "swings can hit anyone, even non-targeted" rule
// ---------------------------------------------------------------------------

section("Swing arc AOE");

test("Swing hits primary target", () => {
  const swing = {
    origin: [0, 0.9, 0] as [number, number, number],
    forward: [1, 0, 0] as [number, number, number],
    reach: 3,
    halfAngleRad: Math.PI / 3,
  };
  const hits = entitiesInSwingArc(swing, [entity("a", [2, 0.9, 0])]);
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].id, "a");
});

test("Swing hits collateral entity in arc, even if not targeted", () => {
  const swing = {
    origin: [0, 0.9, 0] as [number, number, number],
    forward: [1, 0, 0] as [number, number, number],
    reach: 3,
    halfAngleRad: Math.PI / 3,
  };
  // Untargeted bystander in the cone.
  const hits = entitiesInSwingArc(swing, [
    entity("targeted", [2, 0.9, 0]),
    entity("bystander", [2, 0.9, 1]),
  ]);
  assert.strictEqual(hits.length, 2);
});

test("Swing misses entity behind the swinger", () => {
  const swing = {
    origin: [0, 0.9, 0] as [number, number, number],
    forward: [1, 0, 0] as [number, number, number],
    reach: 3,
    halfAngleRad: Math.PI / 3,
  };
  const hits = entitiesInSwingArc(swing, [entity("behind", [-2, 0.9, 0])]);
  assert.strictEqual(hits.length, 0);
});

test("Swing misses entity beyond reach", () => {
  const swing = {
    origin: [0, 0.9, 0] as [number, number, number],
    forward: [1, 0, 0] as [number, number, number],
    reach: 3,
    halfAngleRad: Math.PI / 3,
  };
  const hits = entitiesInSwingArc(swing, [entity("far", [10, 0.9, 0])]);
  assert.strictEqual(hits.length, 0);
});

test("Swing arc respects half-angle: wide cone hits side, narrow cone misses", () => {
  const wide = {
    origin: [0, 0.9, 0] as [number, number, number],
    forward: [1, 0, 0] as [number, number, number],
    reach: 3,
    halfAngleRad: Math.PI / 2,
  };
  const narrow = { ...wide, halfAngleRad: Math.PI / 12 };
  const side = entity("side", [1.5, 0.9, 1.5]);
  assert.strictEqual(entitiesInSwingArc(wide, [side]).length, 1);
  assert.strictEqual(entitiesInSwingArc(narrow, [side]).length, 0);
});

test("expandSwingHitsAroundPrimary unions primary with collateral", () => {
  const swing = {
    origin: [0, 0.9, 0] as [number, number, number],
    forward: [1, 0, 0] as [number, number, number],
    reach: 3,
    halfAngleRad: Math.PI / 3,
  };
  const primary = entity("primary", [2, 0.9, 0]);
  const bystander = entity("bystander", [2, 0.9, 1]);
  const result = expandSwingHitsAroundPrimary(swing, primary, [
    primary,
    bystander,
  ]);
  assert.deepStrictEqual(
    result.map((e) => e.id),
    ["primary", "bystander"]
  );
});

test("expandSwingHitsAroundPrimary deduplicates when primary is also in cone scan", () => {
  const swing = {
    origin: [0, 0.9, 0] as [number, number, number],
    forward: [1, 0, 0] as [number, number, number],
    reach: 3,
    halfAngleRad: Math.PI / 3,
  };
  const primary = entity("primary", [2, 0.9, 0]);
  const result = expandSwingHitsAroundPrimary(swing, primary, [primary]);
  assert.strictEqual(result.length, 1, "primary must not appear twice");
});

test("expandSwingHitsAroundPrimary returns primary even when no candidates supplied", () => {
  const swing = {
    origin: [0, 0.9, 0] as [number, number, number],
    forward: [1, 0, 0] as [number, number, number],
    reach: 3,
    halfAngleRad: Math.PI / 3,
  };
  const primary = entity("primary", [2, 0.9, 0]);
  const result = expandSwingHitsAroundPrimary(swing, primary, []);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, "primary");
});

test("Swing hits short target with vertical cushion", () => {
  // A target whose AABB tops out at y=0.4 (e.g. a Muckling) while the swinger
  // strikes from y=1.5. With the default cushion the hit still registers.
  const swing = {
    origin: [0, 1.5, 0] as [number, number, number],
    forward: [1, 0, 0] as [number, number, number],
    reach: 3,
    halfAngleRad: Math.PI / 3,
  };
  const muckling: FakeCollideable = {
    id: "muckling",
    aabb: [
      [1.5, -0.4, -0.4],
      [2.5, 0.4, 0.4],
    ],
  };
  assert.strictEqual(entitiesInSwingArc(swing, [muckling]).length, 1);
});

test("Swing skips entities far above/below the strike plane", () => {
  // A floating Hexer drifting 10 voxels above the swinger should not be hit
  // by a ground-level horizontal swing.
  const swing = {
    origin: [0, 0.9, 0] as [number, number, number],
    forward: [1, 0, 0] as [number, number, number],
    reach: 3,
    halfAngleRad: Math.PI / 3,
  };
  const floater: FakeCollideable = {
    id: "floating_hex",
    aabb: [
      [1.5, 10, -0.4],
      [2.5, 11, 0.4],
    ],
  };
  assert.strictEqual(entitiesInSwingArc(swing, [floater]).length, 0);
});

// ---------------------------------------------------------------------------
// Edge cases that combine systems
// ---------------------------------------------------------------------------

section("Combined / edge cases");

test("Dead NPC still in path is filtered by caller", () => {
  // Simulates a projectile that streams through a previously dead Muckling.
  const dead: FakeCollideable & { hp: number } = {
    id: "dead_muckling",
    aabb: [
      [1.5, -0.4, -0.4],
      [2.5, 0.4, 0.4],
    ],
    hp: 0,
  };
  const alive: FakeCollideable & { hp: number } = {
    id: "alive_hexer",
    aabb: [
      [5.5, 0, -0.4],
      [6.5, 1.6, 0.4],
    ],
    hp: 40,
  };
  const hits = entitiesInProjectilePath(
    { origin: [0, 0.4, 0], direction: [1, 0, 0], maxDistance: 20 },
    [dead, alive]
  );
  // Caller filters dead entities.
  const damageable = hits.filter((h) => (h.entity as any).hp > 0);
  assert.strictEqual(damageable.length, 1);
  assert.strictEqual(damageable[0].entity.id, "alive_hexer");
});

test("Friendly fire: collateral entity gets included regardless of faction", () => {
  // The hit detection itself is faction-blind. Callers (peace buffs, PVP ACL)
  // are responsible for filtering. This test pins that behavior.
  const swing = {
    origin: [0, 0.9, 0] as [number, number, number],
    forward: [1, 0, 0] as [number, number, number],
    reach: 3,
    halfAngleRad: Math.PI / 3,
  };
  const allyMuckling = entity("ally_muckling", [2, 0.9, 0.4]);
  const targetHex = entity("hexer", [2, 0.9, -0.4]);
  const hits = entitiesInSwingArc(swing, [allyMuckling, targetHex]);
  assert.strictEqual(
    hits.length,
    2,
    "Swing arc returns ALL entities in cone; faction policy is applied upstream"
  );
});

test("Long-range projectile cannot retroactively hit closer entity after the first stop", () => {
  const targets = [entity("a", [3, 0, 0]), entity("b", [9, 0, 0])];
  const hits = entitiesInProjectilePath(
    { origin: [0, 0, 0], direction: [1, 0, 0], maxDistance: 20 },
    targets
  );
  const stop = applyProjectileHitPolicy(hits, "stopOnFirst");
  assert.strictEqual(stop.length, 1);
  assert.strictEqual(stop[0].entity.id, "a");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const failed = results.filter((r) => !r.pass).length;
const passed = results.filter((r) => r.pass).length;
// eslint-disable-next-line no-console
console.log(`\n${passed}/${results.length} tests passed (${failed} failed)`);
if (failed > 0) {
  process.exit(1);
}
