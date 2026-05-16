// HARTHMERE_TOWN_VISUAL_READABILITY_VIEWPOINTS_V1
export const HARTHMERE_TOWN_READABILITY_VIEWPOINTS_V1 = [
  { id: "north_gate_viewpoint", purpose: "screenshot viewpoint from gate showing arrival road" },
  { id: "market_square_viewpoint", purpose: "screenshot viewpoint from market showing fountain/services" },
  { id: "player_services_viewpoint", purpose: "service view and readable service entrances" },
  { id: "river_docks_viewpoint", purpose: "screenshot viewpoint for docks, ferry, and water danger" },
  { id: "temple_green_viewpoint", purpose: "screenshot viewpoint for healer/temple entrance visible" },
  { id: "copper_kettle_viewpoint", purpose: "screenshot viewpoint for inn entrance visible" },
  { id: "guard_yard_viewpoint", purpose: "screenshot viewpoint for guard yard and restricted warnings" },
] as const;

export const HARTHMERE_TOWN_READABILITY_AUDIT_RULES_V1 = {
  entranceVisibility: "entrance visible, visible entrance, service readable, readable service, sign visible",
  mismatchAudit: "detect looks blocked, visible blocked, walk through, invisible collision, collision mismatch",
  identity: "district identity uses sign landmark lighting banner sound ambience colorTheme",
} as const;
