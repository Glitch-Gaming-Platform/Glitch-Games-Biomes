import type { HarthmereReputationState } from "@/client/components/challenges/LocalDevHarthmereReputation";
import {
  HARTHMERE_BLACK_MARKET_OFFSETS,
  isHarthmereVendorOffset,
} from "@/client/components/challenges/LocalDevHarthmereVendorCatalog";

export const HARTHMERE_NPC_BEHAVIOR_SYSTEM_VERSION = 1;

export type HarthmereNpcDayPhase =
  | "dawn"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "night";

export type HarthmereNpcBehaviorKind =
  | "merchant"
  | "guard"
  | "civilian"
  | "peasant"
  | "thief"
  | "priest"
  | "noble"
  | "craftsman"
  | "service"
  | "scholar"
  | "creature";

export type HarthmereCrimeKind =
  | "theft"
  | "assault"
  | "public_murder"
  | "temple_theft"
  | "smuggling"
  | "illegal_magic"
  | "trespass";

export interface HarthmereNpcRouteStop {
  phase: HarthmereNpcDayPhase;
  startHour: number;
  endHour: number;
  district: string;
  anchor: string;
  positionHint: string;
  activity: string;
  movementStyle: string;
  dialogueCue: string;
}

export interface HarthmereNpcBehaviorProfile {
  offset: number;
  name: string;
  kind: HarthmereNpcBehaviorKind;
  role: string;
  faction: string;
  socialClass: string;
  homeDistrict: string;
  workDistrict: string;
  sellsGoods: boolean;
  buysGoods: boolean;
  lawfulService: boolean;
  helpsCriminalPlayers: boolean;
  dailyRoute: HarthmereNpcRouteStop[];
  dangerResponse: string;
  economyRelationship: string;
  relationshipRules: string[];
}

export interface HarthmereNpcSocialResponse {
  allowTrade: boolean;
  priceBias: "discount" | "normal" | "markup" | "refuse";
  dialogueLine: string;
  reason: string;
}

export interface HarthmereNpcCrimeResponse {
  responseLevel: "ignore" | "warn" | "refuse" | "flee" | "call_guards" | "arrest" | "help_criminal";
  dialogueLine: string;
  economyEffect: string;
}

export const HARTHMERE_KNOWN_NPC_OFFSETS = [
  1, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14,
  27, 28, 29, 30, 31, 32, 33, 34, 39, 40,
  41, 43, 44, 45, 46, 47, 56, 57, 59, 60,
  61, 62, 63, 64, 65, 67, 68, 69, 70,
] as const;

