// HARTHMERE_LIVE_CREATURE_ECS_BRIDGE
//
// The renderer's draw() has no access to the ECS table, so to make "what you see
// is the entity you hit" true we bridge the live-creature entities to the
// renderer through a window global. A client Script (which DOES have the table)
// serializes every muck monster / animal / hex / quest creature into a compact
// record each tick; the renderer reconciles one mesh per record, keyed by entity
// id, so the mesh sits exactly on its server-authoritative ECS entity and the
// proven native attack ray hits it.
//
// This module is the pure core (identification, asset mapping, serialization,
// reconciliation diff). No DOM / renderer / window access, so it is fully
// unit-testable. The thin window publish/read helpers live at the bottom and are
// guarded for non-browser test runs.

import {
  harthmereLiveCreatureRenderFamily,
  type HarthmereLiveCreatureRenderFamily,
} from "@/shared/harthmere/live_creature_render";
import { harthmereMuckCreatureAssetKeyForLabel } from "@/shared/harthmere/muck_creature_assets";
import { harthmereBossVisualForEntity } from "@/shared/harthmere/boss_visual_assets";
import { harthmereLiveModeCombatTargetIdForEcsEntity } from "@/shared/harthmere/visible_combat_target";
import {
  npcEvadeFamilyForDescriptor,
  type NpcEvadeFamily,
} from "@/shared/game/movement_actions";

export type HarthmereBridgedMovementAction = {
  action: "dodge" | "evade";
  startTime: number;
  expiryTime: number;
  direction: [number, number, number];
  nonce?: number;
};

export type HarthmereLiveCreatureEvadeVisual = {
  family: NpcEvadeFamily;
  preferredClipNames: string[];
};

export type HarthmereLiveCreatureBridgeRecord = {
  id: number;
  at: [number, number, number];
  yaw: number;
  family: HarthmereLiveCreatureRenderFamily;
  asset: string;
  scale: number;
  label: string;
  species?: string;
  hp?: number;
  maxHp?: number;
  movementAction?: HarthmereBridgedMovementAction;
  /** Optional deterministic cinematic animation state. */
  animation?: string;
  animationTime?: number;
  moving?: boolean;
  motionTime?: number;
  /** Cutscene authority owns the visible transform; do not interpolate it. */
  cinematic?: boolean;
  /** Humans and authored Muck GLTFs render through the native NPC renderer. */
  nativeNpcRenderer?: boolean;
  /** Synthetic cutscene actor rendered with the snapshot player mesh pipeline. */
  nativeSnapshotAvatar?: boolean;
  /** Canonical human id used for a synthetic actor's deterministic appearance. */
  appearanceSourceEntityId?: number;
};

// Minimal structural view of an ECS entity so this stays decoupled from the
// generated component classes (and testable with plain objects).
export type HarthmereLiveCreatureEntityView = {
  id: number;
  label?: { text?: string } | undefined;
  position?: { v?: readonly [number, number, number] } | undefined;
  orientation?: { v?: readonly [number, number] } | undefined;
  health?: { hp?: number; maxHp?: number } | undefined;
  movement_state?:
    | {
        action?: "dodge" | "evade";
        action_start_time?: number;
        action_expiry_time?: number;
        direction?: readonly [number, number, number];
        action_nonce?: number;
      }
    | undefined;
  npc_metadata?: { type_id?: number } | undefined;
  robot_component?: unknown;
  player_status?: unknown;
  placeable_component?: unknown;
  // Optional hints a seeder/quest system can stamp on the entity.
  harthmere_creature_kind?: string;
  harthmere_creature_species?: string;
  harthmere_quest_creature?: boolean;
};

