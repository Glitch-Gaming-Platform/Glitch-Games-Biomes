import type {
  HarthmereLiveEntityCombatProtectionV1,
  HarthmereLiveEntityKindV1,
  HarthmereLiveModeBackendStateV1,
} from "./live_mode_backend_v1";

export const HARTHMERE_LIVE_ENTITY_ECS_BRIDGE_VERSION_V1 =
  "harthmere-live-entity-ecs-bridge-v1";

type LiveEntitySnapshotV1 =
  HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string] & {
    combatProtection?: HarthmereLiveEntityCombatProtectionV1;
  };

function recordV1(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function vector3V1(value: unknown): { x: number; y: number; z: number } | undefined {
  if (Array.isArray(value)) {
    const [x, y, z] = value.map(Number);
    return [x, y, z].every(Number.isFinite) ? { x, y, z } : undefined;
  }
  const raw = recordV1(value);
  if (Array.isArray(raw.v)) {
    return vector3V1(raw.v);
  }
  const x = Number(raw.x);
  const y = Number(raw.y);
  const z = Number(raw.z);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : undefined;
}

function numberV1(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function textForRecordV1(entityId: string, record: Record<string, unknown>) {
  const label = recordV1(record.label);
  return [
    entityId,
    label.text,
    label.label,
    record.name,
    record.entity_kind,
    record.species,
    record.kind,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

function inferLiveEntityKindFromEcsRecordV1(
  entityId: string,
  record: Record<string, unknown>
): HarthmereLiveEntityKindV1 {
  const text = textForRecordV1(entityId, record);
  if (record.robot_component) return "robot";
  if (record.player_status) return "human";
  if (/mux|muck|muckling|mucker/.test(text)) return "mux";
  if (/hex|hexer/.test(text)) return "hex";
  if (/undead|zombie|corpse|drowned|grave|dead/.test(text)) return "undead";
  if (/\b(animal|livestock|wolf|bear|boar|deer|snake|rat|fox|horse|cow|goat|sheep|pig|chicken)\b/.test(text)) {
    return "animal";
  }
  if (/construct|golem|training dummy/.test(text)) return "construct";
  if (/monster|creature|wyrm|boss/.test(text)) return "monster";
  if (/place|label|board|marker|sign|kiosk|landmark/.test(text) || record.placeable_component) {
    return "object";
  }
  if (/human|guard|merchant|civilian|farmer|blacksmith|bandit|npc/.test(text)) {
    return "human";
  }
  return record.npc_metadata ? "npc" : "live_entity";
}

function combatProtectionForEcsRecordV1(
  text: string,
  record: Record<string, unknown>,
  kind: HarthmereLiveEntityKindV1
): HarthmereLiveEntityCombatProtectionV1 | undefined {
  if (record.protectedSpecies === true || record.protected_species === true) {
    return "protected_species";
  }
  if (/child|guide|merchant|banker|clerk|registrar|supplier|teller|healer|civilian|town crier|quest giver/.test(text)) {
    return "friendly_noncombatant";
  }
  if (kind === "object" && /place|label|board|marker|sign|kiosk|landmark/.test(text)) {
    return "label_or_place";
  }
  if (kind === "object" && !numberV1(record.movementSpeed ?? record.movement_speed)) {
    return "immobile_object";
  }
  return undefined;
}

function isHostileByEcsTextV1(text: string) {
  return /\b(hostile|bandit|muck|muckling|mucker|hex|monster|boss|zombie|undead|wolf|boar|bear|snake|rat)\b/.test(text);
}

function defaultHpForKindV1(kind: HarthmereLiveEntityKindV1) {
  if (kind === "robot" || kind === "construct") return 140;
  if (kind === "monster" || kind === "mux" || kind === "hex") return 120;
  if (kind === "animal" || kind === "undead") return 80;
  if (kind === "object") return 1;
  return 100;
}

export function createHarthmereLiveEntityCombatSnapshotFromEcsRecordV1(
  entityId: string,
  ecsRecord: unknown
): LiveEntitySnapshotV1 | undefined {
  const record = recordV1(ecsRecord);
  const position =
    vector3V1(record.position) ??
    vector3V1(record.npc_metadata && recordV1(record.npc_metadata).spawn_position);
  if (!position) {
    return undefined;
  }

  const kind = inferLiveEntityKindFromEcsRecordV1(entityId, record);
  const text = textForRecordV1(entityId, record);
  const protection = combatProtectionForEcsRecordV1(text, record, kind);
  const isLivestock =
    record.isLivestock === true ||
    /livestock|market cow|market sheep|market chicken/.test(text);
  const ownerId =
    typeof record.ownerId === "string"
      ? record.ownerId
      : typeof record.owner_id === "string"
      ? record.owner_id
      : undefined;
  const health = recordV1(record.health);
  const maxHp =
    Math.max(1, Math.trunc(numberV1(health.maxHp) ?? numberV1(health.max_hp) ?? defaultHpForKindV1(kind)));
  const hp = Math.max(0, Math.min(maxHp, Math.trunc(numberV1(health.hp) ?? maxHp)));
  const explicitAttackable =
    typeof record.isAttackable === "boolean"
      ? record.isAttackable
      : typeof record.attackable === "boolean"
      ? record.attackable
      : undefined;
  const hasCombatComponent =
    Boolean(record.npc_metadata) ||
    Boolean(record.robot_component) ||
    Boolean(record.health);
  const isAttackable =
    protection === undefined &&
    !record.player_status &&
    (explicitAttackable ?? hasCombatComponent);
  const movementSpeed = numberV1(record.movementSpeed ?? record.movement_speed);

  return {
    hp,
    maxHp,
    position,
    homePosition: vector3V1(record.homePosition ?? record.home_position) ?? position,
    isHostile:
      typeof record.isHostile === "boolean"
        ? record.isHostile
        : typeof record.hostile === "boolean"
        ? record.hostile
        : isHostileByEcsTextV1(text),
    isAlive: hp > 0,
    isAttackable,
    isPlayer: Boolean(record.player_status),
    isLivestock,
    protectedSpecies: protection === "protected_species",
    ownerId,
    species:
      typeof record.species === "string"
        ? record.species
        : kind === "animal"
        ? "animal"
        : undefined,
    level: Math.max(1, Math.trunc(numberV1(record.level) ?? 1)),
    entityKind: kind,
    movementSpeed,
    bodyRadius: numberV1(record.bodyRadius ?? record.body_radius),
    patrolRadius: numberV1(record.patrolRadius ?? record.patrol_radius),
    aiEnabled: protection === undefined && kind !== "object",
    retaliatesWhenAttacked: protection === undefined && isAttackable,
    combatProtection: protection,
  };
}

export function createHarthmereLiveEntityCombatSnapshotsFromEcsRecordsV1(
  records: Record<string, unknown>
) {
  const snapshots: Record<string, LiveEntitySnapshotV1> = {};
  for (const [entityId, record] of Object.entries(records)) {
    const snapshot = createHarthmereLiveEntityCombatSnapshotFromEcsRecordV1(
      entityId,
      record
    );
    if (snapshot) {
      snapshots[entityId] = snapshot;
    }
  }
  return snapshots;
}
