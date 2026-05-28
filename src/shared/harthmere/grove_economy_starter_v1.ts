// GROVE_ECONOMY_STARTER_V1
//
// Adds six new Grove economy townsfolk and fifteen starter-cash quests
// aligned with the early-game progression in
// biomes_futuristic_society_business_economy.pdf: Courier, General Trader,
// Hunter, Biome Farming, Food Cart/Cook, Exploration Guide, Repair Person.
//
// The new NPCs are styled as voxel/procedural townsfolk (see
// grove_townsfolk_appearance_v1.ts) so the same patch that gives them quests
// also gives them unique appearances; this addresses the "bland NPCs in the
// grove" feedback.
//
// Quest rewards use bling (the Grove currency). Total payout across all 15
// quests is ~270 bling, which is enough to bootstrap a tier-1 courier or
// handyman business per the economy PDF, or to put a meaningful dent in the
// tier-1 housing/shelter beds cost (700 credits).
//
// The quest data conforms to SnapshotGroveQuestV75 and the trigger contract
// in snapshot_grove_trigger_contract_v112.ts. Each quest's objectives,
// triggers, and markerIds arrays are parallel and length-aligned so the
// grove_quest_per_state_v1 test suite covers them automatically.

import {
  SNAPSHOT_GROVE_NPC_FEET_Y_V75,
  snapshotGroveFountainPositionV105,
  type SnapshotGroveLandmarkV75,
  type SnapshotGroveNpcV75,
  type SnapshotGroveQuestV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";

export const GROVE_ECONOMY_STARTER_VERSION_V1 =
  "grove-economy-starter-v1" as const;

// ---------------------------------------------------------------------------
// 6 new Grove NPCs — early-economy archetypes from the economy PDF.
//
// Each entry advertises a `proceduralAppearanceSpec` field so the appearance
// manifest in grove_townsfolk_appearance_v1.ts can render them with unique
// voxel/procedural skins instead of the default bland sphere. The field is
// optional on the base type, so adding it here does not break any consumer.
// ---------------------------------------------------------------------------

export interface GroveTownsfolkProceduralSpecV1 {
  // Stable seed (hashed at appearance time) so each townsfolk gets a
  // reproducible color/silhouette without an authored .glb asset.
  voxelSeed: string;
  // Body palette key (skin / shirt / pants / accessory tints).
  palette: "warm" | "cool" | "earth" | "ash" | "violet" | "rust";
  // Head/torso/hat silhouette template.
  silhouette:
    | "baker"
    | "courier"
    | "gardener"
    | "handyman"
    | "forager"
    | "cook"
    | "townsfolk";
}

export interface GroveTownsfolkNpcV1
  extends Omit<SnapshotGroveNpcV75, "snapshotAsset"> {
  proceduralAppearanceSpec: GroveTownsfolkProceduralSpecV1;
}

const FEET_Y = SNAPSHOT_GROVE_NPC_FEET_Y_V75;

export const GROVE_ECONOMY_STARTER_NPCS_V1: GroveTownsfolkNpcV1[] = [
  {
    id: "gus_the_baker",
    displayName: "Gus the Baker",
    idOffset: 9320,
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Fountain baker, ration packer, and dawn supplier",
    authoredPosition: snapshotGroveFountainPositionV105(-10, 0),
    orientation: [0, 1.6],
    shortDescription:
      "A baker whose oven warms the fountain at dawn and feeds every early-shift worker.",
    background:
      "Gus opens before sunrise so the road has bread before it has light. He pays runners and gardeners in bling and crusts.",
    motivation:
      "Keep every road kit stocked with at least one loaf before the day's first emergency.",
    line: "Bread is the first map most people read. Make sure yours is fresh.",
    extraLines: [
      "If you can carry it warm, I will pay you. Cold delivery, half wage.",
      "Grain to oven. Oven to satchel. Satchel to neighbor. That is the whole economy.",
    ],
    likeabilityTags: ["baker", "fountain", "economy-starter"],
    proceduralAppearanceSpec: {
      voxelSeed: "gus-the-baker-2026",
      palette: "warm",
      silhouette: "baker",
    },
  },
  {
    id: "fern_the_grower",
    displayName: "Fern the Grower",
    idOffset: 9321,
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Garden-bed keeper and herb supplier",
    authoredPosition: snapshotGroveFountainPositionV105(0, 8),
    orientation: [0, 3.1],
    shortDescription:
      "A patient gardener who keeps the Grove's herb beds alive through muck-edge weather.",
    background:
      "Fern grew up tending sprout beds and learned that nothing in this town grows without trade. She pays gatherers in bling per basket.",
    motivation:
      "Build a steady local herb supply so Doc and Gus stop trading favors for parsley.",
    line: "A garden is a promise you have to renew every morning.",
    extraLines: [
      "Water first, weed second, complain third. Reverse it and you lose the row.",
      "Berries pay a little more because the birds also want them.",
    ],
    likeabilityTags: ["gardener", "fountain", "economy-starter"],
    proceduralAppearanceSpec: {
      voxelSeed: "fern-the-grower-2026",
      palette: "earth",
      silhouette: "gardener",
    },
  },
  {
    id: "kit_the_courier",
    displayName: "Kit the Courier",
    idOffset: 9322,
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Fountain dispatcher and small-parcel runner",
    authoredPosition: snapshotGroveFountainPositionV105(8, 8),
    orientation: [0, 4.0],
    shortDescription:
      "A fast-talking courier dispatcher who pays runners by the leg, not the mile.",
    background:
      "Kit started as a child runner between Lovely Locks and the fountain and now manages the Grove's daily delivery board.",
    motivation:
      "Run a courier guild that pays reliably and never asks runners to take suicidal shortcuts.",
    line: "Two questions before you accept: how heavy and how mean is the road today.",
    extraLines: [
      "Bring me a signed slip and the bling is yours before the ink dries.",
      "Slow and intact still beats fast and explained.",
    ],
    likeabilityTags: ["courier", "fountain", "economy-starter"],
    proceduralAppearanceSpec: {
      voxelSeed: "kit-the-courier-2026",
      palette: "cool",
      silhouette: "courier",
    },
  },
  {
    id: "mel_the_handyman",
    displayName: "Mel the Handyman",
    idOffset: 9323,
    seedServerNpc: true,
    homeArea: "genesis_crossroads",
    role: "Fix-anything maintenance hand and tool-loaner",
    authoredPosition: [488, FEET_Y, -218],
    orientation: [0, 3.4],
    shortDescription:
      "A practical fixer who repairs benches, hinges, and small machines for a flat bling fee.",
    background:
      "Mel works the Crossroads with a battered toolkit and a notebook of jobs people pretend they will get to next week.",
    motivation:
      "Open a small handyman shop near Luis once she has stocked enough parts and trust.",
    line: "I do not fix arguments. I fix the thing the argument is about.",
    extraLines: [
      "Hinges break in the same five ways. People still act surprised.",
      "Bring me what is broken. Bling buys you the next twenty minutes of my attention.",
    ],
    likeabilityTags: ["handyman", "crossroads", "economy-starter"],
    proceduralAppearanceSpec: {
      voxelSeed: "mel-the-handyman-2026",
      palette: "rust",
      silhouette: "handyman",
    },
  },
  {
    id: "rin_the_forager",
    displayName: "Rin the Forager",
    idOffset: 9324,
    seedServerNpc: true,
    homeArea: "muck_edges",
    role: "Muck-edge forager and safe-harvest scout",
    authoredPosition: [510, FEET_Y, -155],
    orientation: [0, 2.6],
    shortDescription:
      "A cautious forager who pays runners to harvest what the muck did not get to first.",
    background:
      "Rin learned the safe lines through the muck edges by walking them barefoot and now teaches new gatherers the route.",
    motivation:
      "Map every safe harvest spot before the muck moves the lines again, and pay her runners on time.",
    line: "If your boots smell strange, you stepped where I told you not to.",
    extraLines: [
      "Take from the marked clump first. The unmarked one will trade you something you do not want.",
      "Mushrooms pay double during fog days.",
    ],
    likeabilityTags: ["forager", "muck-edge", "economy-starter"],
    proceduralAppearanceSpec: {
      voxelSeed: "rin-the-forager-2026",
      palette: "ash",
      silhouette: "forager",
    },
  },
  {
    id: "carlo_the_cook",
    displayName: "Carlo the Cook",
    idOffset: 9325,
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Fountain cook and festival caterer",
    authoredPosition: snapshotGroveFountainPositionV105(2, -7),
    orientation: [0, 0.3],
    shortDescription:
      "A traveling cook who pays well for one good festival skewer and disappears at sundown.",
    background:
      "Carlo took over a small fountain hearth and pays a premium when a runner can deliver a real skewer to a festival crowd without losing it.",
    motivation:
      "Build a small catering route between The Grove and Harthmere market before either town hires its own.",
    line: "I do not need a chef. I need a runner with hot hands.",
    extraLines: [
      "Skewer first, story second. Tip in the order it earns.",
      "Burn it once, learn it twice. Burn it twice, I cook somewhere else.",
    ],
    likeabilityTags: ["cook", "fountain", "economy-starter", "festival"],
    proceduralAppearanceSpec: {
      voxelSeed: "carlo-the-cook-2026",
      palette: "violet",
      silhouette: "cook",
    },
  },
];

// ---------------------------------------------------------------------------
// New landmarks the quests reference. Each maps to an interactable workspot
// near its NPC. Marker IDs are namespaced "econ_" to avoid collisions.
// ---------------------------------------------------------------------------

export const GROVE_ECONOMY_STARTER_LANDMARKS_V1: SnapshotGroveLandmarkV75[] = [
  {
    id: "econ_gus_oven",
    label: "Gus's Oven",
    position: [
      snapshotGroveFountainPositionV105(-10, 1)[0],
      snapshotGroveFountainPositionV105(-10, 1)[1] + 1,
      snapshotGroveFountainPositionV105(-10, 1)[2],
    ],
    kind: "interactable",
    area: "the_grove",
    visibleOnWorldMap: true,
  },
  {
    id: "econ_fern_garden_plot",
    label: "Fern's Sprout Beds",
    position: [
      snapshotGroveFountainPositionV105(1, 9)[0],
      snapshotGroveFountainPositionV105(1, 9)[1] + 1,
      snapshotGroveFountainPositionV105(1, 9)[2],
    ],
    kind: "interactable",
    area: "the_grove",
    visibleOnWorldMap: true,
  },
  {
    id: "econ_fern_berry_patch",
    label: "Berry Patch",
    position: [
      snapshotGroveFountainPositionV105(3, 10)[0],
      snapshotGroveFountainPositionV105(3, 10)[1] + 1,
      snapshotGroveFountainPositionV105(3, 10)[2],
    ],
    kind: "resource",
    area: "the_grove",
    visibleOnWorldMap: true,
  },
  {
    id: "econ_kit_mailbag",
    label: "Kit's Mailbag Stand",
    position: [
      snapshotGroveFountainPositionV105(9, 9)[0],
      snapshotGroveFountainPositionV105(9, 9)[1] + 1,
      snapshotGroveFountainPositionV105(9, 9)[2],
    ],
    kind: "interactable",
    area: "the_grove",
    visibleOnWorldMap: true,
  },
  {
    id: "econ_mel_workbench",
    label: "Mel's Workbench",
    position: [490, FEET_Y + 1, -218],
    kind: "interactable",
    area: "genesis_crossroads",
    visibleOnWorldMap: true,
  },
  {
    id: "econ_rin_basket",
    label: "Rin's Forage Basket",
    position: [511, FEET_Y + 1, -156],
    kind: "resource",
    area: "muck_edges",
    visibleOnWorldMap: true,
  },
  {
    id: "econ_carlo_cookpot",
    label: "Carlo's Cookpot",
    position: [
      snapshotGroveFountainPositionV105(2, -8)[0],
      snapshotGroveFountainPositionV105(2, -8)[1] + 1,
      snapshotGroveFountainPositionV105(2, -8)[2],
    ],
    kind: "interactable",
    area: "the_grove",
    visibleOnWorldMap: true,
  },
  {
    id: "econ_grove_billy_post",
    label: "Billy's Drop Post",
    position: [498, FEET_Y + 1, -141],
    kind: "interactable",
    area: "old_grove_road",
    visibleOnWorldMap: true,
  },
];

// ---------------------------------------------------------------------------
// 15 starter-cash quests, all using "road_story" category so they group with
// the existing daily quests (not with fountain tutorial lessons).
// ---------------------------------------------------------------------------

export const GROVE_ECONOMY_STARTER_QUESTS_V1: SnapshotGroveQuestV75[] = [
  // ---- Billy (3 quests) ---------------------------------------------------
  {
    id: "econ_billys_lost_lunch_pail",
    title: "Billy's Lost Lunch Pail",
    giverNpcId: "billy",
    area: "Old Grove Road",
    hook:
      "Billy dropped his lunch pail somewhere along his shortcut and now the muck flies are interested.",
    objectives: [
      "Hear Billy out about the missing pail.",
      "Search the Old Grove Road post for the dropped pail.",
      "Pick up the pail before the flies do.",
      "Return the pail to Billy.",
    ],
    triggers: ["talk_npc", "near_location", "collect", "talk_npc"],
    markerIds: [
      "npc_billy",
      "old_grove_road_post",
      "econ_grove_billy_post",
      "npc_billy",
    ],
    reward: "8 bling, light-snack note, Billy friendship +1.",
    sampleDialogue:
      "I know I had it at the post. I also know the flies should not have a vote.",
    category: "road_story",
  },
  {
    id: "econ_billys_roof_patch_run",
    title: "Billy's Roof Patch Run",
    giverNpcId: "billy",
    area: "Old Grove Road",
    hook:
      "Billy needs wood scraps carried from the road kit crate to a leaking shed before the rain returns.",
    objectives: [
      "Take the patch order from Billy.",
      "Collect scrap wood from the marked materials basket.",
      "Drop the scraps at Billy's road post.",
      "Tell Billy the patch is ready.",
    ],
    triggers: ["talk_npc", "collect", "place_voxel", "talk_npc"],
    markerIds: [
      "npc_billy",
      "grove_resource_basket",
      "econ_grove_billy_post",
      "npc_billy",
    ],
    reward: "12 bling, rough patch flag, Billy friendship +1.",
    sampleDialogue:
      "Two scraps and a careful hand keeps the shed dry through tomorrow.",
    category: "road_story",
  },
  {
    id: "econ_billys_map_pin_run",
    title: "Billy's Map Pin Run to Luis",
    giverNpcId: "billy",
    area: "Old Grove Road -> Genesis Crossroads",
    hook:
      "Billy wants Luis to know the bent sign is back. He needs a runner who will not get distracted by the cove.",
    objectives: [
      "Pick up the map pin from Billy.",
      "Run the Old Grove Road to Luis's repair cart.",
      "Hand the pin to Luis.",
      "Report back to Billy with Luis's note.",
    ],
    triggers: ["talk_npc", "near_location", "talk_npc", "talk_npc"],
    markerIds: ["npc_billy", "luis_cart", "npc_luis", "npc_billy"],
    reward: "10 bling, road-runner badge, Billy friendship +1.",
    sampleDialogue:
      "Straight line. No cove. No selfies. The pin is heavier than it looks.",
    category: "road_story",
  },
  // ---- Grove Banker Merl (2 quests) ---------------------------------------
  {
    id: "econ_merls_coin_sorting",
    title: "Merl's Coin Sorting Apprenticeship",
    giverNpcId: "grove_banker_merl",
    area: "The Grove Fountain",
    hook:
      "Merl needs a careful hand to sort a day's deposits into the bank satchel without dropping a single coin.",
    objectives: [
      "Take the deposit slip from Merl.",
      "Open the deposit at the Mail and Bank Satchel.",
      "Sort the coins by interacting with the satchel station.",
      "Return the sealed slip to Merl.",
    ],
    triggers: ["talk_npc", "open_tab", "interact", "talk_npc"],
    markerIds: [
      "npc_grove_banker_merl",
      "grove_mail_bank_satchel",
      "grove_mail_bank_satchel",
      "npc_grove_banker_merl",
    ],
    reward: "15 bling, bank apprentice slip, Merl friendship +1.",
    sampleDialogue:
      "A bank trusts you when your hands stop apologising to the coins.",
    category: "road_story",
  },
  {
    id: "econ_merls_vault_inventory",
    title: "Merl's Vault Inventory Day",
    giverNpcId: "grove_banker_merl",
    area: "The Grove Fountain",
    hook:
      "Merl needs the lost-and-found stone inventoried before he opens the vault for the morning's depositors.",
    objectives: [
      "Hear Merl's inventory plan.",
      "Inspect the Lost-and-Found Stone.",
      "Verify the bank crate matches the ledger.",
      "Return the count to Merl.",
    ],
    triggers: ["talk_npc", "interact", "interact", "talk_npc"],
    markerIds: [
      "npc_grove_banker_merl",
      "grove_recovery_stone",
      "guild_bank_crate",
      "npc_grove_banker_merl",
    ],
    reward: "20 bling, vault-day slip, Merl friendship +1.",
    sampleDialogue:
      "The ledger is the bank. Everything else is just the building it sits in.",
    category: "road_story",
  },
  // ---- Gus the Baker (2 quests) -------------------------------------------
  {
    id: "econ_gus_fresh_loaves_to_fountain",
    title: "Fresh Loaves to the Fountain",
    giverNpcId: "gus_the_baker",
    area: "The Grove Fountain",
    hook:
      "Gus needs a warm-handed runner to deliver loaves to the fountain before the morning crowd arrives.",
    objectives: [
      "Pick up the loaf tray from Gus.",
      "Carry the tray to the Fountain Food Satchel.",
      "Place the loaves in the satchel before they cool.",
      "Confirm the delivery with Gus.",
    ],
    triggers: ["talk_npc", "carry", "place_voxel", "talk_npc"],
    markerIds: [
      "npc_gus_the_baker",
      "grove_food_satchel",
      "grove_food_satchel",
      "npc_gus_the_baker",
    ],
    reward: "10 bling, warm-loaf badge, Gus friendship +1.",
    sampleDialogue:
      "Warm pays full. Lukewarm pays half. Cold and we have to talk about your pace.",
    category: "road_story",
  },
  {
    id: "econ_gus_grain_run",
    title: "Gus's Grain Run from the Field",
    giverNpcId: "gus_the_baker",
    area: "The Grove Fountain",
    hook:
      "Gus is out of grain and Fern's field has a basket waiting. He'll pay anyone who can run a sack back before noon.",
    objectives: [
      "Take Gus's empty grain sack.",
      "Collect grain from the marked practice materials.",
      "Drop the full sack at Gus's oven.",
      "Tell Gus the oven is fed.",
    ],
    triggers: ["talk_npc", "collect", "place_voxel", "talk_npc"],
    markerIds: [
      "npc_gus_the_baker",
      "grove_resource_basket",
      "econ_gus_oven",
      "npc_gus_the_baker",
    ],
    reward: "18 bling, grain-runner slip, Gus friendship +1.",
    sampleDialogue:
      "Grain in. Bread out. The town runs on this and nobody notices.",
    category: "road_story",
  },
  // ---- Fern the Grower (2 quests) -----------------------------------------
  {
    id: "econ_fern_water_the_sprout_beds",
    title: "Water the Sprout Beds",
    giverNpcId: "fern_the_grower",
    area: "The Grove Fountain",
    hook:
      "Fern's sprout beds are dry and she needs hands at the basket to carry water before the sun finishes the job.",
    objectives: [
      "Get the watering plan from Fern.",
      "Reach Fern's sprout beds.",
      "Interact with the beds to water the row.",
      "Report back to Fern.",
    ],
    triggers: ["talk_npc", "near_location", "interact", "talk_npc"],
    markerIds: [
      "npc_fern_the_grower",
      "econ_fern_garden_plot",
      "econ_fern_garden_plot",
      "npc_fern_the_grower",
    ],
    reward: "12 bling, gardener's mark, Fern friendship +1.",
    sampleDialogue:
      "A watered row pays in stems. A dry row pays in lectures.",
    category: "road_story",
  },
  {
    id: "econ_fern_berry_patch_harvest",
    title: "Fern's Berry Patch Harvest",
    giverNpcId: "fern_the_grower",
    area: "The Grove Fountain",
    hook:
      "The berry patch ripened overnight and Fern needs them in a basket before the birds find them.",
    objectives: [
      "Take the basket from Fern.",
      "Pick berries at the patch.",
      "Bring the basket back to Fern's beds.",
      "Hand off the berries.",
    ],
    triggers: ["talk_npc", "collect", "near_location", "talk_npc"],
    markerIds: [
      "npc_fern_the_grower",
      "econ_fern_berry_patch",
      "econ_fern_garden_plot",
      "npc_fern_the_grower",
    ],
    reward: "20 bling, berry-basket slip, Fern friendship +1.",
    sampleDialogue:
      "Pick the dark ones. The birds get the rest. That's the deal.",
    category: "road_story",
  },
  // ---- Kit the Courier (2 quests) -----------------------------------------
  {
    id: "econ_kit_letters_around_fountain",
    title: "Kit's Letters Around the Fountain",
    giverNpcId: "kit_the_courier",
    area: "The Grove Fountain",
    hook:
      "Kit has three letters that need to go to three fountain workstations and a runner who can keep them in order.",
    objectives: [
      "Take Kit's letter packet.",
      "Drop the first at the Fountain Lesson Board.",
      "Drop the second at the Charter Trade Desk.",
      "Drop the third at the Mail and Bank Satchel.",
      "Return to Kit for the wage.",
    ],
    triggers: [
      "talk_npc",
      "interact",
      "interact",
      "interact",
      "talk_npc",
    ],
    markerIds: [
      "npc_kit_the_courier",
      "grove_fountain_lesson_board",
      "grove_trade_desk",
      "grove_mail_bank_satchel",
      "npc_kit_the_courier",
    ],
    reward: "10 bling, fountain-round badge, Kit friendship +1.",
    sampleDialogue:
      "Three stops. One pace. If the order gets mixed, the wage gets mixed too.",
    category: "road_story",
  },
  {
    id: "econ_kit_heavy_parcel_to_crossroads",
    title: "Kit's Heavy Parcel to the Crossroads",
    giverNpcId: "kit_the_courier",
    area: "The Grove Fountain -> Genesis Crossroads",
    hook:
      "Kit has a heavy parcel for Luis that nobody wants to carry. Whoever does it gets the best wage on the board.",
    objectives: [
      "Hear Kit's parcel terms.",
      "Pick up the parcel at Kit's mailbag stand.",
      "Carry the parcel down the Old Grove Road.",
      "Hand the parcel to Luis at his cart.",
      "Return the receipt to Kit.",
    ],
    triggers: ["talk_npc", "item_grant", "carry", "talk_npc", "talk_npc"],
    markerIds: [
      "npc_kit_the_courier",
      "econ_kit_mailbag",
      "luis_cart",
      "npc_luis",
      "npc_kit_the_courier",
    ],
    reward: "25 bling, heavy-parcel slip, Kit friendship +1.",
    sampleDialogue:
      "Heavy is honest. Whoever finishes this gets first pick on tomorrow's board.",
    category: "road_story",
  },
  // ---- Mel the Handyman (2 quests) ----------------------------------------
  {
    id: "econ_mel_bench_repair",
    title: "Mel's Bench Repair",
    giverNpcId: "mel_the_handyman",
    area: "Genesis Crossroads",
    hook:
      "Mel has a bench with a wobbly leg and a customer who will not sit on it again. She'll pay for steady hands.",
    objectives: [
      "Take the repair order from Mel.",
      "Pick up the part at Mel's workbench.",
      "Set the part on the broken safe-zone fence.",
      "Report the fix to Mel.",
    ],
    triggers: ["talk_npc", "interact", "place_voxel", "talk_npc"],
    markerIds: [
      "npc_mel_the_handyman",
      "econ_mel_workbench",
      "grove_repair_fence",
      "npc_mel_the_handyman",
    ],
    reward: "15 bling, handyman tag, Mel friendship +1.",
    sampleDialogue: "One leg. Two bolts. Three minutes. I'll watch.",
    category: "road_story",
  },
  {
    id: "econ_mel_broken_hinge_hunt",
    title: "Mel's Broken Hinge Hunt",
    giverNpcId: "mel_the_handyman",
    area: "Genesis Crossroads / Old Grove Road",
    hook:
      "Three hinges in town are squealing. Mel will pay double if a runner can inspect all three before sunset.",
    objectives: [
      "Get the hinge list from Mel.",
      "Inspect the Old Grove Road post.",
      "Inspect the safe-zone fence.",
      "Inspect Mel's workbench supplies.",
      "Report the count to Mel.",
    ],
    triggers: ["talk_npc", "interact", "interact", "interact", "talk_npc"],
    markerIds: [
      "npc_mel_the_handyman",
      "old_grove_road_post",
      "grove_repair_fence",
      "econ_mel_workbench",
      "npc_mel_the_handyman",
    ],
    reward: "30 bling, hinge-hunter slip, Mel friendship +1.",
    sampleDialogue:
      "Hinges fail in the same way every time. Find the third one before it makes the door an opinion.",
    category: "road_story",
  },
  // ---- Rin the Forager (1 quest) -----------------------------------------
  {
    id: "econ_rin_mushroom_pickup",
    title: "Rin's Wild Mushroom Pickup",
    giverNpcId: "rin_the_forager",
    area: "Muck Edges",
    hook:
      "Rin marked a safe ring of mushrooms by the muck and needs a runner to harvest before the fog moves them.",
    objectives: [
      "Meet Rin at the muck edge.",
      "Collect mushrooms from her marked basket.",
      "Avoid standing in heavy muck while gathering.",
      "Drop the basket back at Rin.",
    ],
    triggers: ["talk_npc", "collect", "status_check", "talk_npc"],
    markerIds: [
      "npc_rin_the_forager",
      "econ_rin_basket",
      "muckwad_patch",
      "npc_rin_the_forager",
    ],
    reward: "18 bling, safe-harvest note, Rin friendship +1.",
    sampleDialogue:
      "The marked basket. Not the unmarked clump. I will only say it once.",
    category: "road_story",
  },
  // ---- Carlo the Cook (1 quest) ------------------------------------------
  {
    id: "econ_carlo_festival_skewers",
    title: "Carlo's Festival Skewers",
    giverNpcId: "carlo_the_cook",
    area: "The Grove Fountain",
    hook:
      "Carlo has a festival cook order and needs a runner-cook to grill skewers at the fountain workbench. Pays the best wage on the starter board.",
    objectives: [
      "Take Carlo's skewer recipe.",
      "Gather the ingredients at the marked materials basket.",
      "Cook the skewers at the Fountain Workbench.",
      "Deliver the tray to Carlo's cookpot.",
      "Settle the wage with Carlo.",
    ],
    triggers: ["talk_npc", "collect", "craft", "place_voxel", "talk_npc"],
    markerIds: [
      "npc_carlo_the_cook",
      "grove_resource_basket",
      "grove_fountain_workbench",
      "econ_carlo_cookpot",
      "npc_carlo_the_cook",
    ],
    reward: "50 bling, festival-skewer recipe, Carlo friendship +1.",
    sampleDialogue:
      "Five sticks. Three minutes each. Burn one and we both lose a story I needed.",
    category: "road_story",
  },
];

// Helper for tests: total bling on offer.
export function totalEconomyStarterBlingV1(): number {
  return GROVE_ECONOMY_STARTER_QUESTS_V1.reduce((total, quest) => {
    const match = /(\d+)\s*bling/.exec(quest.reward);
    return total + (match ? Number.parseInt(match[1], 10) : 0);
  }, 0);
}
