// HARTHMERE_TOWN_MAP_UI_DISCOVERY_FILTERS_V1
// Static town-map contract used by local-dev tests and future UI wiring.
export const HARTHMERE_TOWN_MAP_FILTERS_V1 = [
  "all",
  "quests",
  "shops",
  "crafting",
  "travel",
  "guilds",
  "combat",
  "services",
  "housing",
  "hidden",
  "criminal",
] as const;

export const HARTHMERE_TOWN_MAP_PRESENTATION_V1 = {
  hiddenLocations: {
    visibility: "hidden until discovered by rumor, perception, quest unlock, or exploration discovery",
  },
  dangerZones: {
    color: "red",
    icon: "warning",
    label: "danger warning map presentation",
  },
  zoomDeclutter: {
    behavior: "cluster nearby vendor/service icons and group crowded icons by zoom to avoid overcrowd/declutter issues",
  },
  serviceAnchors: {
    rule: "map icons point to reachable interactionAnchor/serviceAnchor/npcId/interactable anchorPosition, not decorative walls",
  },
} as const;


// HARTHMERE_CONNECTED_MAP_PRESENTATION_V66
// UI/map contract for showing Harthmere as a connected settlement on the same
// implemented snapshot map, not as a hidden debug town.
export const HARTHMERE_CONNECTED_MAP_PRESENTATION_V66 = {
  version: "harthmere-connected-map-presentation-v66",
  mapIcon: "road",
  label: "Road to Harthmere",
  authoredRoad: [[128, -209], [392, -209]],
  shiftedDefaultRoad: [[640, -209], [904, -209]],
  revealRule: "visible from snapshot edge; Harthmere services reveal as the player reaches the west gate",
  safetyReadability: "main lane uses lamps, signposts, red-black watch banners, and patrols; threats stay off-lane",
} as const;
