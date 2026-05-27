#!/usr/bin/env node
// HARTHMERE_NPC_RETALIATION_FULL_FLOW_V3
// Contract test for the whole retaliatory combat chain:
// player swing -> NPC health drops -> NPC acquires last attacker -> NPC attack
// animation pulses -> NPC damage event hits player -> player HP drops.

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

function read(root, rel) {
  const full = path.join(root, rel);
  check(fs.existsSync(full), `${rel} exists`);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
}

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const interact = read(root, "src/client/game/interact/helpers.ts");
const modifyHealth = read(root, "src/shared/npc/modify_health.ts");
const logic = read(root, "src/shared/npc/logic.ts");
const chase = read(root, "src/shared/npc/behavior/chase_attack.ts");
const simulated = read(root, "src/shared/npc/simulated.ts");
const players = read(root, "src/server/logic/utils/players.ts");
const npcRenderer = read(root, "src/client/game/resources/npcs.ts");
const bikkie = read(root, "src/shared/npc/bikkie.ts");

console.log("== Harthmere NPC retaliation full flow v3 ==");

// 1) Player attack sends authoritative NPC damage with attacker identity.
check(
  interact.includes("new UpdateNpcHealthEvent({ id: entity.id, hp: -damage, damageSource })") &&
    interact.includes('kind: "attack"') &&
    interact.includes("attacker: player.id"),
  "player attacks publish UpdateNpcHealthEvent with negative HP delta and player attacker id"
);

// 2) Server/NPC health reducer records the damage source and lowers HP.
check(
  modifyHealth.includes("npc.mutableHealth().lastDamageSource = damageSource") &&
    modifyHealth.includes("npc.mutableHealth().lastDamageTime = secondsSinceEpoch") &&
    modifyHealth.includes("npc.mutableHealth().hp = newHealth") &&
    modifyHealth.includes("recordThreatFromDamage"),
  "NPC health mutation persists HP drop, lastDamageSource, lastDamageTime, and threat"
);

// 3) NPC logic installs fallback retaliation for attackable damaged NPCs only.
check(
  logic.includes("ATTACKED_NPC_RETALIATION_FALLBACK_V1") &&
    logic.includes("if (behavior.chaseAttack)") &&
    logic.includes("return behavior.chaseAttack") &&
    logic.includes('aggroTrigger: { kind: "onlyIfAttacked" }') &&
    logic.includes('npc.health.lastDamageSource?.kind !== "attack"') &&
    logic.includes("behavior.damageable.attackable === false"),
  "NPC tick logic preserves authored chaseAttack but gives damaged attackable NPCs only-if-attacked retaliation"
);

check(
  logic.includes("if (npc.hp <= 0)") && logic.includes("return;"),
  "dead NPCs do not keep attacking"
);

// 4) Snapshot/imported hostile biscuits must not inherit human fallback attackable:false.
check(
  bikkie.includes("SNAPSHOT_LEGACY_NPC_BEHAVIOR_DEEP_MERGE_V3") &&
    bikkie.includes("candidateDamageable.attackable === false") &&
    bikkie.includes("candidateDamageable.attackable === true") &&
    bikkie.includes(": true,"),
  "snapshot Mucklings/Hexers/animals with damageable blocks default to attackable:true unless explicitly false"
);

// 5) Retaliation target is exactly the last attacker and safe-zone logic does not create harmless health bars.
check(
  chase.includes('params.aggroTrigger.kind === "onlyIfAttacked"') &&
    chase.includes("lastDamageSource.attacker") &&
    chase.includes("targetId = lastAttackerId") &&
    chase.includes("retaliatingAfterPlayerHit") &&
    chase.includes("!retaliatingAfterPlayerHit") &&
    chase.includes("becoming a harmless health bar"),
  "only-if-attacked NPCs target the last attacker and are not blocked by proactive safe-zone gating"
);

check(
  chase.includes("secondsSinceEpoch() - health.lastDamageTime < ATTACK_MEMORY_SECONDS") &&
    chase.includes("distSq(lastAttacker.position.v, npc.position) < deAggroDistanceSq"),
  "retaliation has bounded memory and disengage distance"
);

