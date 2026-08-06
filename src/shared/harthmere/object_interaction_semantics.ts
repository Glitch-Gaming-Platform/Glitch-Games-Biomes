export const HARTHMERE_OBJECT_INTERACTION_SEMANTICS_VERSION =
  "harthmere-object-interaction-semantics" as const;

export type HarthmereObjectInteractionKind =
  | "open_container"
  | "open_door"
  | "open_gate"
  | "open_jobs_board"
  | "open_wanted_board"
  | "read"
  | "craft"
  | "cook"
  | "use"
  | "gather"
  | "repair"
  | "recover"
  | "tend"
  | "practice"
  | "check_outfit"
  | "take_photo"
  | "inspect";

/** Physical recipe authority used by cooking interactions.
 *  Mirrors the cookable station kinds in mmo_farming_food_stamina (excluding
 *  the station-less "field" recipes). A stove uses the authored oven recipe
 *  class rather than inventing a fourth incompatible recipe authority. */
export type HarthmereCookStationKind = "campfire" | "cookpot" | "oven";

export interface HarthmereObjectInteraction {
  kind: HarthmereObjectInteractionKind;
  title: string;
  toastVerb: string;
  /** Set for kind === "cook": which physical station this object represents. */
  stationKind?: HarthmereCookStationKind;
}

// Connector names such as "Road Muckling" or "Road Bandit" are also used by
// living entities. Do not classify bare road/trailhead words as object
// capabilities; route markers are navigation data unless they own a concrete
// sign/post/board component or authored object label.
// HARTHMERE_SINGULAR_CONTAINER_NOUNS (2026-07-29): `caches`, `lockboxes`,
// `strongboxes`, and `stashes` were plural-only, so a world object literally
// labelled "Lockbox" (a real decor item id) or "Safe Ruin Cache" failed the
// non-living gate and could never surface an F prompt. Both forms now match.
const HARTHMERE_NON_LIVING_OBJECT_RE =
  /\b(crates?|chests?|box(?:es)?|barrels?|containers?|caches?|satchels?|mailbags?|toolbags?|bags?|baskets?|bins?|lockers?|wardrobes?|cabinets?|shelves|shelf|workbenches|workbench|anvils?|tools?|boards?|signs?|posts?|markers?|inscriptions?|plates?|ledgers?|books?|notes?|letters?|orders?|strips?|feed|carts?|wagons?|lockbox(?:es)?|strongbox(?:es)?|stash(?:es)?|footlockers?|stakes?|stones?|rubbings?|dumm(?:y|ies)|rings?|ropes?|firefl(?:y|ies)|flags?|pots?|cook\s+pots?|cooking\s+pots?|soup\s+pots?|stew\s+pots?|kettles?|fences?|boundar(?:y|ies)|tables?|desks?|mirrors?|moss|towers?|platforms?|offices?|chapels?|materials?|berries|patch(?:es)?|clumps?|plots?|branches?|softwood|harvests?|remains?|carcasses?|sounders?|stretch|spots?|overlooks?|corners?|ovens?|stoves?|beds?|stands?|cookpots?|campfires?|camp\s+fires?|firepits?|fire\s+pits?|fire\s+rings?|hearths?|cooking\s+fires?|pails?|mailboxes?|consoles?|terminals?|grates?|pillars?|candles?|altars?|shrines?|statues?|banners?|lamps?|braziers?|fountains?|wells?|gates?|doors?)\b/i;

const HARTHMERE_CONTAINER_OBJECT_RE =
  /\b(crates?|chests?|box(?:es)?|barrels?|containers?|caches?|satchels?|mailbags?|toolbags?|bags?|baskets?|bins?|lockers?|wardrobes?|cabinets?|lockbox(?:es)?|strongbox(?:es)?|stash(?:es)?|footlockers?)\b/i;

const HARTHMERE_LIVING_OBJECT_EXEMPTION_RE =
  /\b(robot|bot|construct|golem|person|traveler|runner|ranger|doctor|medic|clerk|banker|baker|cook|forager|courier|guard|wayfinder|farmer|merchant|vendor|mucker|hex|npc|human)\b/i;

