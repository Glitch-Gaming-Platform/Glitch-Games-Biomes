import type { DeltaWith } from "@/shared/ecs/gen/delta";
import type { OptionalDamageSource } from "@/shared/ecs/gen/types";
import { NpcState } from "@/shared/ecs/gen/components";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { createCounter } from "@/shared/metrics/metrics";
import type { NpcType } from "@/shared/npc/bikkie";
import { idToNpcType } from "@/shared/npc/bikkie";
import { deserializeNpcCustomState, serializeNpcCustomState } from "@/shared/npc/serde";
import { THREAT_PER_DAMAGE_DEALT, addThreat } from "@/shared/npc/threat";

const npcDeaths = createCounter({
  name: "npc_deaths",
  help: "Number of NPC deaths.",
  labelNames: ["type", "reason"],
});

// How long the entity will persist after dying, before it is set to expire.
// We want there to be enough time to ensure that clients can play through
// any death animations and effects.
const NPC_CORPSE_LINGER_SECS = 90;
const NPC_DEFAULT_RESPAWN_SECS = 5 * 60;

export function killNpc(
  npc: DeltaWith<"health" | "npc_metadata" | "rigid_body" | "position">,
  damageSource: OptionalDamageSource,
  secondsSinceEpoch: number
) {
  modifyNpcHealth(npc, 0, damageSource, secondsSinceEpoch);
}

export function modifyNpcHealth(
  npc: DeltaWith<"health" | "npc_metadata" | "rigid_body" | "position">,
  newHealth: number,
  damageSource: OptionalDamageSource,
  secondsSinceEpoch: number
) {
  const npcTypeId = npc.npcMetadata().type_id;
  const npcType = idToNpcType(npcTypeId);

  if (npc.health().hp <= 0 || npc.health().hp === newHealth) {
    return;
  }

  const previousHp = npc.health().hp;
  npc.mutableHealth().lastDamageSource = damageSource;
  npc.mutableHealth().lastDamageTime = secondsSinceEpoch;
  npc.mutableHealth().lastDamageAmount = newHealth - npc.health().hp;
  npc.mutableHealth().hp = newHealth;

  recordThreatFromDamage(npc, previousHp, newHealth, damageSource);

  if (npc.health().hp > 0) {
    return;
  }

  onNpcDeath(npc, damageSource, secondsSinceEpoch, npcType);
}

function onNpcDeath(
  npc: DeltaWith<"health" | "npc_metadata" | "rigid_body" | "position">,
  damageSource: OptionalDamageSource,
  secondsSinceEpoch: number,
  npcType: NpcType
) {
  // Handle death of the NPC.
  const npcTypeName = npcType.name;

  // Another one bites the dust.
  const deathReasonText =
    damageSource?.kind === "npc"
      ? `npc/${damageSource.type.kind}`
      : damageSource === undefined
      ? "undefined"
      : damageSource.kind;
  npcDeaths.inc({
    type: npcTypeName,
    reason: deathReasonText,
  });

  log.debug(
    `NPC id "${npc.id}" (${npcTypeName}) has died (reason: "${deathReasonText}").`
  );

  // Reset their expiry to be much sooner, to clean up the
  // no-longer-active NPC.
  npc.setRigidBody({ velocity: [0, 0, 0] });

  const newExpiryTime = secondsSinceEpoch + NPC_CORPSE_LINGER_SECS;
  if (!npc.expires() || npc.expires()!.trigger_at > newExpiryTime) {
    npc.mutableExpires().trigger_at = newExpiryTime;
  }

  scheduleNpcRespawnIfPersistent(npc, npcType, secondsSinceEpoch);
}

type RespawnEntry = {
  typeId: BiomesId;
  spawnPosition: [number, number, number];
  spawnOrientation?: [number, number];
  respawnAt: number;
  previousId: BiomesId;
};

let respawnEnqueue: ((entry: RespawnEntry) => void) | undefined;

export function setNpcRespawnEnqueue(fn: typeof respawnEnqueue) {
  respawnEnqueue = fn;
}

function scheduleNpcRespawnIfPersistent(
  npc: DeltaWith<"npc_metadata" | "position">,
  npcType: NpcType,
  secondsSinceEpoch: number
) {
  const respawnAfter =
    (npcType as any).respawnAfterSecs ?? NPC_DEFAULT_RESPAWN_SECS;
  const wantsRespawn =
    (npcType as any).persistent === true ||
    (npcType as any).respawnAfterSecs !== undefined ||
    (npcType as any).preferredAnchorType !== undefined ||
    (npcType as any).role === "merchant" ||
    (npcType as any).role === "blacksmith" ||
    (npcType as any).role === "innkeeper" ||
    (npcType as any).role === "guard";
  if (!wantsRespawn) {
    return;
  }
  respawnEnqueue?.({
    typeId: npc.npcMetadata().type_id,
    spawnPosition: [...npc.position().v] as [number, number, number],
    spawnOrientation: npc.npcMetadata().spawn_orientation
      ? ([...npc.npcMetadata().spawn_orientation] as [number, number])
      : undefined,
    respawnAt: secondsSinceEpoch + respawnAfter,
    previousId: npc.id,
  });
}

function recordThreatFromDamage(
  npc: DeltaWith<"health" | "npc_metadata" | "rigid_body" | "position">,
  previousHp: number,
  newHp: number,
  damageSource: OptionalDamageSource
) {
  const damage = Math.max(0, previousHp - newHp);
  if (damage <= 0 || damageSource?.kind !== "attack") {
    return;
  }
  try {
    const anyNpc = npc as any;
    const decoded = deserializeNpcCustomState(anyNpc.npcState?.()?.data);
    decoded.threat ??= { table: {} };
    addThreat(decoded.threat.table, damageSource.attacker, damage * THREAT_PER_DAMAGE_DEALT);
    anyNpc.setNpcState?.(NpcState.create({ data: serializeNpcCustomState(decoded) }));
  } catch (error) {
    log.warn(`Unable to record NPC threat from damage: ${error}`);
  }
}
