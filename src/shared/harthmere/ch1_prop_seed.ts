// CHAPTER_1_PROP_SEED
//
// The physical objects Chapter 1 asks the player to interact with.
//
// WHY THIS EXISTS
// Chapter 1's Act 1 was written as a domestic scene — wake up, eat what Jackie
// put in front of you, drink the tea, let her look through your pack — and none
// of those objects existed. Every one of them aliased to `jackie_post`, which is
// the town FOUNTAIN CENTRE. So the chapter opened by telling the player to get
// out of a bed that was not modelled, in the middle of a public plaza, and the
// tea resolved (via a substring collision) to a detained Take Terra courier 137
// metres away in the Rat Crowns drain.
//
// The road-house and watch-house shells are canonical voxel materialization
// plans (ch1_world_buildings.ts). These records are only the furniture, signs,
// hearth, bed, and storage placeables inside those buildings.
//
// GROUNDING
// Every prop uses its authored anchor's full 3D coordinate. The ground floor is
// hilly-world Y=70 while the cot belongs on the enclosed upper floor at Y=74.

import { BikkieIds } from "@/shared/bikkie/ids";
import { CH1_ANCHORS, type Ch1Vec3 } from "@/shared/harthmere/ch1_ids";
import { HARTHMERE_NATIVE_ITEM_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_id_manifest";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_ids";
import type { BiomesId } from "@/shared/ids";

export const CH1_PROP_SEED_VERSION = "ch1-prop-seed-v3" as const;

/**
 * Chapter 1 owns entity offsets 10500..10599 (ch1_ids.ts). NPCs use 10501-10512;
 * props take 10540 upward so the two ranges cannot collide as either grows.
 */
const CH1_PROP_ID_OFFSET_BASE = 10540;

export interface Ch1PropSeed {
  /** Stable key. Never reorder; append only. */
  key: string;
  entityId: BiomesId;
  /** Bikkie placeable to instantiate. */
  itemId: BiomesId;
  label: string;
  position: Ch1Vec3;
  orientation: readonly [number, number];
  /** Writer-facing note. Never shipped. */
  note: string;
}

function propId(offset: number): BiomesId {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + offset) as BiomesId;
}

const FACING_SOUTH: readonly [number, number] = [0, 0];
const FACING_NORTH: readonly [number, number] = [0, Math.PI];

export const CH1_PROPS: readonly Ch1PropSeed[] = Object.freeze([
  {
    key: "roadhouse_sign",
    entityId: propId(CH1_PROP_ID_OFFSET_BASE + 0),
    itemId: BikkieIds.smallOakSign,
    label: "The Grove Road-House",
    position: CH1_ANCHORS.roadhouse_sign,
    orientation: FACING_NORTH,
    note: "The public sign beside the east façade. It must never occupy the canonical voxel road-house doorway or its approach column.",
  },
  {
    key: "roadhouse_hearth",
    entityId: propId(CH1_PROP_ID_OFFSET_BASE + 1),
    itemId: BikkieIds.campfire,
    label: "Jackie's Kettle",
    position: CH1_ANCHORS.roadhouse_hearth,
    orientation: FACING_SOUTH,
    note: "Act 1 'the tea' is made here and Act 4 'notice' is watching her make it. A campfire is the engine's only lit, animated hearth placeable — there is no lamp or stove in the catalogue (world anatomy 4.3.3).",
  },
  {
    key: "roadhouse_table",
    entityId: propId(CH1_PROP_ID_OFFSET_BASE + 2),
    itemId: HARTHMERE_NATIVE_ITEM_ID_MANIFEST.table,
    label: "Jackie's Breakfast Table",
    position: CH1_ANCHORS.roadhouse_table,
    orientation: FACING_SOUTH,
    note: "A real furniture table in the enclosed ground-floor common room.",
  },
  {
    key: "roadhouse_bed",
    entityId: propId(CH1_PROP_ID_OFFSET_BASE + 3),
    itemId: HARTHMERE_NATIVE_ITEM_ID_MANIFEST.small_bed,
    label: "Spare Room Cot",
    position: CH1_ANCHORS.roadhouse_bed,
    orientation: FACING_SOUTH,
    note: "A real bed placeable inside the enclosed upstairs spare room.",
  },
  {
    key: "roadhouse_stores",
    entityId: propId(CH1_PROP_ID_OFFSET_BASE + 4),
    itemId: BikkieIds.treasureChest,
    label: "Road-House Stores",
    position: CH1_ANCHORS.roadhouse_stores,
    orientation: FACING_SOUTH,
    note: "Act 4 'search the stores' finds the dented tea tin here. Act 5 'take the rest' comes back for the remaining vials.",
  },
  {
    key: "coretta_ledger_desk",
    entityId: propId(CH1_PROP_ID_OFFSET_BASE + 5),
    itemId: HARTHMERE_NATIVE_ITEM_ID_MANIFEST.t_table,
    label: "Coretta's Ledger",
    position: CH1_ANCHORS.coretta_ledger_desk,
    orientation: FACING_NORTH,
    note: "Act 2 collects twelve accounts of the night the player arrived; Act 5 checks the dates against the ledger. Coretta had no entity and no desk.",
  },
  {
    key: "grove_watch_house_post",
    entityId: propId(CH1_PROP_ID_OFFSET_BASE + 6),
    itemId: BikkieIds.smallOakSign,
    label: "Grove Watch House",
    position: CH1_ANCHORS.grove_watch_house_door,
    orientation: FACING_NORTH,
    note: "Act 4 statement, Act 5 letter, Act 6 final scene. Jackie is held here for nine days and the location was a bare coordinate.",
  },
]);

export const CH1_PROP_ENTITY_IDS: readonly BiomesId[] = Object.freeze(
  CH1_PROPS.map((prop) => prop.entityId)
);

export function ch1Prop(key: string): Ch1PropSeed | undefined {
  return CH1_PROPS.find((prop) => prop.key === key);
}

/**
 * Where Chapter 1 stages the player when the chapter opens.
 *
 * The chapter used to begin wherever the player happened to be standing when
 * Muck vs. Machine completed — in the reported case, in muck combat in the Rat
 * Crowns drain — and then told them to get out of bed. Waking up somewhere is
 * the first thing the chapter says happens, so it has to be true.
 */
export function ch1ChapterOpeningPosition(): Ch1Vec3 {
  return CH1_ANCHORS.roadhouse_opening_spawn;
}