const HARTHMERE_DOOR_OBJECT_RE = /\bdoors?\b/i;
const HARTHMERE_GATE_OBJECT_RE = /\bgates?\b/i;
const HARTHMERE_JOBS_BOARD_OBJECT_RE = /\bjobs?\s+boards?\b/i;
const HARTHMERE_WANTED_BOARD_OBJECT_RE =
  /\b(?:wanted|bount(?:y|ies)|warrants?|patrol)\s+(?:boards?|posts?|notices?)\b|\b(?:boards?|posts?|notices?)\s+(?:wanted|bount(?:y|ies)|warrants?|patrol)\b/i;
const HARTHMERE_READABLE_OBJECT_RE =
  /\b(boards?|signs?|posts?|markers?|inscriptions?|plates?|ledgers?|books?|notes?|mailboxes?|consoles?|terminals?)\b/i;
const HARTHMERE_CRAFT_STATION_OBJECT_RE =
  /\b(workbenches|workbench|anvils?|craft\s+tables?|crafting\s+tables?)\b/i;
const HARTHMERE_COOKING_STATION_OBJECT_RE =
  /\b(ovens?|stoves?|cookpots?|cook\s+pots?|cooking\s+pots?|soup\s+pots?|stew\s+pots?|kitchen\s+pots?|kettles?|campfires?|camp\s+fires?|firepits?|fire\s+pits?|fire\s+rings?|hearths?|cooking\s+fires?|pots?)\b/i;
const HARTHMERE_USE_OBJECT_RE = /\b(pots?|tables?|desks?)\b/i;
const HARTHMERE_RESOURCE_OBJECT_RE =
  /\b(berries|berry|muckwad|materials?|patch(?:es)?|clumps?|branches?|softwood|harvests?|remains?|carcasses?|sounders?)\b/i;
const HARTHMERE_REPAIR_OBJECT_RE = /\b(repair|broken|scratch|fences?)\b/i;
const HARTHMERE_PRACTICE_OBJECT_RE =
  /\b(practice|dumm(?:y|ies)|rings?|ropes?|firefl(?:y|ies)|flags?|stakes?|stretch|spots?)\b/i;
const HARTHMERE_OUTFIT_OBJECT_RE =
  /\b(mirrors?|wardrobes?|outfits?|clothing|clothes|garments?)\b/i;
const HARTHMERE_PHOTO_OBJECT_RE = /\b(selfie|photo|camera|overlooks?|cove)\b/i;

function objectInteraction(
  kind: HarthmereObjectInteractionKind,
  title: string,
  toastVerb: string,
  stationKind?: HarthmereCookStationKind
): HarthmereObjectInteraction {
  return stationKind
    ? { kind, title, toastVerb, stationKind }
    : { kind, title, toastVerb };
}

/** Resolves which physical cooking station a label/description represents. */
export function harthmereCookStationKindForText(
  text: string
): HarthmereCookStationKind {
  if (/\b(ovens?|stoves?)\b/i.test(text)) return "oven";
  if (
    /\b(cookpots?|cook\s+pots?|cooking\s+pots?|soup\s+pots?|stew\s+pots?|kitchen\s+pots?|kettles?|pots?)\b/i.test(
      text
    )
  ) {
    return "cookpot";
  }
  return "campfire";
}

const HARTHMERE_AUTHORED_OBJECT_INTERACTIONS: ReadonlyMap<
  string,
  HarthmereObjectInteraction
