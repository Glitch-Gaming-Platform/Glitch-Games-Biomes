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
