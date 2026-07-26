// CHAPTER_1_ITEMS
//
// The Chapter 1 item catalogue, including the Card (the chapter's spine) and
// the two compounds.
//
// NAMING DISCIPLINE (journal §0): no client-visible string may contain
// "stillwater", "riverbed", "seven", or "anchor zero" before Act 6. The two
// compounds ship under opaque names and MUST be visually near-identical in
// inventory art until the climax. The player's inability to tell them apart is
// the plot.

import { CH1_FLAGS } from "@/shared/harthmere/ch1_ids";

export const CH1_ITEMS_VERSION = 1 as const;

export interface Ch1ItemDef {
  id: string;
  /** Name shown before the Act 6 consolidation. */
  name: string;
  /** Name shown after. Undefined => the item never renames. */
  revealedName?: string;
  description: string;
  revealedDescription?: string;
  /** Act in which the item first enters play. */
  act: number;
  droppable: boolean;
  sellable: boolean;
  /** Writer-facing. Never shipped. */
  writerNote?: string;
}

export const CH1_ITEMS: readonly Ch1ItemDef[] = Object.freeze([
  {
    id: "item_grey_card",
    name: "Grey Card",
    revealedName: "Custodian Key 7",
    description: "A card. Warm. You have no idea.",
    revealedDescription:
      "Custodian Key 7. It was never a keepsake. It is a key, and an instrument, and it has been telling you where reality is thin since the day you woke up, and you have been carrying it in a pocket like a bus ticket.",
    act: 1,
    droppable: false,
    sellable: false,
    writerNote:
      "The chapter's spine. Discovery order: warms near instability (A1) -> instrumentation, not jewellery (A2) -> a gate anchor Auggie refuses to explain (A3) -> it has storage, and 41 seconds of the player's own voice (A4) -> it is a custodian key and Sorrel has number 3 (A5) -> renamed on screen during the revision sequence (A6). Attempts to drop or sell it produce a small, wrong-feeling refusal.",
  },
  {
    id: "item_augur9_core_cell",
    name: "Core Cell",
    description:
      "A sealed Exotic Matter cell. Enough to keep a custodian unit lit for a while longer.",
    act: 1,
    droppable: true,
    sellable: false,
    writerNote:
      "+18 charge. The resource that makes remembering cost something.",
  },
  {
    id: "item_bulls_core",
    name: "The Bull's Core",
    description:
      "Two hundred years old and still bright. It was keeping something else alive until about an hour ago.",
    act: 3,
    droppable: true,
    sellable: false,
    writerNote:
      "+48 charge, the best recharge in the chapter. Using it means the Gilded Bull's death bought Auggie's life. Nobody comments on this.",
  },
  {
    id: "item_jackies_tin",
    name: "Dented Tea Tin",
    description:
      "A tea tin with the paint worn off the corners. There is a rack inside it.",
    act: 2,
    droppable: true,
    sellable: false,
    writerNote:
      "Background dressing for two acts. Evidence in Act 4. Contains the vials.",
  },
  {
    id: "item_ch1_compound_a",
    name: "Clear Ampoule",
    revealedName: "Stillwater",
    description: "Sealed. Unlabelled. Perfectly clear.",
    revealedDescription:
      "An anterograde and retrograde sequestrant. It does not destroy memory; it makes it inaccessible, and it is reversible, and it defends itself against being described to the person carrying it.",
    act: 6,
    droppable: false,
    sellable: false,
    writerNote:
      "The sequestrant. Must be visually near-identical to compound B in inventory art until Act 6.",
  },
  {
    id: "item_ch1_compound_b",
    name: "Unmarked Vial",
    revealedName: "Riverbed",
    description: "Sealed. Unlabelled. Perfectly clear.",
    revealedDescription:
      "The reversal agent. Twenty-two of them, roughly one a fortnight, for eleven months, in tea, in stew, in medicine that was pretended to be for something else.",
    act: 4,
    droppable: true,
    sellable: false,
    writerNote:
      "The mislead detonator, and the cure. Doc's analysis of it is accurate in every word and damning in every word.",
  },
  {
    id: "item_lou_case_notes",
    name: "Case Notes",
    description:
      "Six pages, handwritten, eleven years old. A complete patient file on an unnamed subject, volunteered without being asked for.",
    act: 3,
    droppable: false,
    sellable: false,
    writerNote:
      "CONTENT RULE: every sentence in this document must be verifiably TRUE and must remain true after Act 6. Its deceit is entirely by omission of the fourteen-hour intake window. If any sentence becomes a lie at the reveal, we have cheated.",
  },
  {
    id: "item_first_grain",
    name: "The First Grain",
    description:
      "A small dull bead, sealed and catalogued by a temple that dated it before the drought. Physically unremarkable. It predates every anchor on Earth, which makes it the last honest gram of matter you can get your hands on.",
    act: 3,
    droppable: false,
    sellable: false,
  },
  {
    id: "item_iris_button",
    name: "A Coat Button",
    description:
      "Modern. Sold in a Grove shop nine months ago. Found in a fold of sandal-print sand in a stratum three thousand years too old for it.",
    act: 3,
    droppable: false,
    sellable: false,
  },
  {
    id: "item_sorrel_field_ledger",
    name: "Field Ledger",
    description:
      "The unredacted original. Raw data, the model, the signatures, and the names of everyone who buried it. It has been carried across two thousand years in a coat.",
    act: 5,
    droppable: false,
    sellable: false,
    writerNote:
      "The thing the player gives away. The handover must be a player action with a confirmation prompt that reminds them of the oath.",
  },
  {
    id: "item_custodian_key_3",
    name: "Custodian Key 3",
    description:
      "Identical to yours in every particular except the number. Two keys together do something. She will not say what, because she wants you to remember it rather than be told.",
    act: 5,
    droppable: false,
    sellable: false,
  },
  {
    id: "item_rook_bell_iron_token",
    name: "Bell-Iron Token",
    description:
      "Harthmere safe-conduct. It does not open the bridge. It will stop a patrol from killing you once.",
    act: 4,
    droppable: false,
    sellable: false,
  },
  {
    id: "item_marrow_collar",
    name: "Marrow's Collar",
    description: "Worn leather. Somebody made this by hand for a dog they loved.",
    act: 3,
    droppable: false,
    sellable: false,
    writerNote: "Cosmetic. Emotional. Non-negotiable.",
  },
  {
    id: "item_hnefatafl_piece",
    name: "A Missing Piece",
    description:
      "One carved piece from a board game, taken from a hall that flooded and froze with everything still inside it.",
    act: 5,
    droppable: true,
    sellable: false,
    writerNote:
      "Carry it to Sorrel's camp and she will actually smile once. That is the entire reward and it is enough.",
  },
]);