const NPC_BASE: Record<number, Omit<HarthmereNpcBehaviorProfile, "dailyRoute">> = {
  1: npcBase(1, "Mira, Town Guide", "civilian", "town guide", "Harthmere Citizens", "commoner", "Residential District", "Market Square", false, false, true, false),
  4: npcBase(4, "Pip, Harbor Mascot", "civilian", "town mascot", "Harthmere Citizens", "commoner", "Market Square", "Market Square", false, false, true, false),
  5: npcBase(5, "Maren Dawnloaf", "merchant", "baker", "Dawn Loaf Bakery", "common merchant", "Bakery Loft", "Dawn Loaf Bakery", true, true, true, false),
  6: npcBase(6, "Banker Merl Voss", "service", "banker", "Merchant Compact", "wealthy merchant", "Services Hall", "Harthmere Bank", true, true, true, false),
  7: npcBase(7, "Brann, Weapons Teller", "merchant", "weapon seller", "Black Anvil Smithy", "craftsman", "Craftsman Row", "Weapons Counter", true, true, true, false),
  8: npcBase(8, "Luma, Healer", "merchant", "healer", "Green Mortar Apothecary", "healer", "Apothecary", "Green Mortar Healer", true, true, true, false),
  9: npcBase(9, "Edrin Starling", "scholar", "magic supplier", "Wyrm and Candle", "scholar", "Magic Shop Attic", "Wyrm & Candle", true, true, true, false),
  10: npcBase(10, "Tilda Fen", "peasant", "farmer", "Harthmere Farmers", "peasant", "Farm Cottage", "Farm and Chicken Yard", false, true, true, false),
  11: npcBase(11, "Garrick, Bartender", "merchant", "bartender", "Copper Kettle Inn", "common merchant", "Copper Kettle Inn", "Copper Kettle Bar", true, true, true, false),
  13: npcBase(13, "Bela the Storyteller", "civilian", "storyteller", "Copper Kettle Regulars", "traveler", "Copper Kettle Inn", "Copper Kettle Hearth", false, false, true, false),
  14: npcBase(14, "Kip the Card Player", "civilian", "card player", "Copper Kettle Regulars", "traveler", "Copper Kettle Inn", "Copper Kettle Tables", false, false, true, false),
  27: npcBase(27, "Sergeant Bram Holt", "guard", "gate sergeant", "Town Watch", "military officer", "Guard Barracks", "North Gate", false, false, true, false),
  28: npcBase(28, "Mara Thistle", "merchant", "market guide", "Market Vendors", "common merchant", "Market-Side Room", "Market Square", true, true, true, false),
  29: npcBase(29, "Master Osric Vale", "craftsman", "blacksmith", "Black Anvil Smithy", "guild craftsman", "Smithy Loft", "Forge and Anvil", true, true, true, false),
  30: npcBase(30, "Elowen Pike", "merchant", "innkeeper", "Copper Kettle Inn", "common merchant", "Copper Kettle Inn", "Inn Hearth and Rooms", true, true, true, false),
  31: npcBase(31, "Father Aldren", "priest", "chapel priest", "Chapel Circle", "clergy", "Chapel Quarters", "Temple Green", true, true, true, false),
  32: npcBase(32, "Town Reeve", "noble", "town reeve", "Noble Rise", "low nobility", "Reeve Hall", "Reeve Hall Court", false, false, true, false),
  33: npcBase(33, "Nessa Crowe", "thief", "Mudden Ward guide", "Mudden Kin", "outcast", "Mudden Ward", "Mudden Ward Alleys", true, true, false, true),
  34: npcBase(34, "Tovin Reed", "merchant", "dockmaster", "River Docks", "labor boss", "Dockside Room", "River Dock Supply", true, true, true, false),
  39: npcBase(39, "Rusk, Toll Clerk", "guard", "toll clerk", "Town Watch", "civic clerk", "Gate Office", "North Gate Toll Booth", false, false, true, false),
  40: npcBase(40, "Sable, Smuggler", "thief", "smuggler", "River Knots", "criminal", "Unknown River Room", "Dock Shadows", false, true, false, true),
  41: npcBase(41, "Harthmere Market Board", "service", "notice board", "Harthmere Civic Notices", "public object", "Market Square", "Market Square", false, false, true, false),
  43: npcBase(43, "Courier Anwen", "service", "courier", "Merchant Compact", "worker", "Services Hall", "Parcel Counter", true, true, true, false),
  44: npcBase(44, "Drill Instructor Hal", "guard", "drill instructor", "Town Watch", "military trainer", "Guard Barracks", "Guard Yard", false, false, true, false),
  45: npcBase(45, "Bounty Clerk Rowan", "guard", "bounty clerk", "Town Watch", "civic officer", "Guard Barracks", "Bounty Desk", false, false, true, false),
  46: npcBase(46, "Sister Maelle", "priest", "chapel healer", "Chapel Circle", "clergy", "Chapel Quarters", "Temple Green", true, true, true, false),
  47: npcBase(47, "Ysabet Fenlow", "merchant", "apothecary", "Green Mortar Apothecary", "healer-scholar", "Apothecary", "Mortar Table", true, true, true, false),
  56: npcBase(56, "Guard Quartermaster Tarrow", "guard", "quartermaster", "Town Watch", "military supplier", "Guard Barracks", "Guard Yard Stores", true, true, true, false),
  57: npcBase(57, "Traveling Merchant Ossa", "merchant", "traveling merchant", "Road Traders", "traveler", "Caravan Camp", "Market Edge", true, true, true, false),
  59: npcBase(59, "Guild Registrar Wyne", "service", "guild registrar", "Guild Registry", "civic clerk", "Services Hall", "Guild Desk", true, true, true, false),
  60: npcBase(60, "Auction Clerk Pellam", "service", "auction clerk", "Market Vendors", "civic clerk", "Services Hall", "Auction Board", true, true, true, false),
  61: npcBase(61, "Rat Catcher Dima", "peasant", "rat catcher", "Harthmere Workers", "laborer", "Mudden Ward", "Old Drains", false, true, true, false),
  62: npcBase(62, "Bell-Witness Ora", "priest", "bell witness", "Chapel Circle", "elder", "Temple Green", "Old Well", false, false, true, false),
  63: npcBase(63, "Apple Picker Ren", "peasant", "orchard worker", "Harthmere Farmers", "laborer", "Farm Cottage", "Orchard Rows", true, true, true, false),
  64: npcBase(64, "Stablehand Corin", "peasant", "stablehand", "Harthmere Yard", "laborer", "Stable Loft", "Stable Yard", false, true, true, false),
  65: npcBase(65, "River Knots Lookout", "thief", "river fence", "River Knots", "criminal", "Dock Shadows", "River Docks", true, true, false, true),
  67: npcBase(67, "Forge Apprentice Luth", "craftsman", "forge apprentice", "Black Anvil Smithy", "apprentice", "Smithy Loft", "Forge Side Bench", true, true, true, false),
  68: npcBase(68, "Bakery Apprentice Noll", "merchant", "bakery apprentice", "Dawn Loaf Bakery", "apprentice", "Bakery Loft", "Dawn Loaf Counter", true, true, true, false),
  69: npcBase(69, "Market Guard Sen", "guard", "market guard", "Town Watch", "soldier", "Guard Barracks", "Market Square Patrol", false, false, true, false),
  70: npcBase(70, "Underways Echo", "creature", "underways echo", "Old Harthmere", "mystery", "Underways", "Old Barred Entrance", false, false, false, false),
};