> = new Map(
  Object.entries({
    "berry patch": objectInteraction("gather", "Gather", "Gathered"),
    "billy's drop post": objectInteraction("read", "Read", "Read"),
    "billy's toolbag": objectInteraction(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "broken safe-zone fence": objectInteraction("repair", "Repair", "Repaired"),
    "building practice spot": objectInteraction(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "carlo's cookpot": objectInteraction(
      "cook",
      "Cook",
      "Opened cooking at",
      "cookpot"
    ),
    "camp fire": objectInteraction(
      "cook",
      "Cook",
      "Opened cooking at",
      "campfire"
    ),
    campfire: objectInteraction(
      "cook",
      "Cook",
      "Opened cooking at",
      "campfire"
    ),
    "charter trade desk": objectInteraction("use", "Use Desk", "Used"),
    "chat practice board": objectInteraction("read", "Read", "Read"),
    "chest the grove underwater main": objectInteraction(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "clothing crate": objectInteraction(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "compass practice ring": objectInteraction(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "consent sparring ring": objectInteraction(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "crossroads service tower": objectInteraction(
      "inspect",
      "Inspect",
      "Inspected"
    ),
    "doc's field table": objectInteraction("use", "Use Table", "Used"),
    "fern's sprout beds": objectInteraction("tend", "Tend", "Tended"),
    "first-aid bin": objectInteraction(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "fountain dim corner": objectInteraction("inspect", "Inspect", "Inspected"),
    "fountain food satchel": objectInteraction(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "fountain lesson board": objectInteraction("read", "Read", "Read"),
    "fountain repair post": objectInteraction("repair", "Repair", "Repaired"),
    "fountain workbench": objectInteraction(
      "craft",
      "Craft",
      "Opened crafting at"
    ),
    "garden edge berries": objectInteraction("gather", "Gather", "Gathered"),
    "grove guild charter board": objectInteraction("read", "Read", "Read"),
    "grove practice claim stakes": objectInteraction(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "guild project table": objectInteraction("use", "Use Table", "Used"),
    "gus's oven": objectInteraction(
      "cook",
      "Cook",
      "Opened cooking at",
      "oven"
    ),
    "cooking pot": objectInteraction(
      "cook",
      "Cook",
      "Opened cooking at",
      "cookpot"
    ),
    "harthmere chapel stone": objectInteraction(
      "inspect",
      "Inspect",
      "Inspected"
    ),
    "harthmere market office": objectInteraction(
      "inspect",
      "Inspect",
      "Inspected"
    ),
    "harthmere town jobs board": objectInteraction(
      "open_jobs_board",
      "Open Jobs Board",
      "Opened"
    ),
    "jobs board": objectInteraction(
      "open_jobs_board",
      "Open Jobs Board",
      "Opened"
    ),
    "wanted board": objectInteraction(
      "open_wanted_board",
      "Open Wanted Board",
      "Opened"
    ),
    "farming wanted board": objectInteraction(
      "open_wanted_board",
      "Open Wanted Board",
      "Opened"
    ),
    "bounty board": objectInteraction(
      "open_wanted_board",
      "Open Wanted Board",
      "Opened"
    ),
    "kit's mailbag stand": objectInteraction(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "lost-and-found stone": objectInteraction(
      "recover",
      "Recover Items",
      "Checked recovery at"
    ),
    "lovely locks mirror": objectInteraction(
      "check_outfit",
      "Check Outfit",
      "Checked"
    ),
    "luis's repair cart": objectInteraction("repair", "Repair", "Repaired"),
    "mail and bank satchel": objectInteraction(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "marked practice materials": objectInteraction(
      "gather",
      "Gather",
      "Gathered"
    ),
    "billy's lunch pail": objectInteraction("gather", "Pick Up", "Picked up"),
    "coop's dropped feed": objectInteraction("gather", "Pick Up", "Picked up"),
    "jackie's sealed letter": objectInteraction(
      "gather",
      "Pick Up",
      "Picked up"
    ),
    "luis's bolt order": objectInteraction("gather", "Pick Up", "Picked up"),
    "sil's tuning strip": objectInteraction("gather", "Pick Up", "Picked up"),
    "mel's workbench": objectInteraction(
      "craft",
      "Craft",
      "Opened crafting at"
    ),
    "mosslawn song stones": objectInteraction(
      "inspect",
      "Inspect",
      "Inspected"
    ),
    "muckwad patch": objectInteraction("gather", "Gather", "Gathered"),
    "old grove road post": objectInteraction("read", "Read", "Read"),
    "old supply box": objectInteraction(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "orchard softwood branches": objectInteraction(
      "gather",
      "Gather",
      "Gathered"
    ),
    "painted route flags": objectInteraction(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "party rope marker": objectInteraction(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "practice drop stones": objectInteraction(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "practice guild bank crate": objectInteraction(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "practice land ledger": objectInteraction("read", "Read", "Read"),
    "practice scratch post": objectInteraction("repair", "Repair", "Repaired"),
    "ready check fireflies": objectInteraction(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "rin's forage basket": objectInteraction(
      "gather",
      "Gather Mushrooms",
      "Gathered from"
    ),
    "road jump stretch": objectInteraction(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "road kit crate": objectInteraction(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "boar sounder harvest": objectInteraction("gather", "Gather", "Gathered"),
    "safe-zone boundary stones": objectInteraction(
      "inspect",
      "Inspect",
      "Inspected"
    ),
    "selfie overlook": objectInteraction("take_photo", "Take Photo", "Framed"),
    "shutter cove photo marker": objectInteraction(
      "take_photo",
      "Take Photo",
      "Framed"
    ),
    "softwood practice dummy": objectInteraction(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "taye's paint pot": objectInteraction("use", "Use Pot", "Used"),
    "warning moss patch": objectInteraction("gather", "Gather", "Gathered"),
    "west warning moss patch": objectInteraction("gather", "Gather", "Gathered"),
    "center warning moss patch": objectInteraction("gather", "Gather", "Gathered"),
    "silent warning moss patch": objectInteraction("gather", "Gather", "Gathered"),
    "west pigment muck clump": objectInteraction("gather", "Gather", "Gathered"),
    "east pigment muck clump": objectInteraction("gather", "Gather", "Gathered"),
    "low moss song stone": objectInteraction("inspect", "Inspect", "Inspected"),
    "middle moss song stone": objectInteraction("inspect", "Inspect", "Inspected"),
    "high moss song stone": objectInteraction("inspect", "Inspect", "Inspected"),
    "hoof track rubbing": objectInteraction("gather", "Take Rubbing", "Took rubbing from"),
    "antler track rubbing": objectInteraction("gather", "Take Rubbing", "Took rubbing from"),
    "claw track rubbing": objectInteraction("gather", "Take Rubbing", "Took rubbing from"),
    "gus's marked loaf basket": objectInteraction("gather", "Pick Up", "Picked up"),
    "marked bolt materials": objectInteraction("gather", "Pick Up", "Picked up"),

    // HARTHMERE_JOBS_BOARD_FIELD_TARGET_SEMANTICS
    // The 19 business job-template targets and the 19 outpost starter work
    // stations (see jobs_board_field_targets.ts). Authored entries win over the
    // shape classifier, so a "Farm Supply Crate" delivery point is a hand-in
    // action rather than a lootable container, and every one of these resolves
    // to a kind the authoritative world-object receipt validator accepts.
    "refinery intake terminal": objectInteraction(
      "use",
      "Deliver Exotic Matter",
      "Delivered to"
    ),
    "biome anchor leak pillar": objectInteraction(
      "repair",
      "Patch Anchor",
      "Patched"
    ),
    "design studio workbench": objectInteraction(
      "use",
      "Hand In Materials",
      "Delivered to"
    ),
    "trade route watch post": objectInteraction(
      "inspect",
      "Report Patrol",
      "Reported at"
    ),
    "portal gate office terminal": objectInteraction(
      "use",
      "Deliver Portal Fuel",
      "Delivered to"
    ),
    "farm supply crate": objectInteraction(
      "use",
      "Deliver Crop Bundles",
      "Delivered to"
    ),
    "forge material bin": objectInteraction(
      "use",
      "Deliver Iron Ore",
      "Delivered to"
    ),
    "safe ruin cache": objectInteraction(
      "gather",
      "Recover Relic Fragment",
      "Recovered from"
    ),
    "old route marker stone": objectInteraction(
      "inspect",
      "Survey Route",
      "Surveyed"
    ),
    "property material crate": objectInteraction(
      "use",
      "Deliver Building Materials",
      "Delivered to"
    ),
    "trader ration crate": objectInteraction(
      "use",
      "Stock Rations",
      "Stocked"
    ),
    "hunter larder shelf": objectInteraction(
      "use",
      "Deliver Wild Meat",
      "Delivered to"
    ),
    "clinic supply shelf": objectInteraction(
      "use",
      "Deliver Herb Bundles",
      "Delivered to"
    ),
    "teleport pad terminal": objectInteraction(
      "use",
      "Deliver Destination Crystals",
      "Delivered to"
    ),
    "sanitation barrels": objectInteraction(
      "use",
      "Return Mixed Waste",
      "Returned to"
    ),
    "broken market fixture stand": objectInteraction(
      "repair",
      "Repair Fixture",
      "Repaired"
    ),
    "restaurant kitchen prep table": objectInteraction(
      "use",
      "Deliver Ingredients",
      "Delivered to"
    ),
    "clinic delivery lockbox": objectInteraction(
      "use",
      "Deliver Sealed Package",
      "Delivered to"
    ),
    "inn linen shelf": objectInteraction(
      "use",
      "Deliver Linen Bundles",
      "Delivered to"
    ),

    // Outpost starter work stations — the actual described shift work.
    "refinery stock shelf": objectInteraction("use", "Sort Stock", "Sorted"),
    "anchor parts table": objectInteraction(
      "use",
      "Prep Anchor Parts",
      "Prepped"
    ),
    "design sample table": objectInteraction(
      "use",
      "Lay Out Samples",
      "Laid out"
    ),
    "patrol duty board": objectInteraction(
      "use",
      "Sign On For Patrol",
      "Signed on at"
    ),
    "transit manifest desk": objectInteraction(
      "use",
      "Check Manifests",
      "Checked"
    ),
    "seed sorting table": objectInteraction(
      "use",
      "Sort Seed Trays",
      "Sorted"
    ),
    "tool order bin": objectInteraction("use", "Fill Tool Orders", "Filled"),
    "ward component shelf": objectInteraction(
      "use",
      "Sort Ward Components",
      "Sorted"
    ),
    "route planning table": objectInteraction("use", "Plot Routes", "Plotted"),
    "build order table": objectInteraction(
      "use",
      "Check Build Orders",
      "Checked"
    ),
    "market stock shelf": objectInteraction("use", "Restock Shelf", "Restocked"),
    "meat wrapping table": objectInteraction("use", "Wrap Meat", "Wrapped"),
    "bandage prep table": objectInteraction(
      "use",
      "Prepare Bandages",
      "Prepared"
    ),
    "pad calibration terminal": objectInteraction(
      "use",
      "Calibrate Pad",
      "Calibrated"
    ),
    "hazard marking post": objectInteraction("use", "Mark Hazards", "Marked"),
    "fixture labelling table": objectInteraction(
      "use",
      "Label Fixtures",
      "Labelled"
    ),
    "service line prep table": objectInteraction(
      "use",
      "Prep Service Line",
      "Prepped"
    ),
    "parcel sorting table": objectInteraction("use", "Sort Parcels", "Sorted"),
    "guest room linen shelf": objectInteraction(
      "use",
      "Reset Guest Rooms",
      "Reset"
    ),
  })
);

function objectText(input: {
  label?: string | null;
  entityDescription?: string | null;
}) {
  return `${input.label ?? ""} ${input.entityDescription ?? ""}`.trim();
}

function normalizedLabel(label?: string | null) {
  return (label ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isHarthmereNonLivingObjectLabel(input: {
  label?: string | null;
  entityDescription?: string | null;
}) {
  const text = objectText(input);
  if (!text) {
    return false;
  }
  if (!HARTHMERE_NON_LIVING_OBJECT_RE.test(text)) {
    return false;
  }
  if (
    HARTHMERE_CONTAINER_OBJECT_RE.test(text) ||
    HARTHMERE_COOKING_STATION_OBJECT_RE.test(text)
  ) {
    return true;
  }
  if (
    HARTHMERE_JOBS_BOARD_OBJECT_RE.test(text) ||
    HARTHMERE_WANTED_BOARD_OBJECT_RE.test(text)
  ) {
    return true;
  }
  return !HARTHMERE_LIVING_OBJECT_EXEMPTION_RE.test(text);
}

export function isHarthmereContainerObjectLabel(input: {
  label?: string | null;
  entityDescription?: string | null;
}) {
  const text = objectText(input);
  if (!text) {
    return false;
  }
  return HARTHMERE_CONTAINER_OBJECT_RE.test(text);
}

function stationTitleForObjectText(text: string) {
  if (/\b(craft\s+tables?|crafting\s+tables?)\b/i.test(text)) {
    return "Craft";
  }
  if (/\bworkbenches|workbench\b/i.test(text)) {
    return "Craft";
  }
  if (/\banvils?\b/i.test(text)) {
    return "Craft";
  }
  if (/\bovens?\b/i.test(text)) {
    return "Cook";
  }
  if (
    /\b(cookpots?|cook\s+pots?|cooking\s+pots?|soup\s+pots?|stew\s+pots?|kitchen\s+pots?|kettles?|pots?)\b/i.test(
      text
    )
  ) {
    return "Cook";
  }
  if (
    /\b(campfires?|camp\s+fires?|firepits?|fire\s+pits?|fire\s+rings?|hearths?|cooking\s+fires?)\b/i.test(
      text
    )
  ) {
    return "Cook";
  }
  if (/\bpots?\b/i.test(text)) {
    return "Use Pot";
  }
  if (/\bdesks?\b/i.test(text)) {
    return "Use Desk";
  }
  if (/\btables?\b/i.test(text)) {
    return "Use Table";
  }
  return "Use";
}

export function harthmereObjectInteractionForLabel(input: {
  label?: string | null;
  entityDescription?: string | null;
}): HarthmereObjectInteraction | undefined {
  const text = objectText(input);
  if (!isHarthmereNonLivingObjectLabel(input)) {
    return undefined;
  }
  // Exact authored semantics win over the broad shape classifier. This lets a
  // quest basket be a harvest target while ordinary baskets remain containers.
  const authoredInteraction = HARTHMERE_AUTHORED_OBJECT_INTERACTIONS.get(
    normalizedLabel(input.label)
  );
  if (authoredInteraction) {
    return authoredInteraction;
  }
  if (isHarthmereContainerObjectLabel(input)) {
    return {
      kind: "open_container",
      title: "Open Container",
      toastVerb: "Opened",
    };
  }
  if (HARTHMERE_DOOR_OBJECT_RE.test(text)) {
    return { kind: "open_door", title: "Open Door", toastVerb: "Opened" };
  }
  if (HARTHMERE_GATE_OBJECT_RE.test(text)) {
    return { kind: "open_gate", title: "Open Gate", toastVerb: "Opened" };
  }
  if (HARTHMERE_WANTED_BOARD_OBJECT_RE.test(text)) {
    return {
      kind: "open_wanted_board",
      title: "Open Wanted Board",
      toastVerb: "Opened",
    };
  }
  if (HARTHMERE_JOBS_BOARD_OBJECT_RE.test(text)) {
    return {
      kind: "open_jobs_board",
      title: "Open Jobs Board",
      toastVerb: "Opened",
    };
  }
  if (HARTHMERE_PHOTO_OBJECT_RE.test(text)) {
    return { kind: "take_photo", title: "Take Photo", toastVerb: "Framed" };
  }
  if (HARTHMERE_OUTFIT_OBJECT_RE.test(text)) {
    return {
      kind: "check_outfit",
      title: "Check Outfit",
      toastVerb: "Checked",
    };
  }
  if (HARTHMERE_REPAIR_OBJECT_RE.test(text)) {
    return { kind: "repair", title: "Repair", toastVerb: "Repaired" };
  }
  if (HARTHMERE_RESOURCE_OBJECT_RE.test(text)) {
    return { kind: "gather", title: "Gather", toastVerb: "Gathered" };
  }
  if (HARTHMERE_READABLE_OBJECT_RE.test(text)) {
    return { kind: "read", title: "Read", toastVerb: "Read" };
  }
  if (HARTHMERE_COOKING_STATION_OBJECT_RE.test(text)) {
    return {
      kind: "cook",
      title: stationTitleForObjectText(text),
      toastVerb: "Opened cooking at",
      stationKind: harthmereCookStationKindForText(text),
    };
  }
  if (HARTHMERE_CRAFT_STATION_OBJECT_RE.test(text)) {
    return {
      kind: "craft",
      title: stationTitleForObjectText(text),
      toastVerb: "Opened crafting at",
    };
  }
  if (HARTHMERE_USE_OBJECT_RE.test(text)) {
    return {
      kind: "use",
      title: stationTitleForObjectText(text),
      toastVerb: "Used",
    };
  }
  if (HARTHMERE_PRACTICE_OBJECT_RE.test(text)) {
    return { kind: "practice", title: "Practice", toastVerb: "Practiced at" };
  }
  return { kind: "inspect", title: "Inspect", toastVerb: "Inspected" };
}

// HARTHMERE_AUTHORED_CONTAINER_FLOW:
// A container-shaped noun is only presentation. Exact authored semantics own
// the action: a Farm Supply Crate is a delivery hand-in, Rin's basket is a
// gather target, and an ordinary Road Kit Crate is a real container. Keeping
// this decision beside the resolver prevents cursor/UI callers from bypassing
// those exact authored overrides with the broad noun classifier.
export function harthmereObjectUsesContainerFlow(input: {
  label?: string | null;
  entityDescription?: string | null;
}): boolean {
  return harthmereObjectInteractionForLabel(input)?.kind === "open_container";
}