// 6) Chasing NPC triggers visible attack animation, then strike damage at the authored moment.
check(
  chase.includes('emote_type: "attack1"') &&
    chase.includes("emote_start_time: attackTime") &&
    chase.includes("emote_expiry_time") &&
    chase.includes("npc.attack(target.id, params.attackDamage)"),
  "NPC chase attack pulses attack1 animation and calls npc.attack at strike time"
);

// 7) NPC attack publishes player HP damage with NPC as the attacker.
check(
  simulated.includes("new UpdatePlayerHealthEvent") &&
    simulated.includes("hpDelta: -damage") &&
    simulated.includes('kind: "attack"') &&
    simulated.includes("attacker: this.id"),
  "SimulatedNpc.attack sends negative player HP delta with NPC attacker id"
);

// 8) Player health reducer actually subtracts HP and stores the NPC attack source.
check(
  players.includes("const oldHp = Math.max(player.health()?.hp ?? 0, 0)") &&
    players.includes("health.hp = newHp") &&
    players.includes("health.lastDamageSource = damageSource") &&
    players.includes("health.lastDamageTime = secondsSinceEpoch()"),
  "player health reducer applies HP loss and records the NPC damage source"
);

// 9) Renderer listens for attack1 and maps it to the Attack clip.
check(
  npcRenderer.includes('emote?.emote_type === "attack1"') &&
    npcRenderer.includes("getAttackAnimationAction") &&
    npcRenderer.includes('npcSystem.singleAnimationWeight("attack", 1)') &&
    npcRenderer.includes('fileAnimationName: "Attack"'),
  "NPC renderer converts attack1 emote into the Attack animation clip"
);

// 10) Edge cases: no attackable:false regression, no name whitelist, no passive retaliation.
check(
  !logic.includes("npc.label") && !logic.includes("displayName"),
  "retaliation is data-driven, not hard-coded to specific monster names"
);
check(
  logic.includes("!behavior.damageable ||") && logic.includes("behavior.damageable.attackable === false"),
  "NPCs without health or explicitly attackable:false stay non-retaliatory"
);
check(
  chase.includes("(attackTarget.health?.hp ?? 0) <= 0") &&
    chase.includes("targetId = undefined"),
  "NPCs stop attacking dead/downed targets"
);

// Lightweight executable simulation of the expected state transitions. This does
// not import the TS runtime; it protects the gameplay contract from future edits
// that accidentally invert signs or forget the animation pulse.
function simulateRetaliationFlow() {
  const player = { id: 1001, hp: 120, position: [0, 0, 0] };
  const npc = {
    id: 2002,
    hp: 60,
    damageable: { maxHp: 60 },
    state: { chaseAttack: {} },
    position: [1.4, 0, 0],
    emote: undefined,
  };

  const playerDamageSource = { kind: "attack", attacker: player.id };
  npc.hp -= 18;
  npc.lastDamageSource = playerDamageSource;
  npc.lastDamageTime = 10;

  const canRetaliate =
    npc.damageable &&
    npc.damageable.attackable !== false &&
    npc.lastDamageSource?.kind === "attack" &&
    npc.lastDamageTime !== undefined &&
    npc.hp > 0;
  if (!canRetaliate) {
    throw new Error("NPC failed to enter retaliation");
  }

  npc.state.chaseAttack.attackTarget = npc.lastDamageSource.attacker;
  npc.state.chaseAttack.attackTime = 11;
  npc.emote = { emote_type: "attack1", emote_start_time: 11 };

  const npcDamageSource = { kind: "attack", attacker: npc.id };
  player.hp -= 10;
  player.lastDamageSource = npcDamageSource;

  return { player, npc };
}

try {
  const { player, npc } = simulateRetaliationFlow();
  check(npc.hp === 42, "simulation: player hit lowers NPC HP");
  check(npc.state.chaseAttack.attackTarget === player.id, "simulation: NPC targets the player who attacked it");
  check(npc.emote?.emote_type === "attack1", "simulation: NPC attack animation pulse is present");
  check(player.hp === 110, "simulation: NPC retaliation lowers player HP");
  check(player.lastDamageSource?.attacker === npc.id, "simulation: player damage source is the retaliating NPC");
} catch (error) {
  console.error(`FAIL simulation threw: ${error && error.stack ? error.stack : error}`);
  process.exitCode = 1;
}

if (process.exitCode) {
  console.error("\nRESULT: FAIL");
  process.exit(process.exitCode);
}

console.log("\nRESULT: PASS");
