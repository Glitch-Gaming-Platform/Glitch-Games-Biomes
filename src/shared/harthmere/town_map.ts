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
