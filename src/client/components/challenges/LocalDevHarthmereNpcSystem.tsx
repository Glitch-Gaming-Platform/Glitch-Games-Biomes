import type { HarthmereReputationState } from "@/client/components/challenges/LocalDevHarthmereReputation";

export type HarthmereNpcKind =
  | "civilian"
  | "merchant"
  | "guard"
  | "noble"
  | "peasant"
  | "thief"
  | "priest"
  | "craftsman"
  | "scholar"
  | "animal"
  | "creature"
  | "service"
  | "quest";

export interface HarthmereNpcProfile {
  offset: number;
  kind: HarthmereNpcKind;
  role: string;
  faction: string;
  socialClass: string;
  home: string;
  work: string;
  anchor: string;
  movement: string;
  schedule: string;
  dangerResponse: string;
  conversationHook: string;
  taskHook: string;
}

const DEFAULT_PROFILE: HarthmereNpcProfile = {
  offset: 0,
  kind: "civilian",
  role: "townsperson",
  faction: "Harthmere Citizens",
  socialClass: "commoner",
  home: "nearby housing",
  work: "town streets",
  anchor: "standing conversation anchor beside the public route",
  movement: "short district wander loop with clear door and road spacing",
  schedule: "works or runs errands by day, moves toward home or tavern at dusk",
  dangerResponse:
    "backs away, calls for help, and avoids blocking the player route",
  conversationHook:
    "They answer like someone with errands to finish, not like a signpost.",
  taskHook:
    "They may ask for a small delivery, repair, warning, or errand if trust improves.",
};