export function harthmereLiveCreatureEvadeVisual(
  record: Pick<
    HarthmereLiveCreatureBridgeRecord,
    "asset" | "label" | "species" | "movementAction"
  >
): HarthmereLiveCreatureEvadeVisual {
  const family = npcEvadeFamilyForDescriptor(
    record.asset,
    record.label,
    record.species
  );
  const lateralNames =
    (record.movementAction?.direction[0] ?? 0) +
      (record.movementAction?.direction[2] ?? 0) >=
    0
      ? ["SidestepRight", "SidestepLeft"]
      : ["SidestepLeft", "SidestepRight"];
  switch (family) {
    case "mucker":
      return {
        family,
        preferredClipNames: ["MuckerEvade", "Jump", "Dodging", "Run"],
      };
    case "robot":
      return {
        family,
        preferredClipNames: ["RobotEvade", "Dodging", ...lateralNames],
      };
    case "sideLeap":
      return {
        family,
        preferredClipNames: ["SideLeap", ...lateralNames, "Sidestep", "Jump"],
      };
    case "heavy":
      return {
        family,
        preferredClipNames: [
          "HeavyEvade",
          "Sidestep",
          ...lateralNames,
          "HitReact",
        ],
      };
    case "rabbit":
      return {
        family,
        preferredClipNames: ["QuickHop", "Jump", "Dodging", ...lateralNames],
      };
    case "bird":
      return {
        family,
        preferredClipNames: ["WingEvade", "Fly", "Jump", ...lateralNames],
      };
    case "swim":
      return {
        family,
        preferredClipNames: ["SwimBurst", "Swim", "Dodging", "Idle"],
      };
    case "hexer":
      return {
        family,
        preferredClipNames: [
          "HexerEvade",
          "Dodging",
          ...lateralNames,
          "BasicMagic",
        ],
      };
    case "generic":
      return {
        family,
        preferredClipNames: ["Evade", "Dodging", ...lateralNames, "Jump"],
      };
  }
}

const NATIVE_ANIMAL_ASSET_BY_SPECIES: Record<string, string> = {
  bear: "npcs/cow",
  bird: "npcs/bird",
  boar: "npcs/cow",
  bunny: "npcs/rabbit",
  cat: "npcs/cat",
  chicken: "npcs/chicken",
  cow: "npcs/cow",
  crow: "npcs/bird",
  deer: "npcs/cow",
  dog: "npcs/dog_1",
  fish: "npcs/fish",
  fox: "npcs/dog_1",
  frog: "npcs/mouse",
  goat: "npcs/sheep",
  horse: "npcs/cow",
  mouse: "npcs/mouse",
  pigeon: "npcs/bird",
  pig: "npcs/cow",
  rabbit: "npcs/rabbit",
  rat: "npcs/mouse",
  sheep: "npcs/sheep",
  snake: "npcs/mouse",
  turtle: "npcs/turtle",
  wolf: "npcs/dog_1",
};

// Map common species names onto the nearest supported procedural mesh.
const ANIMAL_SPECIES_ALIASES: Record<string, string> = {
  rabbit: "bunny",
  hare: "bunny",
  goat: "sheep",
  ram: "sheep",
  lamb: "sheep",
  rat: "snake",
  mouse: "snake",
  bull: "cow",
  calf: "cow",
  ox: "cow",
  hound: "dog",
  puppy: "dog",
  kitten: "cat",
  piglet: "pig",
  hog: "pig",
  stag: "deer",
  doe: "deer",
  fawn: "deer",
  pony: "horse",
  cub: "bear",
};

function normalizeAnimalSpecies(raw: string): string | undefined {
  const s = raw.toLowerCase().trim();
  if (NATIVE_ANIMAL_ASSET_BY_SPECIES[s]) {
    return s;
  }
  const alias = ANIMAL_SPECIES_ALIASES[s];
  return alias && NATIVE_ANIMAL_ASSET_BY_SPECIES[alias] ? alias : undefined;
}

const ANIMAL_SPECIES_FROM_LABEL_RE =
  /\b(wolf|bear|boar|deer|stag|doe|fox|dog|hound|cat|rat|pig|hog|cow|bull|sheep|goat|ram|horse|pony|chicken|pigeon|crow|rabbit|hare|bunny|snake|frog|fish|turtle)\b/;

// Every living NPC is now driven from ECS so the visible mesh sits on its real
// entity: muck monsters, hexes, animals, quest/escort/hired creatures AND town
// humans (the Doc, the Chef, guards, merchants...). Only robots are excluded —
// they already render co-located via their own path. Rendering humans here too
// removes the static-placement-vs-ECS duplication that made town NPCs flicker.
//
export function harthmereLiveCreatureFamilyForEntity(
  entity: HarthmereLiveCreatureEntityView
): HarthmereLiveCreatureRenderFamily {
  return harthmereLiveCreatureRenderFamily({
    kind: entity.harthmere_creature_kind,
    species: entity.harthmere_creature_species,
    label: entity.label?.text,
    isQuestCreature: entity.harthmere_quest_creature === true,
  });
}

/**
 * Is this ECS entity a living thing we should render-from-ECS (so the visible
 * mesh is its real entity — hittable, and never flickering against a static
 * duplicate)? Any living NPC (npc_metadata + position + alive) qualifies:
 * muckers, hexes, animals, quest/escort/hired creatures and town humans. Only
 * robots (own render path), players and placeables are excluded.
 */
