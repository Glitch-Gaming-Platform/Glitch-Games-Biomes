// HARTHMERE_TOWN_SCHEDULES
export const HARTHMERE_TOWN_SCHEDULE_VERSION = "harthmere-town-schedules";

export const HARTHMERE_TOWN_TIME_OF_DAY_SCHEDULE = {
  morning: "shops open, market sets up, workers walk to forge/farm/docks",
  day: "shops open, services active, market crowd density normal",
  evening: "Copper Kettle tavern/inn patrons fill the room and crowd density rises",
  night: "guards run night patrol routes while thief, criminal, smuggler, outlaw, and pickpocket activity increases",
  rain: "rain moves civilians under shelter and keeps market goods covered",
  festival: "festival decorations, music, crowd density, special vendors, and market day overflow activate",
  attack: "monster attack closes shops, civilians flee to shelter, and guard patrols respond",
} as const;

export const HARTHMERE_SHOP_HOURS = {
  rule: "shop hours define open/closed shop behavior; closed shop signs remain readable",
} as const;

export const HARTHMERE_LIGHTING_SCHEDULE = {
  night: "lamp torch lantern lighting is lit at evening/night",
} as const;


// HARTHMERE_TOWN_NPC_ROUTE_SCHEDULE
export const HARTHMERE_TOWN_NPC_ROUTE_SCHEDULE_VERSION = "harthmere-town-npc-route-schedule";

export const HARTHMERE_TOWN_NPC_ROUTE_SCHEDULE = {
  morning: "workers leave residential/slum homes and spread to market, craftsman row, docks, chapel, and gate routes",
  day: "service NPCs stay near their service route anchors while ambient NPCs orbit district loops instead of idle-piling",
  evening: "inn and player-services density rises but density guardrails still prevent local pileups",
  night: "guards, smugglers, dockworkers, and Mudden Ward NPCs shift to patrol/shelter routes; market thins",
} as const;
