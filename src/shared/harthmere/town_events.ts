// HARTHMERE_TOWN_EVENT_STATE_MUTATION_V1
export const HARTHMERE_TOWN_EVENT_CATALOG_V1 = [
  "market day",
  "festival",
  "monster attack",
  "funeral",
  "protest",
  "fire",
  "plague",
  "thief chase",
  "religious ceremony",
  "caravan",
] as const;

export const HARTHMERE_TOWN_EVENT_MUTATIONS_V1 = [
  "NPC positions",
  "dialogue",
  "shop availability",
  "guard patrols",
  "map markers",
  "crowd density",
  "quest options",
  "music",
  "lighting",
  "decorations",
] as const;

export const HARTHMERE_TOWN_EVENT_SAFETY_V1 = {
  roadClearance: "validate event collision clearance so event activation cannot block core service lane roads",
  attackState: "monster attack and fire cause shop closed state, civilians flee to shelter, and guards respond",
} as const;


// HARTHMERE_PROCEDURAL_SOLID_ASSET_COLLISION_V1
// Event/procedural spawned solid props must use the same blocksPlayer collision
// registry as authored town props. This contract covers barricade, crate, cart,
// wagon, coffin, stall, table, fence, rock, and debris families. Spawned props
// must not block core service roads, gate roads, market lanes, dock service cart
// lanes, or service entrances. Event cleanup/despawn must remove dynamic
// obstacles when events end.
export const HARTHMERE_PROCEDURAL_SOLID_ASSET_COLLISION_V1 =
  "harthmere-procedural-solid-asset-collision-v1";

export const HARTHMERE_PROCEDURAL_SOLID_EVENT_PROP_FAMILIES = [
  "barricade",
  "crate",
  "cart",
  "wagon",
  "coffin",
  "stall",
  "table",
  "fence",
  "rock",
  "debris",
] as const;

export const HARTHMERE_PROCEDURAL_SOLID_EVENT_COLLISION_POLICY = {
  blocksPlayer: true,
  playerBlocking: true,
  collisionSource: "town collision registry lookup",
  roadClearanceRule: "event activation cannot block core service roads or lane clearance",
  cleanup: "despawn and remove dynamic obstacle on event end",
} as const;