const ITEMS_BY_ID = new Map(CH1_ITEMS.map((i) => [i.id, i]));

export function ch1Item(id: string): Ch1ItemDef | undefined {
  return ITEMS_BY_ID.get(id);
}

/**
 * The Card renames itself on screen during the consolidation sequence, and
 * both compounds acquire their real names at the same moment.
 */
export function ch1ItemDisplayName(
  id: string,
  flags: ReadonlySet<string> | readonly string[]
): string | undefined {
  const item = ITEMS_BY_ID.get(id);
  if (!item) {
    return undefined;
  }
  const set = flags instanceof Set ? flags : new Set(flags);
  if (set.has(CH1_FLAGS.act6TruthKnown) && item.revealedName) {
    return item.revealedName;
  }
  return item.name;
}

export function ch1ItemDescription(
  id: string,
  flags: ReadonlySet<string> | readonly string[]
): string | undefined {
  const item = ITEMS_BY_ID.get(id);
  if (!item) {
    return undefined;
  }
  const set = flags instanceof Set ? flags : new Set(flags);
  if (set.has(CH1_FLAGS.act6TruthKnown) && item.revealedDescription) {
    return item.revealedDescription;
  }
  return item.description;
}

/** Refusal copy for the Card. Small, and wrong-feeling on purpose. */
export const CH1_CARD_REFUSAL_LINES: readonly string[] = Object.freeze([
  "No.",
  "You put it back before you finish deciding to.",
  "Your hand does not open.",
]);