function npcBase(
  offset: number,
  name: string,
  kind: HarthmereNpcBehaviorKind,
  role: string,
  faction: string,
  socialClass: string,
  homeDistrict: string,
  workDistrict: string,
  sellsGoods: boolean,
  buysGoods: boolean,
  lawfulService: boolean,
  helpsCriminalPlayers: boolean,
): Omit<HarthmereNpcBehaviorProfile, "dailyRoute"> {
  return {
    offset,
    name,
    kind,
    role,
    faction,
    socialClass,
    homeDistrict,
    workDistrict,
    sellsGoods: sellsGoods || isHarthmereVendorOffset(offset),
    buysGoods: buysGoods || isHarthmereVendorOffset(offset),
    lawfulService,
    helpsCriminalPlayers: helpsCriminalPlayers || HARTHMERE_BLACK_MARKET_OFFSETS.has(offset),
    dangerResponse: dangerResponseFor(kind, role),
    economyRelationship: economyRelationshipFor(kind, role),
    relationshipRules: relationshipRulesFor(kind),
  };
}

function dangerResponseFor(kind: HarthmereNpcBehaviorKind, role: string) {
  if (kind === "guard") return "moves toward the crime, protects civilians, and escalates from warning to arrest";
  if (kind === "merchant" || kind === "service") return "secures the counter, protects stock, and calls nearby guards";
  if (kind === "thief") return "breaks line of sight, helps criminal contacts, and avoids lawful witnesses";
  if (kind === "priest") return "protects patients, condemns temple theft, and asks for mercy before force";
  if (kind === "noble") return "retreats behind guards, status, and legal authority";
  if (kind === "peasant" || role.includes("child")) return "flees toward familiar adults, gates, or guards";
  if (kind === "creature") return "withdraws toward its lair or old stone route";
  return "backs away, avoids blocking paths, and calls for help";
}

