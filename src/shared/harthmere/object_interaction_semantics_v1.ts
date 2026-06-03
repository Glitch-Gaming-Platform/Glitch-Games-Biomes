export const HARTHMERE_OBJECT_INTERACTION_SEMANTICS_VERSION_V1 =
  "harthmere-object-interaction-semantics-v1" as const;

export type HarthmereObjectInteractionKindV1 =
  | "open_container"
  | "open_door"
  | "open_gate"
  | "open_jobs_board"
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

export interface HarthmereObjectInteractionV1 {
  kind: HarthmereObjectInteractionKindV1;
  title: string;
  toastVerb: string;
}

const HARTHMERE_NON_LIVING_OBJECT_RE_V1 =
  /\b(crates?|chests?|box(?:es)?|barrels?|containers?|caches|satchels?|mailbags?|toolbags?|bags?|baskets?|bins?|lockers?|wardrobes?|cabinets?|shelves|shelf|workbenches|workbench|anvils?|boards?|signs?|posts?|markers?|ledgers?|books?|notes?|carts?|wagons?|lockboxes|strongboxes|stashes|footlockers?|stakes?|stones?|dumm(?:y|ies)|rings?|ropes?|firefl(?:y|ies)|flags?|pots?|fences?|boundar(?:y|ies)|tables?|desks?|mirrors?|moss|towers?|platforms?|offices?|chapels?|materials?|berries|patch(?:es)?|plots?|stretch|spots?|overlooks?|corners?|ovens?|beds?|stands?|cookpots?|pails?|mailboxes?|consoles?|terminals?|grates?|pillars?|candles?|altars?|shrines?|statues?|banners?|lamps?|braziers?|fountains?|wells?|gates?|doors?)\b/i;

const HARTHMERE_CONTAINER_OBJECT_RE_V1 =
  /\b(crates?|chests?|box(?:es)?|barrels?|containers?|caches|satchels?|mailbags?|toolbags?|bags?|baskets?|bins?|lockers?|wardrobes?|cabinets?|lockboxes|strongboxes|stashes|footlockers?)\b/i;

const HARTHMERE_LIVING_OBJECT_EXEMPTION_RE_V1 =
  /\b(robot|bot|construct|golem|person|traveler|runner|ranger|doctor|medic|clerk|banker|baker|cook|forager|courier|guard|wayfinder|farmer|merchant|vendor|mucker|hex|npc|human)\b/i;

const HARTHMERE_DOOR_OBJECT_RE_V1 = /\bdoors?\b/i;
const HARTHMERE_GATE_OBJECT_RE_V1 = /\bgates?\b/i;
const HARTHMERE_JOBS_BOARD_OBJECT_RE_V1 = /\bjobs?\s+boards?\b/i;
const HARTHMERE_READABLE_OBJECT_RE_V1 =
  /\b(boards?|signs?|posts?|markers?|ledgers?|books?|notes?|mailboxes?|consoles?|terminals?)\b/i;
const HARTHMERE_CRAFT_STATION_OBJECT_RE_V1 =
  /\b(workbenches|workbench|anvils?)\b/i;
const HARTHMERE_COOKING_STATION_OBJECT_RE_V1 = /\b(ovens?|cookpots?)\b/i;
const HARTHMERE_USE_OBJECT_RE_V1 = /\b(pots?|tables?|desks?)\b/i;
const HARTHMERE_RESOURCE_OBJECT_RE_V1 =
  /\b(berries|berry|muckwad|materials?|patch(?:es)?)\b/i;
const HARTHMERE_REPAIR_OBJECT_RE_V1 = /\b(repair|broken|scratch|fences?)\b/i;
const HARTHMERE_PRACTICE_OBJECT_RE_V1 =
  /\b(practice|dumm(?:y|ies)|rings?|ropes?|firefl(?:y|ies)|flags?|stakes?|stretch|spots?)\b/i;
const HARTHMERE_OUTFIT_OBJECT_RE_V1 =
  /\b(mirrors?|wardrobes?|outfits?|clothing|clothes|garments?)\b/i;
const HARTHMERE_PHOTO_OBJECT_RE_V1 =
  /\b(selfie|photo|camera|overlooks?|cove)\b/i;

function objectInteractionV1(
  kind: HarthmereObjectInteractionKindV1,
  title: string,
  toastVerb: string
): HarthmereObjectInteractionV1 {
  return { kind, title, toastVerb };
}

const HARTHMERE_AUTHORED_OBJECT_INTERACTIONS_V1: ReadonlyMap<
  string,
  HarthmereObjectInteractionV1
