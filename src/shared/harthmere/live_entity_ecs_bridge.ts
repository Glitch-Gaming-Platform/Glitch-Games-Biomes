import type {
  HarthmereLiveEntityCombatProtection,
  HarthmereLiveEntityKind,
  HarthmereLiveModeBackendState,
} from "./live_mode_backend";
import { isHarthmereNonLivingObjectLabel } from "./object_interaction_semantics";

export const HARTHMERE_LIVE_ENTITY_ECS_BRIDGE_VERSION =
  "harthmere-live-entity-ecs-bridge";

type LiveEntitySnapshot =
  HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string] & {
    combatProtection?: HarthmereLiveEntityCombatProtection;
  };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function vector3(
  value: unknown
): { x: number; y: number; z: number } | undefined {
  if (Array.isArray(value)) {
    const [x, y, z] = value.map(Number);
    return [x, y, z].every(Number.isFinite) ? { x, y, z } : undefined;
  }
  const raw = asRecord(value);
  if (Array.isArray(raw.v)) {
    return vector3(raw.v);
  }
  const x = Number(raw.x);
  const y = Number(raw.y);
  const z = Number(raw.z);
  return [x, y, z].every(Number.isFinite) ? { x, y, z } : undefined;
}

function number(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function textForRecord(entityId: string, record: Record<string, unknown>) {
  const label = asRecord(record.label);
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

const ROBOT_LIKE_LABEL_REGEX =
  /\b(robots?|bots?|sentinels?|sententials?|sentientals?|constructs?|automatons?|drones?|androids?)\b/i;
const ANIMAL_LIKE_LABEL_REGEX =
  /\b(animal|livestock|wolf|bear|boar|deer|snake|rat|fox|horse|cow|goat|sheep|pig|chicken|rabbit)\b/i;

function inferLiveEntityKindFromEcsRecord(
  entityId: string,
  record: Record<string, unknown>
): HarthmereLiveEntityKind {
  const text = textForRecord(entityId, record);
  if (
    (record.npc_metadata ||
      record.health ||
      record.protectedSpecies === true ||
      record.protected_species === true ||
      record.isLivestock === true ||
      typeof record.species === "string") &&
    ANIMAL_LIKE_LABEL_REGEX.test(text)
  ) {
    return "animal";
  }
  if (isHarthmereNonLivingObjectLabel({ label: text })) return "object";
  if (record.robot_component || ROBOT_LIKE_LABEL_REGEX.test(text)) {
    return "robot";
  }
  if (record.player_status) return "human";
  if (/mux|muck|muckling|mucker/.test(text)) return "mux";
  if (/hex|hexer/.test(text)) return "hex";
  if (/undead|zombie|corpse|drowned|grave|dead/.test(text)) return "undead";
  if (ANIMAL_LIKE_LABEL_REGEX.test(text)) {
    return "animal";
  }
  if (/construct|golem|training dummy/.test(text)) return "construct";
  if (/monster|creature|wyrm|boss/.test(text)) return "monster";
  if (
    /place|label|board|marker|sign|kiosk|landmark/.test(text) ||
    record.placeable_component
  ) {
    return "object";
  }
  if (
    /human|guard|merchant|civilian|farmer|blacksmith|bandit|guide|banker|clerk|registrar|supplier|teller|healer|town crier|quest giver|owner|npc/.test(
      text
    )
  ) {
    return "human";
  }
  return record.npc_metadata ? "npc" : "live_entity";
}

function combatProtectionForEcsRecord(
  text: string,
  record: Record<string, unknown>,
  kind: HarthmereLiveEntityKind
): HarthmereLiveEntityCombatProtection | undefined {
  if (record.protectedSpecies === true || record.protected_species === true) {
    return "protected_species";
  }
  if (
    /child|guide|merchant|banker|clerk|registrar|supplier|teller|healer|civilian|town crier|quest giver/.test(
      text
    )
  ) {
    return "friendly_noncombatant";
  }
  if (
    kind === "object" &&
    /place|label|board|marker|sign|kiosk|landmark/.test(text)
  ) {
    return "label_or_place";
  }
  if (isHarthmereNonLivingObjectLabel({ label: text })) {
    return "immobile_object";
  }
  if (
    kind === "object" &&
    !number(record.movementSpeed ?? record.movement_speed)
  ) {
    return "immobile_object";
  }
  return undefined;
}

function isHostileByEcsText(text: string) {
  return /\b(hostile|bandit|muck|muckling|mucker|muckwad|hex|hexer|monster|boss|zombie|undead|wolf|boar|bear|snake|rat)\b/.test(
    text
  );
}

function defaultHpForKind(kind: HarthmereLiveEntityKind) {
  if (kind === "robot" || kind === "construct") return 140;
  if (kind === "monster" || kind === "mux" || kind === "hex") return 600;
  if (kind === "animal" || kind === "undead") return 80;
  if (kind === "object") return 1;
  return 100;
}

export function createHarthmereLiveEntityCombatSnapshotFromEcsRecord(
  entityId: string,
  ecsRecord: unknown
): LiveEntitySnapshot | undefined {
  const record = asRecord(ecsRecord);
  const position =
    vector3(record.position) ??
    vector3(
      record.npc_metadata && asRecord(record.npc_metadata).spawn_position
    );
  if (!position) {
    return undefined;
  }

  const kind = inferLiveEntityKindFromEcsRecord(entityId, record);
  const text = textForRecord(entityId, record);
  const protection = combatProtectionForEcsRecord(text, record, kind);
  const isLivestock =
    record.isLivestock === true ||
    /livestock|market cow|market sheep|market chicken/.test(text);
  const ownerId =
    typeof record.ownerId === "string"
      ? record.ownerId
      : typeof record.owner_id === "string"
      ? record.owner_id
      : undefined;
  const health = asRecord(record.health);
  const maxHp = Math.max(
    1,
    Math.trunc(
      number(health.maxHp) ?? number(health.max_hp) ?? defaultHpForKind(kind)
    )
  );
  const hp = Math.max(
    0,
    Math.min(maxHp, Math.trunc(number(health.hp) ?? maxHp))
  );
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
  const movementSpeed = number(record.movementSpeed ?? record.movement_speed);

  return {
    hp,
    maxHp,
    position,
    homePosition:
      vector3(record.homePosition ?? record.home_position) ?? position,
    isHostile:
      typeof record.isHostile === "boolean"
        ? record.isHostile
        : typeof record.hostile === "boolean"
        ? record.hostile
        : kind === "robot"
        ? false
        : isHostileByEcsText(text),
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
    level: Math.max(1, Math.trunc(number(record.level) ?? 1)),
    entityKind: kind,
    movementSpeed,
    bodyRadius: number(record.bodyRadius ?? record.body_radius),
    patrolRadius: number(record.patrolRadius ?? record.patrol_radius),
    aiEnabled: protection === undefined && kind !== "object",
    retaliatesWhenAttacked: protection === undefined && isAttackable,
    combatProtection: protection,
  };
}

export function createHarthmereLiveEntityCombatSnapshotsFromEcsRecords(
  records: Record<string, unknown>
) {
  const snapshots: Record<string, LiveEntitySnapshot> = {};
  for (const [entityId, record] of Object.entries(records)) {
    const snapshot = createHarthmereLiveEntityCombatSnapshotFromEcsRecord(
      entityId,
      record
    );
    if (snapshot) {
      snapshots[entityId] = snapshot;
    }
  }
  return snapshots;
}