function economyRelationshipFor(kind: HarthmereNpcBehaviorKind, role: string) {
  if (kind === "merchant" || kind === "craftsman") return "prices, stock, buy categories, and restock behavior depend on reputation and local supply";
  if (kind === "guard") return "legal standing affects inspection, fines, arrest risk, and access to official contracts";
  if (kind === "thief") return "criminal standing opens fences, smuggling, laundering, and stolen-goods help";
  if (kind === "priest") return "donations, medicine shortages, temple theft, and mercy choices affect service";
  if (kind === "noble") return "status, taxes, property access, and political reputation affect their response";
  if (kind === "peasant") return "generosity, food supply, repairs, and protection affect their trust";
  return "local reputation changes how much help they offer";
}

function relationshipRulesFor(kind: HarthmereNpcBehaviorKind) {
  if (kind === "merchant" || kind === "craftsman" || kind === "service") {
    return [
      "high_likeability_discount",
      "low_likeability_markup_or_refusal",
      "outlaw_refused_by_lawful_vendor",
      "notoriety_unlocks_rare_attention",
    ];
  }
  if (kind === "guard") return ["outlaw_arrest", "trusted_citizen_help", "notoriety_inspection"];
  if (kind === "thief") return ["outlaw_help", "lawful_suspicion", "stolen_goods_fence"];
  if (kind === "priest") return ["temple_theft_refusal", "charity_likeability", "mercy_dialogue"];
  if (kind === "noble") return ["status_respect", "low_status_dismissal", "tax_and_property_access"];
  if (kind === "peasant") return ["generosity_trust", "cruelty_fear", "outlaw_refusal"];
  return ["reputation_dialogue_shift", "quest_state_dialogue_shift"];
}

function routeStop(
  phase: HarthmereNpcDayPhase,
  startHour: number,
  endHour: number,
  district: string,
  anchor: string,
  activity: string,
  movementStyle: string,
  dialogueCue: string,
): HarthmereNpcRouteStop {
  return {
    phase,
    startHour,
    endHour,
    district,
    anchor,
    positionHint: `${district} / ${anchor}`,
    activity,
    movementStyle,
    dialogueCue,
  };
}