const PROFILES: Record<number, Partial<HarthmereNpcProfile>> = {
  5: {
    kind: "merchant",
    role: "baker",
    faction: "Dawn Loaf Bakery",
    socialClass: "common merchant",
    home: "room above the bakery",
    work: "Dawn Loaf counter and oven",
    anchor:
      "shop counter anchor with oven, kneading table, and bread display nearby",
    movement: "counter-to-oven work loop, never through the customer aisle",
    schedule:
      "bakes before dawn, sells through midday, counts flour in the evening",
    dangerResponse:
      "ducks behind the counter and yells for the Watch if steel is drawn",
    conversationHook:
      "Flour dust marks their sleeves and the shop smells like warm crust.",
    taskHook:
      "They can ask for apples, flour, clean water, or a safe delivery to the gate.",
  },
  6: {
    kind: "service",
    role: "banker",
    faction: "Merchant Compact",
    socialClass: "wealthy merchant",
    home: "locked room behind the services plaza",
    work: "bank counter and vault ledger",
    anchor:
      "bank counter anchor with queue space in front and vault storage behind",
    movement: "counter-to-ledger loop inside the secure side of the bank",
    schedule:
      "opens ledgers in the morning, audits lockboxes after market close",
    dangerResponse:
      "locks the strongbox and calls the guards instead of fighting fairly",
    conversationHook:
      "They keep one hand near the ledger and the other near a bell pull.",
    taskHook:
      "They can ask you to trace missing parcels, verify seals, or escort deposits.",
  },
  7: {
    kind: "merchant",
    role: "weapon seller",
    faction: "Black Anvil Smithy",
    socialClass: "craftsman",
    home: "smithy loft",
    work: "front weapon counter",
    anchor: "weapon counter anchor with rack and clear customer lane",
    movement: "counter-to-rack service loop",
    schedule: "sorts stock by day and helps the forge close at dusk",
    dangerResponse: "grabs a practice weapon and shouts for Osric or the Guard",
    conversationHook:
      "They glance at your hands first, then at the weapon rack.",
    taskHook:
      "They can ask for repairs sorted, training blades delivered, or stolen tools found.",
  },
  8: {
    kind: "merchant",
    role: "healer",
    faction: "Green Mortar Apothecary",
    socialClass: "healer",
    home: "small room behind the shop",
    work: "treatment table and remedy shelves",
    anchor: "healing counter anchor with remedy shelves and patient space",
    movement: "shelf-to-treatment-table care loop",
    schedule:
      "mixes simple remedies by morning and treats walk-ins until evening",
    dangerResponse: "moves patients away from danger and calls for chapel help",
    conversationHook:
      "They speak quietly, as if someone nearby may be sleeping off a fever.",
    taskHook:
      "They can ask for clean cloth, willow bark, water, or a delivery to the chapel.",
  },
  9: {
    kind: "scholar",
    role: "magic supplier",
    faction: "Wyrm and Candle",
    socialClass: "scholar",
    home: "shop attic",
    work: "bookstand and locked study",
    anchor: "bookstand anchor with scroll shelves and candle-safe floor space",
    movement: "shelf-to-desk study loop",
    schedule: "opens late, studies older markings at night",
    dangerResponse: "backs toward the locked room and protects the books first",
    conversationHook:
      "Wax, old paper, and dust make the room feel older than the street outside.",
    taskHook:
      "They can ask for chalk, copied runes, lost pages, or quiet research help.",
  },
  10: {
    kind: "peasant",
    role: "farmer",
    faction: "Harthmere Farmers",
    socialClass: "peasant",
    home: "farm cottage",
    work: "field and chicken yard",
    anchor: "field work anchor with crop rows and animal space nearby",
    movement: "field-to-water-trough loop, away from fences and doors",
    schedule:
      "feeds animals early, works rows by day, returns to the cottage at dusk",
    dangerResponse: "tries to herd animals away before fleeing toward the road",
    conversationHook:
      "Mud clings to their boots, and they keep looking toward the crop rows.",
    taskHook:
      "They can ask for feed, fence repair, missing animals, or crop protection.",
  },
  11: {
    kind: "merchant",
    role: "bartender",
    faction: "Copper Kettle Inn",
    socialClass: "common merchant",
    home: "inn back room",
    work: "bar counter",
    anchor: "bar anchor with stools, kegs, and a clear customer lane",
    movement: "bar-to-keg loop, never across the doorway",
    schedule:
      "cleans in the morning, serves late, listens longer than they speak",
    dangerResponse:
      "orders patrons back and reaches for the alarm bell under the bar",
    conversationHook:
      "The room hums around them, but they hear more than they admit.",
    taskHook:
      "They can ask for missing casks, rumor checks, or a quiet word with a patron.",
  },
  27: {
    kind: "guard",
    role: "gate sergeant",
    faction: "Town Watch",
    socialClass: "military officer",
    home: "guard barracks",
    work: "North Gate checkpoint",
    anchor: "guard post anchor with sightline to road and gate",
    movement: "gate-to-toll-booth patrol loop",
    schedule: "inspects arrivals by day and rotates patrols at dusk",
    dangerResponse:
      "draws steel, orders civilians back, and calls reinforcements",
    conversationHook:
      "Their eyes move from your face to the road behind you, measuring trouble.",
    taskHook:
      "They can ask for patrol reports, suspicious parcels, or help with road threats.",
  },
  28: {
    kind: "merchant",
    role: "market guide",
    faction: "Market Vendors",
    socialClass: "common merchant",
    home: "market-side room",
    work: "Market Square stall",
    anchor: "market stall anchor with room for customers to pass",
    movement: "stall-to-fountain loop during busy hours",
    schedule:
      "opens early, trades gossip all day, closes when lanterns are lit",
    dangerResponse: "pulls goods inward and points guards toward the trouble",
    conversationHook:
      "They track every coin, rumor, and raised voice in the square.",
    taskHook:
      "They can ask for price checks, delivery errands, or mediation between vendors.",
  },
  29: {
    kind: "craftsman",
    role: "blacksmith",
    faction: "Black Anvil Smithy",
    socialClass: "guild craftsman",
    home: "smithy loft",
    work: "forge and anvil",
    anchor: "forge work anchor with anvil, tool rack, and safe heat spacing",
    movement: "forge-to-water-trough loop with no customer blocking",
    schedule: "works the forge through the day and cools tools in the evening",
    dangerResponse: "uses the anvil side as cover and fights only if cornered",
    conversationHook:
      "Heat rolls from the forge, and every pause feels measured against the hammer rhythm.",
    taskHook:
      "They can ask for ore, cold iron, repairs, or a delivery to the Guard Yard.",
  },
  30: {
    kind: "merchant",
    role: "innkeeper",
    faction: "Copper Kettle Inn",
    socialClass: "common merchant",
    home: "Copper Kettle Inn",
    work: "hearth, rooms, and rumor board",
    anchor: "innkeeper anchor between hearth, bar, and stair path",
    movement: "hearth-to-door hospitality loop",
    schedule: "welcomes travelers by day and manages rooms at night",
    dangerResponse:
      "gets guests behind tables and calls the Watch before blood reaches the floor",
    conversationHook:
      "They make the room feel safer without pretending it is harmless.",
    taskHook:
      "They can ask for rumor checks, guest help, food delivery, or missing casks.",
  },
  31: {
    kind: "priest",
    role: "chapel priest",
    faction: "Chapel Circle",
    socialClass: "clergy",
    home: "chapel quarters",
    work: "altar and candle racks",
    anchor: "prayer anchor with pews behind and altar ahead",
    movement: "altar-to-candle-rack loop",
    schedule: "prayers at dawn, charity at midday, vigil after sunset",
    dangerResponse:
      "moves the vulnerable behind the pews and calls for mercy before guards",
    conversationHook:
      "Their voice stays gentle, but the empty bell frame shadows every word.",
    taskHook:
      "They can ask for candles, medicine, grave records, or help calming the ward.",
  },
  32: {
    kind: "noble",
    role: "town reeve",
    faction: "Noble Rise",
    socialClass: "low nobility",
    home: "Reeve Hall",
    work: "court desk and balcony",
    anchor: "court anchor with guards nearby and clear audience space",
    movement: "desk-to-balcony authority loop",
    schedule: "holds petitions by day and private audits after market close",
    dangerResponse:
      "orders guards forward and retreats behind authority, not bravery",
    conversationHook:
      "Every polite word sounds weighed against taxes, debt, and leverage.",
    taskHook:
      "They can ask for sealed letters, legal records, or political errands.",
  },
  33: {
    kind: "thief",
    role: "Mudden Ward guide",
    faction: "Mudden Kin",
    socialClass: "outcast",
    home: "Mudden Ward back rooms",
    work: "alleys and drain mouths",
    anchor: "alley anchor with escape route and no main-lane blocking",
    movement: "alley-to-drain loop with quick pauses in shadow",
    schedule: "keeps quiet by day and moves messages at night",
    dangerResponse:
      "vanishes toward the drains unless someone vulnerable is threatened",
    conversationHook:
      "They stand where they can see both you and the nearest escape route.",
    taskHook:
      "They can ask for food, rat clearing, hidden messages, or missing children.",
  },
  34: {
    kind: "merchant",
    role: "dockmaster",
    faction: "River Docks",
    socialClass: "labor boss",
    home: "dockside room",
    work: "cargo ledger and pier edge",
    anchor: "dock work anchor with cargo stacks and clear pier lane",
    movement: "ledger-to-pier inspection loop",
    schedule: "tracks cargo by day and watches suspicious water after dark",
    dangerResponse:
      "gets workers off the pier and calls whichever side can solve it fastest",
    conversationHook:
      "They smell of rope, river mud, and two different ledgers.",
    taskHook:
      "They can ask for cargo runs, fishing help, crate checks, or ferry messages.",
  },
  40: {
    kind: "thief",
    role: "smuggler",
    faction: "River Knots",
    socialClass: "criminal",
    home: "unknown river room",
    work: "dock shadows",
    anchor: "hidden contact anchor near cargo but outside guard sightlines",
    movement: "short shadow loop near exits",
    schedule: "quiet by day, useful after dark",
    dangerResponse: "does not fight fair unless cornered",
    conversationHook: "They talk like every sentence has a second destination.",
    taskHook:
      "They can ask for silence, misdirection, or a cargo favor that the Watch would dislike.",
  },
  41: {
    kind: "service",
    role: "market board",
    faction: "Harthmere Civic Notices",
    socialClass: "public object",
    home: "Market Square",
    work: "Market Square",
    anchor: "public notice anchor with clear standing space",
    movement: "static public interaction point",
    schedule: "new notices arrive by courier throughout the day",
    dangerResponse:
      "the board does not react, but people around it certainly do",
    conversationHook:
      "Fresh notices are pinned over older rain-softened parchment.",
    taskHook: "It lists civic jobs, warnings, rumors, and routes through town.",
  },
  44: {
    kind: "guard",
    role: "drill instructor",
    faction: "Town Watch",
    socialClass: "military trainer",
    home: "guard barracks",
    work: "Guard Yard",
    anchor: "training anchor with dummies and open sparring space",
    movement: "dummy-to-weapon-rack patrol loop",
    schedule: "runs drills by day and checks weapons before dusk",
    dangerResponse:
      "steps between danger and civilians with a command voice first",
    conversationHook:
      "They keep enough distance to test your stance before your words.",
    taskHook:
      "They can ask for dummy practice, patrol help, or bounty support.",
  },
  47: {
    kind: "scholar",
    role: "apothecary",
    faction: "Green Mortar Apothecary",
    socialClass: "healer-scholar",
    home: "apothecary back room",
    work: "mortar table and herb shelves",
    anchor: "alchemy work anchor with bottles supported on shelves and tables",
    movement: "shelf-to-mortar loop",
    schedule: "prepares remedies by day and labels jars late into the evening",
    dangerResponse:
      "throws no heroics away; they protect patients and records first",
    conversationHook:
      "They correct measurements under their breath before correcting people.",
    taskHook:
      "They can ask for herbs, exact ingredients, antidotes, or fever deliveries.",
  },
  52: {
    kind: "civilian",
    role: "child",
    faction: "Mudden Kin",
    socialClass: "vulnerable commoner",
    home: "Mudden Ward",
    work: "errands and hiding places",
    anchor: "safe child anchor away from roads, piers, and combat lanes",
    movement: "short supervised errand loop near adults",
    schedule: "runs messages by day and stays hidden after dusk",
    dangerResponse: "runs toward familiar adults, not toward the player",
    conversationHook:
      "They watch your pockets, your face, and your boots in that order.",
    taskHook:
      "They can ask for a found trinket, a message carried, or help avoiding rats.",
  },
  63: {
    kind: "peasant",
    role: "orchard worker",
    faction: "Harthmere Farmers",
    socialClass: "laborer",
    home: "farm cottage",
    work: "orchard rows",
    anchor: "orchard work anchor with crates and clear tree spacing",
    movement: "tree-to-crate harvesting loop",
    schedule: "picks early, sorts crates by midday, hauls baskets before dusk",
    dangerResponse: "drops the basket and runs toward the farm gate",
    conversationHook:
      "Their hands are nicked from apple stems and crate splinters.",
    taskHook:
      "They can ask for apples sorted, pests chased, or a crate carried to Dawn Loaf.",
  },
  64: {
    kind: "peasant",
    role: "stablehand",
    faction: "Harthmere Yard",
    socialClass: "laborer",
    home: "stable loft",
    work: "stable yard",
    anchor: "animal care anchor with trough, feed, and open animal path",
    movement: "stall-to-trough care loop",
    schedule:
      "feeds animals at dawn, checks tack by day, settles horses at night",
    dangerResponse: "gets animals away from noise before saving their own skin",
    conversationHook:
      "They smell of hay and keep listening for hooves behind you.",
    taskHook:
      "They can ask for feed, calm animals, lost tack, or road warnings.",
  },
  69: {
    kind: "guard",
    role: "market guard",
    faction: "Town Watch",
    socialClass: "soldier",
    home: "guard barracks",
    work: "Market Square patrol",
    anchor: "market patrol anchor with clear sightlines and no stall blocking",
    movement: "fountain-to-stall-to-alley patrol loop",
    schedule: "walks the market by day and watches tavern spillover at night",
    dangerResponse:
      "moves toward the disturbance and calls for backup if a crowd forms",
    conversationHook:
      "Their gaze keeps scanning past you for raised voices or quick hands.",
    taskHook:
      "They can ask for suspicious activity, lost goods, or help calming disputes.",
  },
  70: {
    kind: "creature",
    role: "underways echo",
    faction: "Old Harthmere",
    socialClass: "mystery",
    home: "Underways",
    work: "old barred entrance",
    anchor: "mystery anchor near sealed stone, not inside the player path",
    movement: "barely-there shift around the old bars",
    schedule: "stronger at night and during storms",
    dangerResponse:
      "withdraws into old stone rather than fighting like a person",
    conversationHook: "The voice seems to arrive from wet stone, not lungs.",
    taskHook:
      "It can point toward bell fragments, old marks, or doors that should not open.",
  },
};

