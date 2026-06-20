#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const combatPath = path.join(
  root,
  "src/client/components/challenges/LocalDevHarthmereCombat.tsx"
);
const npcsPath = path.join(root, "src/client/game/resources/npcs.ts");
const rendererPath = path.join(
  root,
  "src/client/game/renderers/local_dev/harthmere_assets.ts"
);

function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing file: ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}

const combat = read(combatPath);
const npcs = read(npcsPath);
const renderer = read(rendererPath);
const failures = [];
function pass(name) {
  console.log(`PASS ${name}`);
}
function assert(name, condition) {
  if (condition) pass(name);
  else failures.push(name);
}
function includes(src, text) {
  return src.includes(text);
}
function regex(src, re) {
  return re.test(src);
}

assert(
  "combat current version constant exists",
  includes(combat, "HARTHMERE_NPC_CHASE_REGEN_WANDER")
);
assert(
  "combat current motion event exists",
  includes(combat, "HARTHMERE_NPC_MOTION_EVENT")
);
assert(
  "combat current chase/fight logic marker exists",
  includes(combat, "HARTHMERE_NPC_CHASE_FIGHT_LOGIC")
);
assert(
  "combat imports the 28m line-of-sight range contract",
  includes(combat, "HARTHMERE_LOCAL_COMBAT_LINE_OF_SIGHT_RANGE")
);
assert(
  "combat emits chase motion when NPC is pursuing player",
  includes(combat, "emitHarthmereNpcCombatPressureMotion") &&
    includes(combat, "pursuing_until_actual_range")
);
assert(
  "combat emits immediate retaliation chase pressure after player hits hostile NPCs",
  includes(combat, "maybeEmitHarthmereNpcRetaliationPressure") &&
    includes(combat, "player_hit_aggro_chase")
);
assert(
  "combat keeps hostile NPCs chasing after an instant counterattack",
  includes(combat, "counterattack_keep_chasing")
);
assert(
  "combat emits chase/face pulse before windup attack",
  regex(
    combat,
    /emitHarthmereVoxelNpcMotion\([\s\S]*?offset,[\s\S]*?npc,[\s\S]*?"chase",[\s\S]*?"windup_face_player"/
  )
);
assert(
  "combat keeps movement pressure alive during cooldown/recovery",
  includes(combat, "recovering_keep_pressure") &&
    includes(combat, "cooldown_keep_pressure")
);
assert(
  "combat investigates last known player position after losing sight",
  includes(combat, "lost_sight_investigate_last_known")
);
assert(
  "combat treats 28m sight as the hostile pursuit envelope",
  regex(
    combat,
    /const sightRange = HARTHMERE_LOCAL_COMBAT_LINE_OF_SIGHT_RANGE;[\s\S]*?const chaseReach = profile\.keepFighting[\s\S]*?\? sightRange/
  )
);
assert(
  "combat labels player exits beyond the 28m sight band",
  includes(combat, "outside_sight_range")
);
assert(
  "combat stores chase motion in browser global",
  includes(combat, "__harthmereVoxelNpcMotion")
);
assert(
  "combat dispatches current motion custom event",
  includes(combat, "new CustomEvent(HARTHMERE_NPC_MOTION_EVENT")
);
assert(
  "combat reads voxel motion actor positions for hit/range checks",
  includes(combat, "__harthmereVoxelNpcMotionActorPositions")
);
assert(
  "combat has health recharge tick helper",
  includes(combat, "tickHarthmereNpcHealthRegen")
);
assert(
  "combat health recharge increases hp using clamp(before + amount",
  includes(combat, "clamp(before + amount, 0, npc.maxHp)")
);
assert(
  "combat health recharge is blocked during active aggro",
  includes(combat, "aggroActive || recentlyDamaged")
);
assert(
  "combat health recharge writes debug global",
  includes(combat, "__harthmereNpcHealthRegenLog")
);
assert(
  "combat realtime AI invokes health recharge every tick",
  includes(
    combat,
    "const regen = tickHarthmereNpcHealthRegen(state, now, source)"
  )
);

assert(
  "npc resource current version constant exists",
  includes(npcs, "HARTHMERE_NPC_CHASE_REGEN_WANDER")
);
assert(
  "npc resource has motion override helper",
  includes(npcs, "getHarthmereVoxelNpcMotionOverride")
);
assert(
  "npc resource consumes combat chase motion global",
  includes(npcs, "__harthmereVoxelNpcMotion")
);
assert(
  "npc resource produces chase position movement",
  includes(npcs, 'source: "native_voxel_npc_chase_motion"')
);
assert(
  "npc resource produces ambient wander movement",
  includes(npcs, 'source: "native_voxel_npc_ambient_wander"')
);
assert(
  "npc resource can disable ambient wander with debug global",
  includes(npcs, "__harthmereVoxelNpcAmbientWanderEnabled")
);
assert(
  "npc resource publishes visible motion position to combat registry",
  includes(npcs, "publishHarthmereVoxelNpcMotionActorPosition")
);
assert(
  "npc resource writes voxel motion actor registry",
  includes(npcs, "__harthmereVoxelNpcMotionActorPositions")
);
assert(
  "npc resource applies motion position before interpolation retarget",
  regex(
    npcs,
    /position = harthmereVoxelNpcMotion\.position;[\s\S]*?this\.interpolationNeedRetarget = true;/
  )
);
assert(
  "npc resource applies motion orientation before interpolation retarget",
  regex(
    npcs,
    /orientation = harthmereVoxelNpcMotion\.orientation;[\s\S]*?this\.orientation = \[\.\.\.orientation\]/
  )
);
assert(
  "npc resource does not move dead NPCs with current motion",
  includes(npcs, "!motionOverrides && entity.health.hp > 0")
);

assert(
  "renderer has no current ECS snapshot fallback method reference",
  !includes(renderer, "findCombatLifeByEcsNpcSnapshot")
);
assert(
  "renderer does not use current Harthmere actor fallback constant",
  !includes(renderer, "HARTHMERE_RETALIATION_VISIBLE_FEEDBACK")
);

function simulateChase({ from, target, speed, ageMs, stopDistance }) {
  const dx = target[0] - from[0];
  const dz = target[1] - from[1];
  const distance = Math.hypot(dx, dz);
  const travel = (Math.max(0.6, speed) * Math.max(0, ageMs)) / 1000;
  const maxTravel = Math.max(0, distance - stopDistance);
  const moveDistance = Math.min(maxTravel, travel);
  const ratio = distance > 0 ? moveDistance / distance : 0;
  return [from[0] + dx * ratio, from[1] + dz * ratio];
}
function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
const chaseStart = [0, 0];
const chaseTarget = [10, 0];
const chaseAfter = simulateChase({
  from: chaseStart,
  target: chaseTarget,
  speed: 2,
  ageMs: 1500,
  stopDistance: 2,
});
assert(
  "action test: chase moves NPC closer to player",
  distance(chaseAfter, chaseTarget) < distance(chaseStart, chaseTarget)
);
assert(
  "action test: chase respects stop distance instead of overlapping player",
  distance(
    simulateChase({
      from: chaseStart,
      target: chaseTarget,
      speed: 99,
      ageMs: 5000,
      stopDistance: 2,
    }),
    chaseTarget
  ) >= 1.99
);

function simulateReach({
  distanceToPlayer,
  attackRange = 1.8,
  radius = 1.15,
  aggroActive = true,
  keepFighting = true,
}) {
  const sightRange = 28;
  const baseReach = Math.max(1.15, attackRange) + radius;
  const immediateReach = baseReach + 0.45;
  const profileChaseRange = 21;
  const chaseReach = keepFighting
    ? sightRange
    : Math.min(sightRange, baseReach + profileChaseRange);
  if (distanceToPlayer > sightRange)
    return { canReach: false, canPursue: false, reason: "outside_sight_range" };
  if (distanceToPlayer <= immediateReach)
    return { canReach: true, canPursue: false, reason: "actual_melee_contact" };
  return {
    canReach: false,
    canPursue: aggroActive && distanceToPlayer <= chaseReach,
    reason:
      aggroActive && distanceToPlayer <= chaseReach
        ? "pursuing_until_actual_range"
        : "out_of_chase_range",
  };
}
assert(
  "action test: hostile keeps pursuing out to the 28m sight band",
  simulateReach({ distanceToPlayer: 26.5 }).reason ===
    "pursuing_until_actual_range"
);
assert(
  "action test: hostile stops pursuit beyond the 28m sight band",
  simulateReach({ distanceToPlayer: 28.25 }).reason === "outside_sight_range"
);

function simulateRegen(npc, brain, now) {
  const aggroActive = Boolean(
    brain &&
      brain.aggroUntil > now &&
      !["idle", "disengaged", "dead"].includes(brain.phase)
  );
  const damageDelayMs = npc.behavior === "hostile" ? 4500 : 6500;
  const lastDamageAt = npc.lastDamageAt ?? 0;
  const recentlyDamaged =
    lastDamageAt > 0 && now - lastDamageAt < damageDelayMs;
  if (
    !npc.attackable ||
    npc.hp <= 0 ||
    npc.combatState === "dead" ||
    npc.hp >= npc.maxHp ||
    aggroActive ||
    recentlyDamaged
  ) {
    return npc.hp;
  }
  const basePerTick = Math.max(
    1,
    Math.ceil(npc.maxHp * (npc.behavior === "hostile" ? 0.018 : 0.024))
  );
  return Math.min(npc.maxHp, npc.hp + basePerTick);
}
assert(
  "action test: regen increases damaged out-of-combat NPC hp",
  simulateRegen(
    {
      attackable: true,
      hp: 50,
      maxHp: 100,
      behavior: "hostile",
      combatState: "idle",
      lastDamageAt: 0,
    },
    undefined,
    10000
  ) > 50
);
assert(
  "action test: regen does not heal recently damaged NPC",
  simulateRegen(
    {
      attackable: true,
      hp: 50,
      maxHp: 100,
      behavior: "hostile",
      combatState: "in_combat",
      lastDamageAt: 9000,
    },
    undefined,
    10000
  ) === 50
);
assert(
  "action test: regen does not heal aggro NPC",
  simulateRegen(
    {
      attackable: true,
      hp: 50,
      maxHp: 100,
      behavior: "hostile",
      combatState: "in_combat",
      lastDamageAt: 0,
    },
    { aggroUntil: 20000, phase: "pursuing" },
    10000
  ) === 50
);

function simulateWander(id, base, seconds) {
  let hash = 2166136261;
  const text = String(id ?? "0");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const seed = Math.abs(hash >>> 0);
  const radius = 0.85 + (seed % 220) / 100;
  const period = 9.5 + (seed % 700) / 100;
  const phase = (seed % 6283) / 1000 + seconds / period;
  return [
    base[0] + Math.cos(phase) * radius,
    base[1] + Math.sin(phase * 0.83) * radius * 0.72,
  ];
}
const wanderA = simulateWander("3867217674102759", [5, 5], 100);
const wanderB = simulateWander("3867217674102759", [5, 5], 105);
assert(
  "action test: ambient wander changes NPC position over time",
  distance(wanderA, wanderB) > 0.05
);
assert(
  "action test: ambient wander remains near spawn instead of teleporting",
  distance(wanderA, [5, 5]) < 4.0 && distance(wanderB, [5, 5]) < 4.0
);

if (failures.length) {
  console.error("\nFAILURES");
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log(
  "\nAll current NPC chase / health recharge / ambient wander checks passed."
);
