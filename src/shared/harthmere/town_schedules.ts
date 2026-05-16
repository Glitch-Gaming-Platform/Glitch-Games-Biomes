// HARTHMERE_TOWN_SCHEDULES_V1
export const HARTHMERE_TOWN_SCHEDULE_VERSION_V1 = "harthmere-town-schedules-v1";

export const HARTHMERE_TOWN_TIME_OF_DAY_SCHEDULE_V1 = {
  morning: "shops open, market sets up, workers walk to forge/farm/docks",
  day: "shops open, services active, market crowd density normal",
  evening: "Copper Kettle tavern/inn patrons fill the room and crowd density rises",
  night: "guards run night patrol routes while thief, criminal, smuggler, outlaw, and pickpocket activity increases",
  rain: "rain moves civilians under shelter and keeps market goods covered",
  festival: "festival decorations, music, crowd density, special vendors, and market day overflow activate",
  attack: "monster attack closes shops, civilians flee to shelter, and guard patrols respond",
} as const;

export const HARTHMERE_SHOP_HOURS_V1 = {
  rule: "shop hours define open/closed shop behavior; closed shop signs remain readable",
} as const;

export const HARTHMERE_LIGHTING_SCHEDULE_V1 = {
  night: "lamp torch lantern lighting is lit at evening/night",
} as const;