function routeFor(profile: Omit<HarthmereNpcBehaviorProfile, "dailyRoute">): HarthmereNpcRouteStop[] {
  const work = profile.workDistrict;
  const home = profile.homeDistrict;
  if (profile.kind === "guard") {
    return [
      routeStop("dawn", 5, 8, home, "barracks muster", "checks roster, gear, and patrol orders", "barracks-to-post walk", `${profile.name} is mustering before patrol.`),
      routeStop("morning", 8, 12, work, "primary watch post", "inspects travelers, doors, and suspicious hands", "post patrol loop", `${profile.name} watches the route and keeps civilians clear.`),
      routeStop("midday", 12, 15, work, "market or gate sweep", "walks the busiest lane and checks complaints", "wide patrol loop", `${profile.name} is watching the crowd more than the conversation.`),
      routeStop("afternoon", 15, 18, work, "secondary patrol point", "rotates through trouble spots and vendor stalls", "checkpoint loop", `${profile.name} is on the late patrol, looking for raised voices.`),
      routeStop("evening", 18, 22, "Copper Kettle / Gate Route", "lantern patrol", "keeps tavern spillover and road traffic under control", "lantern route", `${profile.name} expects trouble to find doors and drink after dusk.`),
      routeStop("night", 22, 5, home, "barracks or night watch post", "rests in rotation or watches restricted areas", "short night guard loop", `${profile.name} keeps the night route short and alert.`),
    ];
  }
  if (profile.kind === "thief") {
    return [
      routeStop("dawn", 5, 8, home, "hidden room", "returns quietly and avoids witnesses", "shadow-to-home route", `${profile.name} keeps to walls while the lawful town wakes.`),
      routeStop("morning", 8, 12, home, "low-traffic corner", "listens, trades hints, and avoids the Watch", "short alley loop", `${profile.name} stays useful without being obvious.`),
      routeStop("midday", 12, 15, work, "crowd edge", "watches movement through crowds and cargo", "crowd-edge loop", `${profile.name} watches pockets, guards, and exits in that order.`),
      routeStop("afternoon", 15, 18, work, "back route", "moves messages and marks safe doors", "back-alley route", `${profile.name} talks like the street has ears.`),
      routeStop("evening", 18, 22, work, "active contact point", "offers fence, smuggling, or quiet-route help", "dock/alley contact loop", `${profile.name} becomes more useful as the lanterns come on.`),
      routeStop("night", 22, 5, work, "shadow route", "moves illegal goods and avoids patrols", "hidden route loop", `${profile.name} belongs more to night routes than open streets.`),
    ];
  }
  if (profile.kind === "peasant") {
    return [
      routeStop("dawn", 5, 8, home, "home yard", "feeds animals, checks tools, and starts water work", "home-to-yard loop", `${profile.name} starts with feed, water, and tools.`),
      routeStop("morning", 8, 12, work, "field or work row", "works crops, animals, stalls, or repairs", "field work loop", `${profile.name} keeps one eye on the work that cannot wait.`),
      routeStop("midday", 12, 15, work, "shade or crate point", "sorts goods and talks only while hands keep moving", "work-to-crate loop", `${profile.name} has little patience for wasted daylight.`),
      routeStop("afternoon", 15, 18, work, "delivery path", "moves baskets, tools, or warnings toward town", "work-to-market route", `${profile.name} is moving useful goods before dusk.`),
      routeStop("evening", 18, 22, home, "home gate", "counts tools, animals, and doors", "home return loop", `${profile.name} is trying to finish before the road gets risky.`),
      routeStop("night", 22, 5, home, "sleeping space", "rests unless danger reaches the yard", "static rest anchor", `${profile.name} should not be wandering after dark without a reason.`),
    ];
  }
  if (profile.kind === "priest") {
    return [
      routeStop("dawn", 5, 8, work, "altar", "prays, lights candles, and receives quiet worries", "altar-to-candle loop", `${profile.name} begins where candles and names are kept.`),
      routeStop("morning", 8, 12, work, "chapel aisle", "checks the sick, hungry, and frightened", "pew-to-door care loop", `${profile.name} watches who needs help before who has coin.`),
      routeStop("midday", 12, 15, work, "charity table", "sorts medicine, water, and simple meals", "table-to-shelf loop", `${profile.name} is dealing in mercy, not speeches.`),
      routeStop("afternoon", 15, 18, "Temple Green / Market Edge", "outreach route", "checks on families and carries warnings", "chapel-to-market loop", `${profile.name} walks where worry collects.`),
      routeStop("evening", 18, 22, work, "vigil point", "keeps vigil and listens for old bell rumors", "short candle loop", `${profile.name} grows quieter as the chapel shadows lengthen.`),
      routeStop("night", 22, 5, home, "chapel quarters", "rests or keeps emergency watch", "quarters-to-altar emergency route", `${profile.name} only breaks night rest for sickness or fear.`),
    ];
  }
  if (profile.kind === "noble") {
    return [
      routeStop("dawn", 5, 8, home, "private room", "reviews ledgers and sealed notes", "private-to-desk route", `${profile.name} begins the day with paper, not people.`),
      routeStop("morning", 8, 12, work, "petition desk", "hears petitions and applies status rules", "desk audience loop", `${profile.name} measures every request against law and leverage.`),
      routeStop("midday", 12, 15, work, "court table", "meets merchants, guards, and guild messengers", "desk-to-balcony loop", `${profile.name} treats even courtesy like negotiation.`),
      routeStop("afternoon", 15, 18, "Noble Rise / Market Overlook", "inspection balcony", "observes taxes, crowds, and guard reports", "balcony route", `${profile.name} is watching the market without standing in it.`),
      routeStop("evening", 18, 22, home, "private audit", "locks ledgers and sends quiet instructions", "desk-to-private-room loop", `${profile.name} grows harder to reach after business hours.`),
      routeStop("night", 22, 5, home, "guarded quarters", "stays behind guards and locked doors", "static guarded anchor", `${profile.name} leaves night work to guards and servants.`),
    ];
  }
  if (profile.kind === "creature") {
    return [
      routeStop("dawn", 5, 8, work, "old stone", "fades as the town wakes", "barely-there stone drift", `${profile.name} is weaker in morning light.`),
      routeStop("morning", 8, 12, work, "sealed edge", "waits in stone and old water", "static echo anchor", `${profile.name} answers only if the question touches old stone.`),
      routeStop("midday", 12, 15, work, "barred entrance", "listens through wet stone", "small echo shift", `${profile.name} sounds far below where it appears.`),
      routeStop("afternoon", 15, 18, work, "old bars", "repeats fragments and warning names", "bar-to-stone drift", `${profile.name} carries words that do not belong to the street.`),
      routeStop("evening", 18, 22, work, "underways threshold", "grows clearer near old bronze marks", "threshold drift", `${profile.name} is strongest when the town grows quiet.`),
      routeStop("night", 22, 5, work, "underways mouth", "pulls attention toward the buried bell route", "cold route shimmer", `${profile.name} belongs to the night below Harthmere.`),
    ];
  }
  const workActivity = profile.sellsGoods || profile.buysGoods
    ? "sells, buys, restocks, and answers only what their role would know"
    : "works their ordinary route and answers local questions";
  return [
    routeStop("dawn", 5, 8, home, "home or prep anchor", "prepares tools, stock, food, notes, or messages", "home-to-work route", `${profile.name} is preparing for ${profile.role} work.`),
    routeStop("morning", 8, 12, work, "main work anchor", workActivity, "work loop", `${profile.name} is at the place their work belongs.`),
    routeStop("midday", 12, 15, work, "busy-hour anchor", "handles the most public part of the job", "customer-to-supply loop", `${profile.name} is dealing with the day's busiest questions.`),
    routeStop("afternoon", 15, 18, work, "closing-prep anchor", "checks remaining work, supplies, and pending errands", "work-to-ledger loop", `${profile.name} is sorting what still has to happen before dusk.`),
    routeStop("evening", 18, 22, profile.kind === "merchant" ? "Copper Kettle / Market Edge" : home, "evening social or return route", "returns home, hears rumors, or closes stock", "work-to-evening route", `${profile.name} is leaving public work behind for the evening.`),
    routeStop("night", 22, 5, home, "night anchor", "rests unless work, crime, sickness, or a quest demands otherwise", "static night anchor", `${profile.name} should be in a safe night location.`),
  ];
}