export function getHarthmereNpcProfile(offset: number): HarthmereNpcProfile {
  return {
    ...DEFAULT_PROFILE,
    ...(PROFILES[offset] ?? {}),
    offset,
  };
}

function personalLikeability(
  state: HarthmereReputationState,
  offset: number,
): number {
  return state.personal[offset]?.likeability ?? 0;
}

function standingLine(
  offset: number,
  state: HarthmereReputationState,
): string | undefined {
  const profile = getHarthmereNpcProfile(offset);
  const region = state.regions.harthmere;
  const personal = personalLikeability(state, offset);

  if (profile.kind === "guard") {
    if (region.legal <= -5000) {
      return "The guard's hand settles near their weapon before the conversation properly begins.";
    }
    if (region.legal <= -500) {
      return "The guard studies you longer than they study most travelers.";
    }
    if (region.legal >= 2000) {
      return "The guard gives you the kind of nod usually saved for someone useful to the Watch.";
    }
  }

  if (["merchant", "service"].includes(profile.kind)) {
    if (region.likeability <= -2000 || personal <= -100) {
      return "They keep the counter, the exit, and the nearest guard bell in mind while they speak.";
    }
    if (region.likeability >= 1000 || personal >= 100) {
      return "Their voice warms a little; you are not just another stranger at the counter.";
    }
  }

  if (
    ["thief", "criminal"].includes(profile.socialClass) ||
    profile.kind === "thief"
  ) {
    if (region.legal <= -500) {
      return "They seem less bothered by your trouble with the Watch than most people would be.";
    }
    if (region.legal >= 2000) {
      return "They choose their words carefully, as if lawful ears might be nearby.";
    }
  }

  if (region.notoriety >= 5000) {
    return "Someone nearby clearly recognizes you, and the silence after your name is not accidental.";
  }
  if (region.notoriety >= 1000) {
    return "They have heard enough about you to skip the usual stranger's greeting.";
  }

  return undefined;
}

export function getHarthmereNpcConversationLines(
  offset: number,
  state: HarthmereReputationState,
): string[] {
  const profile = getHarthmereNpcProfile(offset);
  const lines = [profile.conversationHook];
  const reaction = standingLine(offset, state);
  if (reaction) {
    lines.push(reaction);
  }
  if (offset !== 41) {
    lines.push(`Their day has a pattern: ${profile.schedule}.`);
    lines.push(`If trouble starts, ${profile.dangerResponse}.`);
    lines.push(profile.taskHook);
  } else {
    lines.push(profile.taskHook);
  }
  return lines;
}