> = new Map(
  Object.entries({
    "berry patch": objectInteractionV1("gather", "Gather", "Gathered"),
    "billy's drop post": objectInteractionV1("read", "Read", "Read"),
    "billy's toolbag": objectInteractionV1(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "broken safe-zone fence": objectInteractionV1(
      "repair",
      "Repair",
      "Repaired"
    ),
    "building practice spot": objectInteractionV1(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "carlo's cookpot": objectInteractionV1("cook", "Cook", "Opened cooking at"),
    "charter trade desk": objectInteractionV1("use", "Use Desk", "Used"),
    "chat practice board": objectInteractionV1("read", "Read", "Read"),
    "chest the grove underwater main": objectInteractionV1(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "clothing crate": objectInteractionV1(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "compass practice ring": objectInteractionV1(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "consent sparring ring": objectInteractionV1(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "crossroads service tower": objectInteractionV1(
      "inspect",
      "Inspect",
      "Inspected"
    ),
    "doc's field table": objectInteractionV1("use", "Use Table", "Used"),
    "fern's sprout beds": objectInteractionV1("tend", "Tend", "Tended"),
    "first-aid bin": objectInteractionV1(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "fountain dim corner": objectInteractionV1(
      "inspect",
      "Inspect",
      "Inspected"
    ),
    "fountain food satchel": objectInteractionV1(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "fountain lesson board": objectInteractionV1("read", "Read", "Read"),
    "fountain repair post": objectInteractionV1("repair", "Repair", "Repaired"),
    "fountain workbench": objectInteractionV1(
      "craft",
      "Craft",
      "Opened crafting at"
    ),
    "garden edge berries": objectInteractionV1("gather", "Gather", "Gathered"),
    "grove guild charter board": objectInteractionV1("read", "Read", "Read"),
    "grove practice claim stakes": objectInteractionV1(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "guild project table": objectInteractionV1("use", "Use Table", "Used"),
    "gus's oven": objectInteractionV1("cook", "Cook", "Opened cooking at"),
    "harthmere chapel stone": objectInteractionV1(
      "inspect",
      "Inspect",
      "Inspected"
    ),
    "harthmere market office": objectInteractionV1(
      "inspect",
      "Inspect",
      "Inspected"
    ),
    "harthmere town jobs board": objectInteractionV1(
      "open_jobs_board",
      "Open Jobs Board",
      "Opened"
    ),
    "jobs board": objectInteractionV1(
      "open_jobs_board",
      "Open Jobs Board",
      "Opened"
    ),
    "kit's mailbag stand": objectInteractionV1(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "lost-and-found stone": objectInteractionV1(
      "recover",
      "Recover Items",
      "Checked recovery at"
    ),
    "lovely locks mirror": objectInteractionV1(
      "check_outfit",
      "Check Outfit",
      "Checked"
    ),
    "luis's repair cart": objectInteractionV1("repair", "Repair", "Repaired"),
    "mail and bank satchel": objectInteractionV1(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "marked practice materials": objectInteractionV1(
      "gather",
      "Gather",
      "Gathered"
    ),
    "mel's workbench": objectInteractionV1(
      "craft",
      "Craft",
      "Opened crafting at"
    ),
    "mosslawn song stones": objectInteractionV1(
      "inspect",
      "Inspect",
      "Inspected"
    ),
    "muckwad patch": objectInteractionV1("gather", "Gather", "Gathered"),
    "old grove road post": objectInteractionV1("read", "Read", "Read"),
    "old supply box": objectInteractionV1(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "painted route flags": objectInteractionV1(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "party rope marker": objectInteractionV1(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "practice drop stones": objectInteractionV1(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "practice guild bank crate": objectInteractionV1(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "practice land ledger": objectInteractionV1("read", "Read", "Read"),
    "practice scratch post": objectInteractionV1(
      "repair",
      "Repair",
      "Repaired"
    ),
    "ready check fireflies": objectInteractionV1(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "rin's forage basket": objectInteractionV1(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "road jump stretch": objectInteractionV1(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "road kit crate": objectInteractionV1(
      "open_container",
      "Open Container",
      "Opened"
    ),
    "safe-zone boundary stones": objectInteractionV1(
      "inspect",
      "Inspect",
      "Inspected"
    ),
    "selfie overlook": objectInteractionV1(
      "take_photo",
      "Take Photo",
      "Framed"
    ),
    "shutter cove photo marker": objectInteractionV1(
      "take_photo",
      "Take Photo",
      "Framed"
    ),
    "softwood practice dummy": objectInteractionV1(
      "practice",
      "Practice",
      "Practiced at"
    ),
    "taye's paint pot": objectInteractionV1("use", "Use Pot", "Used"),
    "warning moss patch": objectInteractionV1("gather", "Gather", "Gathered"),
  })
);

function objectTextV1(input: {
  label?: string | null;
  entityDescription?: string | null;
}) {
  return `${input.label ?? ""} ${input.entityDescription ?? ""}`.trim();
}

function normalizedLabelV1(label?: string | null) {
  return (label ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isHarthmereNonLivingObjectLabelV1(input: {
  label?: string | null;
  entityDescription?: string | null;
}) {
  const text = objectTextV1(input);
  if (!text) {
    return false;
  }
  return (
    HARTHMERE_NON_LIVING_OBJECT_RE_V1.test(text) &&
    !HARTHMERE_LIVING_OBJECT_EXEMPTION_RE_V1.test(text)
  );
}

export function isHarthmereContainerObjectLabelV1(input: {
  label?: string | null;
  entityDescription?: string | null;
}) {
  const text = objectTextV1(input);
  if (!text) {
    return false;
  }
  return (
    HARTHMERE_CONTAINER_OBJECT_RE_V1.test(text) &&
    !HARTHMERE_LIVING_OBJECT_EXEMPTION_RE_V1.test(text)
  );
}

function stationTitleForObjectTextV1(text: string) {
  if (/\bworkbenches|workbench\b/i.test(text)) {
    return "Craft";
  }
  if (/\banvils?\b/i.test(text)) {
    return "Craft";
  }
  if (/\bovens?\b/i.test(text)) {
    return "Cook";
  }
  if (/\bcookpots?\b/i.test(text)) {
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

export function harthmereObjectInteractionForLabelV1(input: {
  label?: string | null;
  entityDescription?: string | null;
}): HarthmereObjectInteractionV1 | undefined {
  const text = objectTextV1(input);
  if (!isHarthmereNonLivingObjectLabelV1(input)) {
    return undefined;
  }
  if (isHarthmereContainerObjectLabelV1(input)) {
    return {
      kind: "open_container",
      title: "Open Container",
      toastVerb: "Opened",
    };
  }
  const authoredInteraction = HARTHMERE_AUTHORED_OBJECT_INTERACTIONS_V1.get(
    normalizedLabelV1(input.label)
  );
  if (authoredInteraction) {
    return authoredInteraction;
  }
  if (HARTHMERE_DOOR_OBJECT_RE_V1.test(text)) {
    return { kind: "open_door", title: "Open Door", toastVerb: "Opened" };
  }
  if (HARTHMERE_GATE_OBJECT_RE_V1.test(text)) {
    return { kind: "open_gate", title: "Open Gate", toastVerb: "Opened" };
  }
  if (HARTHMERE_JOBS_BOARD_OBJECT_RE_V1.test(text)) {
    return {
      kind: "open_jobs_board",
      title: "Open Jobs Board",
      toastVerb: "Opened",
    };
  }
  if (HARTHMERE_PHOTO_OBJECT_RE_V1.test(text)) {
    return { kind: "take_photo", title: "Take Photo", toastVerb: "Framed" };
  }
  if (HARTHMERE_OUTFIT_OBJECT_RE_V1.test(text)) {
    return {
      kind: "check_outfit",
      title: "Check Outfit",
      toastVerb: "Checked",
    };
  }
  if (HARTHMERE_REPAIR_OBJECT_RE_V1.test(text)) {
    return { kind: "repair", title: "Repair", toastVerb: "Repaired" };
  }
  if (HARTHMERE_RESOURCE_OBJECT_RE_V1.test(text)) {
    return { kind: "gather", title: "Gather", toastVerb: "Gathered" };
  }
  if (HARTHMERE_READABLE_OBJECT_RE_V1.test(text)) {
    return { kind: "read", title: "Read", toastVerb: "Read" };
  }
  if (HARTHMERE_COOKING_STATION_OBJECT_RE_V1.test(text)) {
    return {
      kind: "cook",
      title: stationTitleForObjectTextV1(text),
      toastVerb: "Opened cooking at",
    };
  }
  if (HARTHMERE_CRAFT_STATION_OBJECT_RE_V1.test(text)) {
    return {
      kind: "craft",
      title: stationTitleForObjectTextV1(text),
      toastVerb: "Opened crafting at",
    };
  }
  if (HARTHMERE_USE_OBJECT_RE_V1.test(text)) {
    return {
      kind: "use",
      title: stationTitleForObjectTextV1(text),
      toastVerb: "Used",
    };
  }
  if (HARTHMERE_PRACTICE_OBJECT_RE_V1.test(text)) {
    return { kind: "practice", title: "Practice", toastVerb: "Practiced at" };
  }
  return { kind: "inspect", title: "Inspect", toastVerb: "Inspected" };
}