export const HARTHMERE_NPC_BEHAVIOR_PROFILES: Record<number, HarthmereNpcBehaviorProfile> = Object.fromEntries(
  Object.entries(NPC_BASE).map(([offset, profile]) => [
    Number(offset),
    { ...profile, dailyRoute: routeFor(profile) },
  ]),
) as Record<number, HarthmereNpcBehaviorProfile>;

function fallbackProfile(offset: number): HarthmereNpcBehaviorProfile {
  const profile = npcBase(
    offset,
    `Harthmere local ${offset}`,
    "civilian",
    "townsperson",
    "Harthmere Citizens",
    "commoner",
    "Residential District",
    "Market Square",
    false,
    false,
    true,
    false,
  );
  return { ...profile, dailyRoute: routeFor(profile) };
}

export function getHarthmereNpcBehaviorProfile(offset: number) {
  return HARTHMERE_NPC_BEHAVIOR_PROFILES[offset] ?? fallbackProfile(offset);
}

export function getHarthmereNpcTimePhase(hour = new Date().getHours()): HarthmereNpcDayPhase {
  const normalized = ((Math.floor(hour) % 24) + 24) % 24;
  if (normalized >= 5 && normalized < 8) return "dawn";
  if (normalized >= 8 && normalized < 12) return "morning";
  if (normalized >= 12 && normalized < 15) return "midday";
  if (normalized >= 15 && normalized < 18) return "afternoon";
  if (normalized >= 18 && normalized < 22) return "evening";
  return "night";
}