export function isHarthmereLiveCreatureEntity(
  entity: HarthmereLiveCreatureEntityView
): boolean {
  if (
    !entity.npc_metadata ||
    entity.player_status ||
    entity.placeable_component
  ) {
    return false;
  }
  if (entity.robot_component) {
    return false;
  }
  if (!entity.position?.v) {
    return false;
  }
  // Dead/zero-hp entities are not rendered (they are awaiting respawn).
  if (
    entity.health &&
    typeof entity.health.hp === "number" &&
    entity.health.hp <= 0
  ) {
    return false;
  }
  return true;
}

export function harthmereLiveCreatureAssetFor(
  family: HarthmereLiveCreatureRenderFamily,
  species: string | undefined,
  label: string | undefined,
  entityId?: number
): string {
  const bossVisual = harthmereBossVisualForEntity(label, entityId);
  if (bossVisual) {
    return bossVisual.assetUrl;
  }
  if (family === "animal") {
    const rawSpecies = (species ?? "").toLowerCase().trim();
    if (NATIVE_ANIMAL_ASSET_BY_SPECIES[rawSpecies]) {
      return NATIVE_ANIMAL_ASSET_BY_SPECIES[rawSpecies];
    }
    const labelSpecies = (label ?? "")
      .toLowerCase()
      .match(ANIMAL_SPECIES_FROM_LABEL_RE)?.[1];
    if (labelSpecies && NATIVE_ANIMAL_ASSET_BY_SPECIES[labelSpecies]) {
      return NATIVE_ANIMAL_ASSET_BY_SPECIES[labelSpecies];
    }
    const fromSpecies = normalizeAnimalSpecies(species ?? "");
    if (fromSpecies) {
      return NATIVE_ANIMAL_ASSET_BY_SPECIES[fromSpecies];
    }
    const m = (label ?? "").toLowerCase().match(ANIMAL_SPECIES_FROM_LABEL_RE);
    if (m) {
      const fromLabel = normalizeAnimalSpecies(m[1]);
      if (fromLabel) {
        return NATIVE_ANIMAL_ASSET_BY_SPECIES[fromLabel];
      }
    }
    return "npcs/cow";
  }
  if (family === "mucker" || family === "hex") {
    return harthmereMuckCreatureAssetKeyForLabel(label) ?? "npcs/mossy_mucker";
  }
  if (family === "quest_creature") {
    return harthmereMuckCreatureAssetKeyForLabel(label) ?? "npcs/mossy_mucker";
  }
  if (family === "robot") {
    return "npcs/helping_robot";
  }
  // Town humans / escort followers / generic live NPCs use the same generated
  // snapshot player mesh as real players. No procedural townsperson key leaves
  // this authority bridge.
  return "snapshot/player_mesh";
}

function yawFromOrientation(
  orientation: { v?: readonly [number, number] } | undefined
): number {
  const v = orientation?.v;
  if (!v || v.length < 2 || !Number.isFinite(v[1])) {
    return 0;
  }
  return v[1];
}

/**
 * Serialize an ECS entity into the compact record the renderer consumes. Returns
 * undefined when the entity is not a render-from-ECS creature.
 */
export function harthmereLiveCreatureBridgeRecord(
  entity: HarthmereLiveCreatureEntityView
): HarthmereLiveCreatureBridgeRecord | undefined {
  if (!isHarthmereLiveCreatureEntity(entity)) {
    return undefined;
  }
  const pos = entity.position!.v as readonly [number, number, number];
  const family = harthmereLiveCreatureFamilyForEntity(entity);
  const species = entity.harthmere_creature_species;
  const label = entity.label?.text ?? `Harthmere ${family}`;
  const asset = harthmereLiveCreatureAssetFor(
    family,
    species,
    entity.label?.text,
    entity.id
  );
  const movement = entity.movement_state;
  const movementAction =
    movement?.action &&
    Number.isFinite(movement.action_start_time) &&
    Number.isFinite(movement.action_expiry_time) &&
    movement.direction?.length === 3
      ? {
          action: movement.action,
          startTime: movement.action_start_time!,
          expiryTime: movement.action_expiry_time!,
          direction: [
            Number(movement.direction[0]),
            Number(movement.direction[1]),
            Number(movement.direction[2]),
          ] as [number, number, number],
          nonce: movement.action_nonce,
        }
      : undefined;
  return {
    id: entity.id,
    at: [pos[0], pos[1], pos[2]],
    yaw: yawFromOrientation(entity.orientation),
    family,
    asset,
    scale: 1,
    label,
    species,
    hp: entity.health?.hp,
    maxHp: entity.health?.maxHp,
    movementAction,
    // Every real ECS NPC now renders through the original NpcRenderState path.
    // The bridge is transform/diagnostic state only; it must never instantiate
    // a second procedural Three.js body over the authoritative actor.
    nativeNpcRenderer: true,
  };
}

