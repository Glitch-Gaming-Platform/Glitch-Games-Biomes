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
import { harthmereLiveModeCombatTargetIdForEcsEntity } from "@/shared/harthmere/visible_combat_target";

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
};

// Minimal structural view of an ECS entity so this stays decoupled from the
// generated component classes (and testable with plain objects).
export type HarthmereLiveCreatureEntityView = {
  id: number;
  label?: { text?: string } | undefined;
  position?: { v?: readonly [number, number, number] } | undefined;
  orientation?: { v?: readonly [number, number] } | undefined;
  health?: { hp?: number; maxHp?: number } | undefined;
  npc_metadata?: unknown;
  robot_component?: unknown;
  player_status?: unknown;
  placeable_component?: unknown;
  // Optional hints a seeder/quest system can stamp on the entity.
  harthmere_creature_kind?: string;
  harthmere_creature_species?: string;
  harthmere_quest_creature?: boolean;
};

// Exactly the species the renderer's procedural-animal factory can build
// (isProceduralAnimalKey). Anything else must normalize into this set or fall
// back, otherwise the mesh silently fails to instantiate.
const PROCEDURAL_ANIMAL_SPECIES = new Set<string>([
  "snake",
  "frog",
  "chicken",
  "bunny",
  "pigeon",
  "cat",
  "dog",
  "pig",
  "sheep",
  "cow",
  "horse",
  "deer",
  "wolf",
  "boar",
  "bear",
  "fox",
  "crow",
]);

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
  if (PROCEDURAL_ANIMAL_SPECIES.has(s)) {
    return s;
  }
  const alias = ANIMAL_SPECIES_ALIASES[s];
  return alias && PROCEDURAL_ANIMAL_SPECIES.has(alias) ? alias : undefined;
}

const ANIMAL_SPECIES_FROM_LABEL_RE =
  /\b(wolf|bear|boar|deer|stag|doe|fox|dog|hound|cat|rat|pig|hog|cow|bull|sheep|goat|ram|horse|pony|chicken|pigeon|crow|rabbit|hare|bunny|snake|frog)\b/;

// Every living NPC is now driven from ECS so the visible mesh sits on its real
// entity: muck monsters, hexes, animals, quest/escort/hired creatures AND town
// humans (the Doc, the Chef, guards, merchants...). Only robots are excluded —
// they already render co-located via their own path. Rendering humans here too
// removes the static-placement-vs-ECS duplication that made town NPCs flicker.
//
// Pick a town-human body variant from the NPC's name/role so the appearance
// system (which keys off asset + name) produces a believable look instead of a
// generic one. Falls back to a neutral market-goer.
function humanTownspersonAssetFromLabel(label: string | undefined): string {
  const text = (label ?? "").toLowerCase();
  if (/guard|watch|sentry|soldier|warden|knight/.test(text)) return "townsperson_guard";
  if (/courier|messenger|runner|page/.test(text)) return "townsperson_courier";
  if (/dock|sailor|fisher|wharf/.test(text)) return "townsperson_dockhand";
  if (/farm|field|shepherd|herd|grange/.test(text)) return "townsperson_farmer";
  if (/priest|cleric|clergy|monk|nun|chaplain|verena|chapel/.test(text)) return "townsperson_clergy";
  if (/hunt|ranger|trapper|forester/.test(text)) return "townsperson_hunter";
  if (/bandit|outlaw|thief|brigand|rogue/.test(text)) return "townsperson_bandit";
  if (/smuggler|fence|dealer/.test(text)) return "townsperson_smuggler";
  if (/charcoal|collier|smith|forge|coal/.test(text)) return "townsperson_charcoal";
  if (/mud|peasant|laborer|labourer|digger/.test(text)) return "townsperson_mudden";
  // Doctors, chefs, merchants, innkeepers, vendors, generic townsfolk.
  return "townsperson_market";
}

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
  if (!entity.npc_metadata || entity.player_status || entity.placeable_component) {
    return false;
  }
  if (entity.robot_component) {
    return false;
  }
  if (!entity.position?.v) {
    return false;
  }
  // Dead/zero-hp entities are not rendered (they are awaiting respawn).
  if (entity.health && typeof entity.health.hp === "number" && entity.health.hp <= 0) {
    return false;
  }
  return true;
}

export function harthmereLiveCreatureAssetFor(
  family: HarthmereLiveCreatureRenderFamily,
  species: string | undefined,
  label: string | undefined
): string {
  if (family === "animal") {
    const fromSpecies = normalizeAnimalSpecies(species ?? "");
    if (fromSpecies) {
      return `animal_${fromSpecies}`;
    }
    const m = (label ?? "").toLowerCase().match(ANIMAL_SPECIES_FROM_LABEL_RE);
    if (m) {
      const fromLabel = normalizeAnimalSpecies(m[1]);
      if (fromLabel) {
        return `animal_${fromLabel}`;
      }
    }
    return "animal_boar";
  }
  if (family === "mucker" || family === "hex") {
    // Muck monsters and hexes render through the procedural "townsperson_undead"
    // creature mesh (same asset the static muck placements use today).
    return "townsperson_undead";
  }
  if (family === "quest_creature") {
    // Quest/hired hostiles: undead creature mesh unless the label clearly names
    // an animal (e.g. "quest wolf").
    return "townsperson_undead";
  }
  // Town humans / escort followers / generic live NPCs (the Doc, the Chef,
  // guards, merchants): a believable human body variant chosen from the name.
  return humanTownspersonAssetFromLabel(label);
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
  return {
    id: entity.id,
    at: [pos[0], pos[1], pos[2]],
    yaw: yawFromOrientation(entity.orientation),
    family,
    asset: harthmereLiveCreatureAssetFor(family, species, entity.label?.text),
    scale: 1,
    label,
    species,
    hp: entity.health?.hp,
    maxHp: entity.health?.maxHp,
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
  if (typeof window === "undefined") {
    return [];
  }
  const bridge = (window as LiveCreatureBridgeWindow)
    .__harthmereLiveCreatureEcsBridge;
  if (!bridge || !Array.isArray(bridge.records)) {
    return [];
  }
  // Stale guard: if the publisher stopped (e.g. teardown), don't keep ghosts.
  if (Number.isFinite(bridge.at) && Date.now() - bridge.at > 5_000) {
    return [];
  }
  return bridge.records;
}