export function getHarthmereNpcRouteForHour(offset: number, hour = new Date().getHours()) {
  const phase = getHarthmereNpcTimePhase(hour);
  const profile = getHarthmereNpcBehaviorProfile(offset);
  return profile.dailyRoute.find((stop) => stop.phase === phase) ?? profile.dailyRoute[0];
}

export function getHarthmereNpcCurrentRouteLine(offset: number, hour = new Date().getHours()) {
  const stop = getHarthmereNpcRouteForHour(offset, hour);
  return stop?.dialogueCue ?? undefined;
}

export function getHarthmereNpcEconomyBehavior(offset: number) {
  const profile = getHarthmereNpcBehaviorProfile(offset);
  return {
    sellsGoods: profile.sellsGoods,
    buysGoods: profile.buysGoods,
    lawfulService: profile.lawfulService,
    helpsCriminalPlayers: profile.helpsCriminalPlayers,
    economyRelationship: profile.economyRelationship,
  };
}

export function getHarthmereNpcSocialResponse(
  offset: number,
  state: HarthmereReputationState,
): HarthmereNpcSocialResponse {
  const profile = getHarthmereNpcBehaviorProfile(offset);
  const region = state.regions.harthmere;
  const personal = state.personal[offset]?.likeability ?? 0;
  const likeability = personal || region.likeability;
  const legal = region.legal;
  const notoriety = region.notoriety;

  if (profile.kind === "guard" && legal <= -5_000) {
    return {
      allowTrade: false,
      priceBias: "refuse",
      dialogueLine: `${profile.name} treats this as an arrest problem, not a conversation.`,
      reason: "outlaw_guard_response",
    };
  }

  if ((profile.kind === "merchant" || profile.kind === "service" || profile.kind === "craftsman") && profile.lawfulService && legal <= -5_000) {
    return {
      allowTrade: false,
      priceBias: "refuse",
      dialogueLine: `${profile.name} will not risk lawful stock or licenses for an outlaw.`,
      reason: "outlaw_refused_by_lawful_vendor",
    };
  }

  if (profile.helpsCriminalPlayers && legal <= -500) {
    return {
      allowTrade: true,
      priceBias: "normal",
      dialogueLine: `${profile.name} is less troubled by your problems with the Watch than honest merchants would be.`,
      reason: "criminal_contact_help",
    };
  }

  if (profile.kind === "priest" && legal <= -2_000) {
    return {
      allowTrade: true,
      priceBias: "markup",
      dialogueLine: `${profile.name} will still treat wounds, but temple trust is thin around you.`,
      reason: "priest_mercy_with_distrust",
    };
  }

  if (profile.kind === "noble" && notoriety >= 5_000) {
    return {
      allowTrade: false,
      priceBias: "normal",
      dialogueLine: `${profile.name} recognizes your status and chooses each courtesy carefully.`,
      reason: "noble_status_response",
    };
  }

  if (profile.kind === "peasant" && likeability <= -2_000) {
    return {
      allowTrade: false,
      priceBias: "refuse",
      dialogueLine: `${profile.name} keeps distance; people who mistreat workers do not get easy help here.`,
      reason: "peasant_cruelty_refusal",
    };
  }

  if (likeability >= 2_000) {
    return {
      allowTrade: true,
      priceBias: "discount",
      dialogueLine: `${profile.name} treats you with earned warmth, not generic politeness.`,
      reason: "high_likeability_discount",
    };
  }

  if (likeability <= -2_000) {
    return {
      allowTrade: profile.helpsCriminalPlayers,
      priceBias: profile.helpsCriminalPlayers ? "normal" : "markup",
      dialogueLine: `${profile.name} keeps the counter, the exit, and nearby witnesses in mind.`,
      reason: "low_likeability_markup_or_refusal",
    };
  }

  if (notoriety >= 2_500) {
    return {
      allowTrade: true,
      priceBias: "normal",
      dialogueLine: `${profile.name} has heard your name and is deciding whether that helps or hurts today.`,
      reason: "notoriety_recognition",
    };
  }

  return {
    allowTrade: true,
    priceBias: "normal",
    dialogueLine: `${profile.name} responds from their work, their district, and what your standing means there.`,
    reason: "neutral_role_response",
  };
}