export type HarthmereLiveCreatureReconcileResult = {
  toAdd: HarthmereLiveCreatureBridgeRecord[];
  toUpdate: HarthmereLiveCreatureBridgeRecord[];
  toRemove: number[];
};

/**
 * Diff the currently-rendered entity ids against the latest records so the
 * renderer can add new creatures, reposition moved ones, and dispose departed
 * ones (death / despawn / out of sync range).
 */
export function reconcileHarthmereLiveCreatureBridge(
  renderedIds: ReadonlySet<number>,
  records: ReadonlyArray<HarthmereLiveCreatureBridgeRecord>
): HarthmereLiveCreatureReconcileResult {
  const toAdd: HarthmereLiveCreatureBridgeRecord[] = [];
  const toUpdate: HarthmereLiveCreatureBridgeRecord[] = [];
  const nextIds = new Set<number>();
  for (const record of records) {
    nextIds.add(record.id);
    if (renderedIds.has(record.id)) {
      toUpdate.push(record);
    } else {
      toAdd.push(record);
    }
  }
  const toRemove: number[] = [];
  for (const id of renderedIds) {
    if (!nextIds.has(id)) {
      toRemove.push(id);
    }
  }
  return { toAdd, toUpdate, toRemove };
}

/**
 * Static life placements are a loading fallback only. Once the corresponding
 * ECS creature is present in the client bridge, its static combat target must
 * be hidden and removed from hit selection so the player sees and attacks the
 * authoritative moving entity instead of a stationary duplicate.
 */
export function harthmereLiveCreatureStaticFallbackTargetIds(
  records: ReadonlyArray<HarthmereLiveCreatureBridgeRecord>
): Set<string> {
  const targetIds = new Set<string>();
  for (const record of records) {
    const targetId = harthmereLiveModeCombatTargetIdForEcsEntity(record.id);
    if (targetId) {
      targetIds.add(targetId);
    }
  }
  return targetIds;
}

// ---------------------------------------------------------------------------
// Window bridge glue (not exercised by the pure unit tests).
// ---------------------------------------------------------------------------

export const HARTHMERE_LIVE_CREATURE_ECS_BRIDGE_KEY =
  "__harthmereLiveCreatureEcsBridge";

type LiveCreatureBridgeWindow = typeof globalThis & {
  __harthmereLiveCreatureEcsBridge?: {
    at: number;
    records: HarthmereLiveCreatureBridgeRecord[];
  };
};

export type HarthmereLiveCreatureBridgeSnapshot = {
  /**
   * Publication marker. A negative value means the last publication expired,
   * allowing renderers to reconcile the empty snapshot exactly once.
   */
  at: number;
  records: HarthmereLiveCreatureBridgeRecord[];
};

export function publishHarthmereLiveCreatureBridge(
  records: HarthmereLiveCreatureBridgeRecord[]
): void {
  if (typeof window === "undefined") {
    return;
  }
  (window as LiveCreatureBridgeWindow).__harthmereLiveCreatureEcsBridge = {
    at: Date.now(),
    records,
  };
}

export function readHarthmereLiveCreatureBridge(): HarthmereLiveCreatureBridgeRecord[] {
  return readHarthmereLiveCreatureBridgeSnapshot().records;
}

export function readHarthmereLiveCreatureBridgeSnapshot(): HarthmereLiveCreatureBridgeSnapshot {
  if (typeof window === "undefined") {
    return { at: 0, records: [] };
  }
  const bridge = (window as LiveCreatureBridgeWindow)
    .__harthmereLiveCreatureEcsBridge;
  if (!bridge || !Array.isArray(bridge.records)) {
    return { at: 0, records: [] };
  }
  // Stale guard: if the publisher stopped (e.g. teardown), don't keep ghosts.
  if (Number.isFinite(bridge.at) && Date.now() - bridge.at > 5_000) {
    return { at: -Math.abs(bridge.at), records: [] };
  }
  return { at: bridge.at, records: bridge.records };
}