export const HARTHMERE_NPC_CRIME_RESPONSES: Record<HarthmereCrimeKind, string> = {
  theft: "guards investigate, merchants protect stock, civilians keep distance, fences evaluate risk",
  assault: "guards intervene, civilians flee, merchants close counters, priests protect patients",
  public_murder: "guards call reinforcements, civilians flee, merchants refuse service, nobles demand punishment",
  temple_theft: "priests refuse trust, guards increase inspection, lawful merchants raise suspicion",
  smuggling: "fences help criminals, dock officials weigh risk, guards inspect cargo",
  illegal_magic: "guards and priests treat it as public danger unless authorized",
  trespass: "restricted-room owners warn first, then call guards or lock services",
};

export function getHarthmereNpcCrimeResponse(
  offset: number,
  crime: HarthmereCrimeKind,
): HarthmereNpcCrimeResponse {
  const profile = getHarthmereNpcBehaviorProfile(offset);
  if (profile.kind === "guard") {
    return {
      responseLevel: crime === "public_murder" || crime === "assault" ? "arrest" : "warn",
      dialogueLine: `${profile.name} treats ${crime.replaceAll("_", " ")} as Watch business and moves to intervene.`,
      economyEffect: "fines, confiscation, vendor refusal, and legal standing penalties become possible",
    };
  }
  if (profile.kind === "thief" || profile.helpsCriminalPlayers) {
    return {
      responseLevel: crime === "smuggling" || crime === "theft" ? "help_criminal" : "ignore",
      dialogueLine: `${profile.name} can help hide, move, fence, or launder trouble when the price is worth it.`,
      economyEffect: "black market access, reduced stolen-goods value, and smuggling risk apply",
    };
  }
  if (profile.kind === "priest") {
    return {
      responseLevel: crime === "temple_theft" ? "refuse" : "call_guards",
      dialogueLine: `${profile.name} reacts badly to harm near the chapel and protects the vulnerable first.`,
      economyEffect: "temple donations, healing trust, and mercy services are affected",
    };
  }
  if (profile.kind === "noble") {
    return {
      responseLevel: "call_guards",
      dialogueLine: `${profile.name} turns crime into law, taxes, permits, and consequences.`,
      economyEffect: "property access, fines, and status-gated services are affected",
    };
  }
  if (profile.kind === "peasant" || profile.kind === "civilian") {
    return {
      responseLevel: crime === "theft" ? "refuse" : "flee",
      dialogueLine: `${profile.name} pulls back from danger and remembers cruelty longer than excuses.`,
      economyEffect: "local help, food access, errands, and likeability rewards are reduced",
    };
  }
  if (profile.kind === "merchant" || profile.kind === "craftsman" || profile.kind === "service") {
    return {
      responseLevel: crime === "theft" || crime === "temple_theft" ? "call_guards" : "refuse",
      dialogueLine: `${profile.name} secures stock before continuing business.`,
      economyEffect: "stock access, buy prices, sell prices, and lawful vendor service are affected",
    };
  }
  return {
    responseLevel: "ignore",
    dialogueLine: `${profile.name} reacts only if the crime touches their route or role.`,
    economyEffect: "no direct economic response",
  };
}
