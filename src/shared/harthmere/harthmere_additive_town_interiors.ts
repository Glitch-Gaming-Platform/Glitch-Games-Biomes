import { HARTHMERE_BUSINESS_FURNITURE_ASSETS } from "@/shared/harthmere/generated/harthmere_business_furniture_manifest";
import {
  HARTHMERE_BUILDINGS,
  type HarthmereBuilding,
  type HarthmereDoorSide,
} from "@/shared/harthmere/harthmere_town_buildings";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
  shouldEnableHarthmereAdditiveWorldExtension,
} from "@/shared/harthmere/world_extension";

// HARTHMERE_ADDITIVE_TOWN_INTERIORS
//
// One authoritative interior layout for the 57 fixed Harthmere shells. The
// shell table is immutable here: positions are derived from each shell's real
// bounds and never from the retired renderer coordinates that put furniture in
// streets or neighbouring buildings.
//
// Reusable furniture uses the already-generated Blender/Bikkie catalogue. That
// gives these fixtures native numeric item identities, inventory icons,
// placement bounds and LOD assets without manufacturing a second chair, bed or
// shelf family. Every bespoke accent is also authored by that compact
// Harthmere catalogue. Cooking stations are materialized as native
// Kitchen/Campfire placeables by the server so F uses the normal ECS placeable
// overlay; enclosed ovens and cookpots use their matching authored mesh while
// plain campfires retain the original native visual.

export const HARTHMERE_ADDITIVE_TOWN_INTERIORS_VERSION =
  "harthmere-additive-town-interiors-v1" as const;
export const HARTHMERE_ADDITIVE_TOWN_INTERIOR_GROUND_Y = 53;

function configuredInteriorOffset(
  env: Record<string, string | undefined>,
  publicKey: string,
  serverKey: string,
  fallback: number
) {
  const parsed = Number.parseInt(
    env[publicKey] ?? env[serverKey] ?? String(fallback),
    10
  );
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Converts shell-authored coordinates to the connected additive-world band. */
export function harthmereAdditiveTownInteriorWorldPosition(
  position: readonly [number, number, number],
  env: Record<string, string | undefined> = typeof process === "undefined"
    ? {}
    : process.env
): readonly [number, number, number] {
  if (!shouldEnableHarthmereAdditiveWorldExtension(env)) return position;
  return [
    position[0] +
      configuredInteriorOffset(
        env,
        "NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X",
        "BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X",
        HARTHMERE_ADDITIVE_TOWN_OFFSET_X
      ),
    position[1],
    position[2] +
      configuredInteriorOffset(
        env,
        "NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z",
        "BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z",
        HARTHMERE_ADDITIVE_TOWN_OFFSET_Z
      ),
  ];
}

export type HarthmereTownFurnitureItemId =
  keyof typeof HARTHMERE_BUSINESS_FURNITURE_ASSETS;
export type HarthmereTownInteriorWall = HarthmereDoorSide;
export type HarthmereTownCookingStationKind = "campfire" | "cookpot" | "oven";

export interface HarthmereTownInteriorFurnitureBlueprint {
  readonly kind: "furniture";
  readonly key: string;
  readonly itemId: HarthmereTownFurnitureItemId;
  readonly label: string;
  readonly floor?: number;
  readonly preferredWall?: HarthmereTownInteriorWall;
}

export interface HarthmereTownInteriorDecorBlueprint {
  readonly kind: "decor";
  readonly key: string;
  readonly asset: string;
  readonly label: string;
  readonly footprint: readonly [number, number, number];
  readonly floor?: number;
  readonly preferredWall?: HarthmereTownInteriorWall;
  readonly scale?: number;
  readonly collidable?: boolean;
}

export interface HarthmereTownInteriorCookingBlueprint {
  readonly kind: "cooking";
  readonly key: string;
  readonly stationKind: HarthmereTownCookingStationKind;
  readonly label: string;
  readonly floor?: number;
  readonly preferredWall?: HarthmereTownInteriorWall;
}

export type HarthmereTownInteriorFixtureBlueprint =
  | HarthmereTownInteriorFurnitureBlueprint
  | HarthmereTownInteriorDecorBlueprint
  | HarthmereTownInteriorCookingBlueprint;

export interface HarthmereTownInteriorNpcAssignment {
  readonly offset: number;
  readonly role: string;
  readonly floor?: number;
}

export interface HarthmereTownInteriorPlan {
  readonly buildingName: string;
  readonly identity: string;
  readonly focalCue: string;
  readonly fixtures: readonly HarthmereTownInteriorFixtureBlueprint[];
  readonly npcs?: readonly HarthmereTownInteriorNpcAssignment[];
}

export interface HarthmereTownInteriorFixture {
  readonly fixtureId: string;
  readonly buildingName: string;
  readonly district: string;
  readonly identity: string;
  readonly focalCue: string;
  readonly kind: HarthmereTownInteriorFixtureBlueprint["kind"];
  readonly label: string;
  readonly asset?: string;
  readonly furnitureItemId?: HarthmereTownFurnitureItemId;
  readonly stationKind?: HarthmereTownCookingStationKind;
  readonly floor: number;
  readonly position: readonly [number, number, number];
  readonly yaw: number;
  /** Native local XYZ bounds before yaw; used by oriented ECS collision. */
  readonly size: readonly [number, number, number];
  /** World-XZ projected bounds used only for layout/clearance validation. */
  readonly clearanceSize: readonly [number, number, number];
  readonly scale: number;
  readonly collidable: boolean;
}

export interface HarthmereTownInteriorNpcAnchor {
  readonly offset: number;
  readonly role: string;
  readonly buildingName: string;
  readonly floor: number;
  readonly position: readonly [number, number, number];
}

const f = (
  key: string,
  itemId: HarthmereTownFurnitureItemId,
  label: string,
  preferredWall?: HarthmereTownInteriorWall,
  floor = 0
): HarthmereTownInteriorFurnitureBlueprint => ({
  kind: "furniture",
  key,
  itemId,
  label,
  preferredWall,
  floor,
});

const d = (
  key: string,
  asset: string,
  label: string,
  footprint: readonly [number, number, number],
  preferredWall?: HarthmereTownInteriorWall,
  floor = 0,
  scale = 0.8,
  collidable = true
): HarthmereTownInteriorDecorBlueprint => {
  const generated = (
    HARTHMERE_BUSINESS_FURNITURE_ASSETS as Readonly<
      Record<
        string,
        {
          collidableSize: readonly [number, number, number];
        }
      >
    >
  )[asset];
  return {
    kind: "decor",
    key,
    asset,
    label,
    footprint: generated?.collidableSize ?? footprint,
    preferredWall,
    floor,
    scale: generated ? 1 : scale,
    collidable,
  };
};

const c = (
  key: string,
  stationKind: HarthmereTownCookingStationKind,
  label: string,
  preferredWall?: HarthmereTownInteriorWall,
  floor = 0
): HarthmereTownInteriorCookingBlueprint => ({
  kind: "cooking",
  key,
  stationKind,
  label,
  preferredWall,
  floor,
});

const npc = (
  offset: number,
  role: string,
  floor = 0
): HarthmereTownInteriorNpcAssignment => ({ offset, role, floor });

const commonOffice = (prefix: string) =>
  [
    f(
      `${prefix}_counter`,
      "business_service_counter",
      `${prefix} service counter`,
      "north"
    ),
    f(`${prefix}_desk`, "table", `${prefix} working desk`, "west"),
    f(`${prefix}_records`, "shelf", `${prefix} records shelf`, "east"),
    f(`${prefix}_secure`, "lockbox", `${prefix} secured lockbox`, "south"),
    f(`${prefix}_waiting`, "bench", `${prefix} waiting bench`, "west"),
    f(`${prefix}_chair`, "wooden_chair", `${prefix} clerk chair`, "east"),
  ] as const;

const commonHomeGround = (
  prefix: string,
  station: HarthmereTownCookingStationKind = "cookpot"
) =>
  [
    c(`${prefix}_cooking`, station, `${prefix} cooking hearth`, "north"),
    f(`${prefix}_table`, "table", `${prefix} family table`, "west"),
    f(`${prefix}_bench`, "bench", `${prefix} hearth bench`, "east"),
    f(`${prefix}_shelf`, "shelf", `${prefix} household shelf`, "south"),
    f(
      `${prefix}_storage`,
      "wood_container",
      `${prefix} household storage`,
      "north"
    ),
  ] as const;

const commonHomeUpper = (prefix: string, floor = 1, fancy = false) =>
  [
    f(
      `${prefix}_bed`,
      fancy ? "fancy_bed" : "small_bed",
      `${prefix} bed`,
      "north",
      floor
    ),
    f(
      `${prefix}_wardrobe`,
      "wardrobe_storage",
      `${prefix} wardrobe`,
      "east",
      floor
    ),
    f(
      `${prefix}_chest`,
      "treasure_chest",
      `${prefix} personal chest`,
      "south",
      floor
    ),
    f(`${prefix}_desk`, "table", `${prefix} writing table`, "west", floor),
    f(
      `${prefix}_chair`,
      fancy ? "padded_chair" : "wooden_chair",
      `${prefix} room chair`,
      "east",
      floor
    ),
  ] as const;

const bunkFloor = (prefix: string, floor = 1) =>
  [
    f(`${prefix}_bunk_a`, "small_bed", `${prefix} bunk A`, "north", floor),
    f(`${prefix}_bunk_b`, "small_bed", `${prefix} bunk B`, "south", floor),
    f(
      `${prefix}_locker_a`,
      "wood_container",
      `${prefix} footlocker A`,
      "west",
      floor
    ),
    f(
      `${prefix}_locker_b`,
      "wood_container",
      `${prefix} footlocker B`,
      "east",
      floor
    ),
    f(`${prefix}_blankets`, "shelf", `${prefix} blanket shelf`, "north", floor),
  ] as const;

const apartmentPlan = (
  buildingName: string,
  identity: string,
  focalCue: string,
  accentAsset: string,
  accentLabel: string
): HarthmereTownInteriorPlan => ({
  buildingName,
  identity,
  focalCue,
  fixtures: [
    ...commonHomeGround(buildingName),
    d(
      `${buildingName}_accent`,
      accentAsset,
      accentLabel,
      [0.8, 1.2, 0.6],
      "east",
      0,
      0.68,
      false
    ),
    ...commonHomeUpper(buildingName),
  ],
});

const stackPlan = (
  buildingName: string,
  identity: string,
  focalCue: string,
  floors: number,
  accentAsset: string,
  accentLabel: string
): HarthmereTownInteriorPlan => ({
  buildingName,
  identity,
  focalCue,
  fixtures: [
    c(
      `${buildingName}_communal_hearth`,
      "cookpot",
      `${buildingName} communal cooking hearth`,
      "north"
    ),
    f(
      `${buildingName}_communal_table`,
      "table",
      `${buildingName} communal table`,
      "west"
    ),
    f(
      `${buildingName}_landing_storage`,
      "wood_container",
      `${buildingName} shared landing storage`,
      "east"
    ),
    d(
      `${buildingName}_accent`,
      accentAsset,
      accentLabel,
      [0.8, 1.1, 0.7],
      "south",
      0,
      0.7,
      false
    ),
    ...Array.from({ length: floors - 1 }, (_, index) => index + 1).flatMap(
      (floor) => [
        f(
          `${buildingName}_bed_${floor}`,
          "small_bed",
          `${buildingName} floor ${floor + 1} sleeping pallet`,
          "north",
          floor
        ),
        f(
          `${buildingName}_chest_${floor}`,
          "wood_container",
          `${buildingName} floor ${floor + 1} household bundle`,
          "east",
          floor
        ),
        f(
          `${buildingName}_shelf_${floor}`,
          "shelf",
          `${buildingName} floor ${floor + 1} raised storage shelf`,
          "south",
          floor
        ),
      ]
    ),
  ],
});

// The identity/focal strings are the concise implementation form of the full
// lore audit. Every building is explicit even where a shared residential kit is
// appropriate; the distinguishing accent prevents the apartment row and Mudden
// stacks from becoming cloned rooms.
export const HARTHMERE_ADDITIVE_TOWN_INTERIOR_PLANS: readonly HarthmereTownInteriorPlan[] =
  [
    {
      buildingName: "north_gate_west_gatehouse",
      identity: "incoming traveler inspection and confiscation post",
      focalCue: "red-black watch banner over a scarred inspection table",
      fixtures: [
        f(
          "west_gate_inspection",
          "t_table",
          "West Gate traveler inspection table",
          "north"
        ),
        f(
          "west_gate_bench",
          "bench",
          "West Gate traveler waiting bench",
          "west"
        ),
        f(
          "west_gate_evidence",
          "cargo_crate",
          "West Gate confiscated goods cage substitute",
          "east"
        ),
        f("west_gate_ledger", "table", "West Gate clerk ledger desk", "south"),
        d(
          "west_gate_arms",
          "town_tool_rack",
          "West Gate shield and pike rack",
          [1.42, 1.8, 0.5],
          "east"
        ),
        ...bunkFloor("west_gate_ready", 1),
      ],
      npcs: [npc(27, "gate sergeant inspection point")],
    },
    {
      buildingName: "north_gate_east_gatehouse",
      identity: "outbound patrol command and gate mechanism room",
      focalCue: "patrol map and gate-key board",
      fixtures: [
        ...commonOffice("east_gate_command"),
        d(
          "east_gate_arms",
          "town_tool_rack",
          "East Gate weapons inspection rack",
          [1.42, 1.8, 0.5],
          "east"
        ),
        ...bunkFloor("east_gate_signal", 1),
      ],
    },
    {
      buildingName: "north_gate_toll_booth",
      identity: "permits, caravan manifests and civic toll procedure",
      focalCue: "brass-edged ledger beside the town seal and coin scale",
      fixtures: [
        f(
          "toll_counter",
          "business_service_counter",
          "Toll Booth U-shaped toll counter",
          "north"
        ),
        f(
          "toll_scale",
          "table",
          "Toll Booth coin scale and permit table",
          "west"
        ),
        f(
          "toll_manifest",
          "display_shelf",
          "Toll Booth manifest pigeonholes",
          "east"
        ),
        f("toll_lockbox", "lockbox", "Toll Booth coin lockbox", "south"),
        f("toll_queue", "bench", "Toll Booth queue bench", "west"),
        f(
          "toll_confiscation",
          "cargo_crate",
          "Toll Booth confiscation shelf stock",
          "east"
        ),
      ],
      npcs: [npc(39, "toll clerk behind the public counter")],
    },
    {
      buildingName: "harthmere_stables",
      identity: "travel mounts, tack, feed, veterinary care and cart rental",
      focalCue: "tack-and-key wall beside a chapel-facing stall",
      fixtures: [
        f("stable_tack", "display_shelf", "Stables tack and key wall", "north"),
        f(
          "stable_grooming",
          "table",
          "Stables grooming and veterinary bench",
          "west"
        ),
        f("stable_feed_a", "wood_container", "Stables feed bin A", "south"),
        f("stable_feed_b", "wood_container", "Stables feed bin B", "south"),
        d(
          "stable_tools",
          "town_tool_rack",
          "Stables saddle and cart-repair rack",
          [1.42, 1.8, 0.5],
          "east"
        ),
        f("stable_ledger", "table", "Stables rental ledger desk", "east"),
        ...commonHomeUpper("jory_stable_loft", 1),
      ],
      npcs: [
        npc(37, "Old Jory at the rental ledger"),
        npc(64, "stablehand at the tack wall"),
      ],
    },
    {
      buildingName: "guard_yard_office",
      identity: "watch reports, interviews, evidence and patrol administration",
      focalCue: "wall-sized duty and incident board with colored patrol pins",
      fixtures: [
        ...commonOffice("guard_office"),
        d(
          "guard_office_arms",
          "town_tool_rack",
          "Guard Office lockable weapon cupboard",
          [1.42, 1.8, 0.5],
          "east"
        ),
        f(
          "guard_office_evidence",
          "cargo_crate",
          "Guard Office evidence cabinet",
          "south"
        ),
      ],
      npcs: [
        npc(44, "drill instructor report point"),
        npc(45, "bounty clerk desk"),
        npc(56, "quartermaster cupboard"),
      ],
    },
    {
      buildingName: "guard_barracks_bunkhouse",
      identity: "disciplined guard mess, ready room and communal quarters",
      focalCue: "red-black gear rows around a shared mess table",
      fixtures: [
        c(
          "barracks_mess_hearth",
          "cookpot",
          "Guard Barracks mess cookpot",
          "north"
        ),
        f(
          "barracks_mess",
          "t_table",
          "Guard Barracks shared mess table",
          "west"
        ),
        f("barracks_bench", "bench", "Guard Barracks mess bench", "east"),
        d(
          "barracks_weapons",
          "town_tool_rack",
          "Guard Barracks weapons rack",
          [1.42, 1.8, 0.5],
          "east"
        ),
        f(
          "barracks_rations",
          "shelf",
          "Guard Barracks ration cabinet",
          "south"
        ),
        ...bunkFloor("guard_barracks", 1),
      ],
    },
    {
      buildingName: "traveler_hearth_player_house",
      identity:
        "customizable player home with hearth, storage and trophy space",
      focalCue: "Home Console integrated into a writing and storage alcove",
      fixtures: [
        ...commonHomeGround("traveler_hearth", "cookpot"),
        f(
          "traveler_console",
          "business_service_counter",
          "Traveler Hearth Home Console alcove",
          "south"
        ),
        ...commonHomeUpper("traveler_hearth", 1),
      ],
    },
    {
      buildingName: "mara_thistle_two_story_house",
      identity: "market family home shaped by grain accounts and remembrance",
      focalCue: "market ledger beside a red headscarf and family keepsake",
      fixtures: [
        ...commonHomeGround("mara_thistle", "cookpot"),
        f(
          "mara_pantry",
          "display_shelf",
          "Mara Thistle pantry and produce shelf",
          "south"
        ),
        ...commonHomeUpper("mara_thistle", 1),
        f(
          "mara_memory",
          "lockbox",
          "Mara Thistle family-memory correspondence box",
          "west",
          1
        ),
      ],
    },
    {
      buildingName: "reeve_hall",
      identity: "law, petitions, taxes, diplomacy and Merrow household",
      focalCue: "formal council table beneath the Harthmere seal",
      fixtures: [
        f(
          "reeve_reception",
          "business_service_counter",
          "Reeve Hall petition reception",
          "north"
        ),
        f("reeve_council", "t_table", "Reeve Hall council table", "west"),
        f(
          "reeve_waiting",
          "bench",
          "Reeve Hall petition waiting bench",
          "east"
        ),
        f(
          "reeve_records",
          "display_shelf",
          "Reeve Hall permit and tax archive",
          "south"
        ),
        f("reeve_seal", "table", "Reeve Hall seal press table", "north"),
        f(
          "reeve_guard",
          "wood_container",
          "Reeve Hall guard station storage",
          "east"
        ),
        ...commonHomeUpper("reeve_private", 1, true),
        f(
          "reeve_audit",
          "display_shelf",
          "Reeve Hall red-ink audit archive",
          "south",
          1
        ),
        f(
          "reeve_dining",
          "t_table",
          "Reeve Hall diplomatic dining table",
          "west",
          1
        ),
      ],
      npcs: [
        npc(32, "Reeve at the council table"),
        npc(54, "tax clerk at the permit counter"),
        npc(55, "household and diplomatic service point"),
      ],
    },
    {
      buildingName: "edrik_vane_noble_rise_estate",
      identity:
        "polished appraisal salon, debt office and concealed deed archive",
      focalCue:
        "beautiful brass scale before an intimidating wall of sealed deeds",
      fixtures: [
        f(
          "edrik_receiving",
          "t_table",
          "Edrik Vane receiving and appraisal table",
          "north"
        ),
        f(
          "edrik_deeds",
          "display_shelf",
          "Edrik Vane sealed deed wall",
          "east"
        ),
        f(
          "edrik_contract",
          "table",
          "Edrik Vane contract-writing desk",
          "west"
        ),
        f(
          "edrik_strongroom",
          "treasure_chest",
          "Edrik Vane strongroom chest",
          "south"
        ),
        f("edrik_pawn", "display_shelf", "Edrik Vane pawn display", "east"),
        f("edrik_waiting", "padded_chair", "Edrik Vane salon chair", "west"),
        ...commonHomeUpper("edrik_private", 1, true),
        f(
          "edrik_hidden",
          "lockbox",
          "Edrik Vane false-backed compromised deed cache",
          "south",
          1
        ),
        f(
          "edrik_meeting",
          "t_table",
          "Edrik Vane discreet meeting table",
          "west",
          1
        ),
      ],
    },
    {
      buildingName: "dawn_loaf_bakery",
      identity: "retail bread front, visible bake line and baker residence",
      focalCue: "bread-and-pie display backed by oven glow",
      fixtures: [
        f(
          "bakery_counter",
          "business_service_counter",
          "Dawn Loaf retail counter",
          "east"
        ),
        f(
          "bakery_display",
          "display_shelf",
          "Dawn Loaf bread and pie display",
          "north"
        ),
        c("bakery_oven", "oven", "Dawn Loaf wood-fired bakery oven", "west"),
        f("bakery_kneading", "table", "Dawn Loaf kneading table", "south"),
        f("bakery_flour", "wood_container", "Dawn Loaf flour bin", "north"),
        d(
          "bakery_apples",
          "town_produce_crate",
          "Dawn Loaf orchard apple crate",
          [1.18, 0.84, 0.88],
          "south"
        ),
        ...commonHomeUpper("dawn_loaf_home", 1),
      ],
      npcs: [
        npc(5, "Maren behind the retail counter"),
        npc(68, "bakery apprentice at the kneading table"),
      ],
    },
    {
      buildingName: "brindle_provision_house",
      identity: "dense travel provisions with a protected central aisle",
      focalCue: "expedition wall of maps, rope, packs and lanterns",
      fixtures: [
        f(
          "provision_counter",
          "business_service_counter",
          "Brindle Provision weighing counter",
          "north"
        ),
        f(
          "provision_shelf_a",
          "display_shelf",
          "Brindle Provision expedition shelf A",
          "west"
        ),
        f(
          "provision_shelf_b",
          "display_shelf",
          "Brindle Provision expedition shelf B",
          "east"
        ),
        f(
          "provision_stock",
          "cargo_crate",
          "Brindle Provision wrapped travel bundles",
          "south"
        ),
        f(
          "provision_secure",
          "lockbox",
          "Brindle Provision limited-stock cabinet",
          "north"
        ),
        d(
          "provision_rope",
          "town_rope_rack",
          "Brindle Provision rope-coil display",
          [1.34, 1.66, 0.5],
          "east"
        ),
      ],
    },
    {
      buildingName: "market_auction_office",
      identity:
        "auction listings, fees, appraisal, escrow and guild registration",
      focalCue: "ledger lecterns facing wax-sealed auction lots",
      fixtures: [
        ...commonOffice("auction_office"),
        f(
          "auction_appraisal",
          "t_table",
          "Auction Office appraisal table",
          "north"
        ),
        f(
          "auction_escrow",
          "lockbox",
          "Auction Office escrow lockboxes",
          "south"
        ),
      ],
      npcs: [
        npc(59, "guild registrar desk"),
        npc(60, "auction clerk listing counter"),
      ],
    },
    {
      buildingName: "brass_scale_bank",
      identity: "currency, loans, appraisal, storage and guarded witnessing",
      focalCue: "brass scale motif on the teller counter and vault",
      fixtures: [
        f(
          "bank_counter",
          "business_service_counter",
          "Brass Scale teller counter",
          "north"
        ),
        f("bank_appraisal", "table", "Brass Scale appraisal desk", "west"),
        f("bank_witness", "t_table", "Brass Scale witness table", "east"),
        f("bank_waiting", "bench", "Brass Scale customer bench", "west"),
        f(
          "bank_lockboxes",
          "display_shelf",
          "Brass Scale lockbox wall",
          "east"
        ),
        f(
          "bank_vault",
          "treasure_chest",
          "Brass Scale strongroom vault chest",
          "south"
        ),
        f("bank_deeds", "shelf", "Brass Scale deed shelf", "south"),
      ],
      npcs: [
        npc(6, "banker at the teller opening"),
        npc(36, "loan and pawn appraisal desk"),
      ],
    },
    {
      buildingName: "black_anvil_smithy",
      identity:
        "forge triangle, commissions, repair intake and smith residence",
      focalCue: "oversized forge and anvil cluster for Bellbinder work",
      fixtures: [
        d(
          "smithy_anvil",
          "town_forge_anvil",
          "Black Anvil main anvil",
          [1.14, 0.88, 0.74],
          "north"
        ),
        d(
          "smithy_bench",
          "town_workbench",
          "Black Anvil repair bench",
          [1.78, 0.98, 0.82],
          "west"
        ),
        f(
          "smithy_intake",
          "business_service_counter",
          "Black Anvil repair intake",
          "south"
        ),
        f("smithy_coal", "wood_container", "Black Anvil coal bin", "north"),
        f("smithy_ore", "cargo_crate", "Black Anvil ore stock", "east"),
        d(
          "smithy_weapons",
          "town_tool_rack",
          "Black Anvil finished weapon rack",
          [1.42, 1.8, 0.5],
          "east"
        ),
        ...commonHomeUpper("black_anvil_home", 1),
      ],
      npcs: [
        npc(7, "weapons teller at repair intake"),
        npc(29, "Master Osric at the main anvil"),
        npc(67, "forge apprentice at the repair bench"),
      ],
    },
    {
      buildingName: "crafters_workshop",
      identity:
        "carpentry, structural inspection, drafting and repair commissions",
      focalCue: "bridge diagrams on a crack-measurement drafting table",
      fixtures: [
        d(
          "workshop_bench",
          "town_workbench",
          "Crafters Workshop saw and clamp bench",
          [1.78, 0.98, 0.82],
          "north"
        ),
        f(
          "workshop_drafting",
          "table",
          "Crafters Workshop drafting table",
          "west"
        ),
        f(
          "workshop_lumber",
          "display_shelf",
          "Crafters Workshop lumber and fastener rack",
          "east"
        ),
        f(
          "workshop_orders",
          "shelf",
          "Crafters Workshop work-order board shelf",
          "south"
        ),
        f(
          "workshop_parts",
          "cargo_crate",
          "Crafters Workshop frame and wheel parts",
          "north"
        ),
        f(
          "workshop_living",
          "small_bed",
          "Crafters Workshop screened living cot",
          "east"
        ),
      ],
      npcs: [npc(48, "Garrik at the drafting table")],
    },
    {
      buildingName: "green_mortar_apothecary",
      identity:
        "clean medicine front separated from private experimental stock",
      focalCue: "green mortar table under river herbs and amber bottles",
      fixtures: [
        f(
          "apothecary_counter",
          "business_service_counter",
          "Green Mortar medicine counter",
          "east"
        ),
        f(
          "apothecary_bottles",
          "display_shelf",
          "Green Mortar labeled bottle shelf",
          "north"
        ),
        d(
          "apothecary_mortar",
          "town_workbench",
          "Green Mortar mortar worktable",
          [1.78, 0.98, 0.82],
          "west"
        ),
        c(
          "apothecary_brew",
          "cookpot",
          "Green Mortar infusion cookpot",
          "south"
        ),
        f(
          "apothecary_exam",
          "small_bed",
          "Green Mortar examination cot",
          "north"
        ),
        f(
          "apothecary_rare",
          "lockbox",
          "Green Mortar rare reagent cabinet",
          "south"
        ),
      ],
      npcs: [
        npc(8, "healer at the medicine counter"),
        npc(47, "Ysabet in the private preparation zone"),
      ],
    },
    {
      buildingName: "wyrm_and_candle_magic_shop",
      identity: "ordinary magic retail with guarded Bellbinder research above",
      focalCue: "Bellbinder shelf behind the counter and a floor ward circle",
      fixtures: [
        f(
          "magic_counter",
          "business_service_counter",
          "Wyrm and Candle appraisal counter",
          "south"
        ),
        f(
          "magic_scrolls",
          "display_shelf",
          "Wyrm and Candle scroll drawers",
          "west"
        ),
        f(
          "magic_charms",
          "display_shelf",
          "Wyrm and Candle candle and charm display",
          "east"
        ),
        f("magic_reading", "table", "Wyrm and Candle reading table", "north"),
        f(
          "magic_components",
          "lockbox",
          "Wyrm and Candle secure component chest",
          "east"
        ),
        d(
          "magic_ward",
          "town_ward_focus",
          "Wyrm and Candle marked ward circle focus",
          [0.98, 1.16, 0.98],
          "west"
        ),
        ...commonHomeUpper("wyrm_study", 1, true),
        f(
          "magic_bellbinder",
          "display_shelf",
          "Wyrm and Candle Bellbinder lore shelf",
          "north",
          1
        ),
        f(
          "magic_rare",
          "lockbox",
          "Wyrm and Candle locked research storage",
          "south",
          1
        ),
      ],
      npcs: [npc(9, "magic supplier at the appraisal counter")],
    },
    {
      buildingName: "copper_kettle_inn",
      identity:
        "social hearth, food, rooms, rumors, music and concealed cellar history",
      focalCue: "broad copper-kettle hearth and room-key wall",
      fixtures: [
        f(
          "inn_reception",
          "business_service_counter",
          "Copper Kettle reception and key counter",
          "west"
        ),
        c(
          "inn_kitchen",
          "cookpot",
          "Copper Kettle kitchen stew kettle",
          "north"
        ),
        f("inn_common_a", "t_table", "Copper Kettle common table A", "east"),
        f("inn_common_b", "table", "Copper Kettle card table", "south"),
        f("inn_bench", "bench", "Copper Kettle hearth bench", "north"),
        f(
          "inn_luggage",
          "display_shelf",
          "Copper Kettle luggage and room-key rack",
          "east"
        ),
        d(
          "inn_stage",
          "town_chapel_altar",
          "Copper Kettle bard nook stage",
          [1.3, 1.44, 0.98],
          "south"
        ),
        ...commonHomeUpper("inn_guest_a", 1),
        f(
          "inn_guest_b_bed",
          "small_bed",
          "Copper Kettle second guest bed",
          "south",
          1
        ),
        f(
          "inn_linen",
          "wardrobe_storage",
          "Copper Kettle linen storage",
          "east",
          1
        ),
        f(
          "inn_meeting",
          "t_table",
          "Copper Kettle guild meeting table",
          "west",
          1
        ),
      ],
      npcs: [
        npc(11, "bartender behind the reception bar"),
        npc(12, "dockhand common-room seat"),
        npc(13, "storyteller hearth seat"),
        npc(14, "card player table"),
        npc(15, "traveler common-room seat"),
        npc(16, "bard stage"),
        npc(30, "innkeeper room-key counter"),
      ],
    },
    {
      buildingName: "saint_verena_chapel",
      identity:
        "chapel, memorial, healing, archive, infirmary and bell mystery",
      focalCue: "missing-bell memorial framed by blue ribbons and candle gold",
      fixtures: [
        d(
          "chapel_pew_a",
          "town_chapel_pew",
          "Saint Verena nave pew A",
          [2.38, 0.98, 0.78],
          "west"
        ),
        d(
          "chapel_pew_b",
          "town_chapel_pew",
          "Saint Verena nave pew B",
          [2.38, 0.98, 0.78],
          "east"
        ),
        d(
          "chapel_altar",
          "town_chapel_altar",
          "Saint Verena altar and missing-bell memorial",
          [1.3, 1.44, 0.98],
          "north"
        ),
        f(
          "chapel_memorial",
          "display_shelf",
          "Saint Verena blue-ribbon memorial shelf",
          "north"
        ),
        f(
          "chapel_counsel",
          "bench",
          "Saint Verena private counsel bench",
          "west"
        ),
        f(
          "chapel_infirmary",
          "small_bed",
          "Saint Verena treatment cot",
          "east"
        ),
        f(
          "chapel_archive",
          "display_shelf",
          "Saint Verena iron-bound archive",
          "north",
          1
        ),
        f(
          "chapel_reading",
          "table",
          "Saint Verena single-window archive desk",
          "west",
          1
        ),
        f(
          "chapel_clergy",
          "wardrobe_storage",
          "Saint Verena clergy storage",
          "east",
          1
        ),
        f(
          "chapel_cellar",
          "lockbox",
          "Saint Verena concealed cellar records",
          "south",
          1
        ),
      ],
      npcs: [
        npc(31, "Father Aldren at the altar"),
        npc(46, "Sister Maelle in the infirmary"),
        npc(66, "choir child beside the memorial"),
      ],
    },
    {
      buildingName: "brother_vance_chapel_cottage",
      identity: "simple aging chapel assistant's home organized by touch",
      focalCue: "tea beside blue-ribbon letters and an old candlestick",
      fixtures: [
        ...commonHomeGround("brother_vance", "cookpot"),
        f("vance_bed", "small_bed", "Brother Vance worn bed", "west"),
        f(
          "vance_records",
          "lockbox",
          "Brother Vance Halene-era record chest",
          "south"
        ),
      ],
    },
    {
      buildingName: "river_dock_supply",
      identity: "fishing, ferries, tackle and wet-weather river provisioning",
      focalCue: "fishhook-and-rope display behind the service counter",
      fixtures: [
        f(
          "dock_supply_counter",
          "business_service_counter",
          "River Dock Supply service counter",
          "west"
        ),
        f(
          "dock_supply_tackle",
          "display_shelf",
          "River Dock Supply tackle drawers",
          "north"
        ),
        f(
          "dock_supply_crates",
          "cargo_crate",
          "River Dock Supply waterproof crates",
          "south"
        ),
        f(
          "dock_supply_scale",
          "table",
          "River Dock Supply fish scale table",
          "east"
        ),
        d(
          "dock_supply_rope",
          "town_rope_rack",
          "River Dock Supply rope and chain display",
          [1.34, 1.66, 0.5],
          "north"
        ),
        f(
          "dock_supply_routes",
          "shelf",
          "River Dock Supply ferry route board shelf",
          "east"
        ),
      ],
      npcs: [npc(34, "dockmaster ledger counter"), npc(51, "ferry route desk")],
    },
    {
      buildingName: "dock_warehouse",
      identity:
        "cargo bays, inspections, fire control and suspicious-goods quarantine",
      focalCue: "isolated whispering-crate quarantine behind a rope boundary",
      fixtures: [
        f(
          "warehouse_cargo_a",
          "cargo_crate",
          "Dock Warehouse marked cargo bay A",
          "north"
        ),
        f(
          "warehouse_cargo_b",
          "cargo_crate",
          "Dock Warehouse marked cargo bay B",
          "south"
        ),
        f(
          "warehouse_barrels",
          "wood_container",
          "Dock Warehouse sealed barrel bay",
          "east"
        ),
        f(
          "warehouse_manifest",
          "table",
          "Dock Warehouse manifest and inspection desk",
          "west"
        ),
        f(
          "warehouse_evidence",
          "lockbox",
          "Dock Warehouse evidence cage lockbox",
          "north"
        ),
        f(
          "warehouse_whisper",
          "treasure_chest",
          "Dock Warehouse whispering-crate quarantine",
          "south"
        ),
        d(
          "warehouse_chain",
          "town_rope_rack",
          "Dock Warehouse chain and rope wall",
          [1.34, 1.66, 0.5],
          "east"
        ),
      ],
    },
    {
      buildingName: "harthmere_watermill",
      identity: "grain-to-flour work line with protected mill machinery",
      focalCue: "visible mill gearing between hopper and sack line",
      fixtures: [
        d(
          "town_mill_bench",
          "town_workbench",
          "Harthmere Watermill repair bench",
          [1.78, 0.98, 0.82],
          "north"
        ),
        f(
          "town_mill_hopper",
          "wood_container",
          "Harthmere Watermill grain hopper",
          "west"
        ),
        f(
          "town_mill_sacks",
          "cargo_crate",
          "Harthmere Watermill flour sack row",
          "east"
        ),
        f(
          "town_mill_scale",
          "table",
          "Harthmere Watermill grain scale and ledger",
          "south"
        ),
        f(
          "town_mill_packing",
          "business_service_counter",
          "Harthmere Watermill packing table",
          "north"
        ),
        d(
          "town_mill_bucket",
          "town_wash_tub",
          "Harthmere Watermill dust-control water tub",
          [1.38, 0.8, 0.88],
          "east"
        ),
      ],
    },
    {
      buildingName: "mudden_ward_shelter",
      identity: "maintained communal aid, kitchen and family sleeping bays",
      focalCue: "shared repair-notice wall over a crowded communal table",
      fixtures: [
        c(
          "shelter_hearth",
          "cookpot",
          "Mudden Shelter communal cook hearth",
          "north"
        ),
        f("shelter_table", "t_table", "Mudden Shelter communal table", "west"),
        f(
          "shelter_aid",
          "display_shelf",
          "Mudden Shelter aid distribution shelf",
          "east"
        ),
        f(
          "shelter_children",
          "bench",
          "Mudden Shelter children's corner bench",
          "south"
        ),
        f(
          "shelter_first_aid",
          "lockbox",
          "Mudden Shelter first-aid cupboard",
          "north"
        ),
        f(
          "shelter_repairs",
          "shelf",
          "Mudden Shelter notice and repair wall",
          "east"
        ),
        ...bunkFloor("mudden_shelter_family_a", 1),
        f(
          "shelter_family_b",
          "small_bed",
          "Mudden Shelter family sleeping bay B",
          "east",
          1
        ),
        f(
          "shelter_mending",
          "table",
          "Mudden Shelter upper mending station",
          "west",
          1
        ),
      ],
      npcs: [npc(61, "rat catcher at the community notice wall")],
    },
    {
      buildingName: "mudden_laundry_house",
      identity: "wash labor, heated copper, linen storage and mending rooms",
      focalCue:
        "active wash line and suspended cloth rather than generic barrels",
      fixtures: [
        c(
          "laundry_boiler",
          "cookpot",
          "Mudden Laundry heated wash copper",
          "north"
        ),
        f(
          "laundry_tub_a",
          "wood_container",
          "Mudden Laundry wash tub A",
          "west"
        ),
        f(
          "laundry_tub_b",
          "wood_container",
          "Mudden Laundry wash tub B",
          "east"
        ),
        f("laundry_scrub", "table", "Mudden Laundry scrubbing table", "south"),
        f(
          "laundry_linen",
          "display_shelf",
          "Mudden Laundry linen cage",
          "north"
        ),
        f(
          "laundry_press",
          "business_service_counter",
          "Mudden Laundry wringer and press",
          "east"
        ),
        ...commonHomeUpper("laundry_workers", 1),
        f(
          "laundry_cloth",
          "wardrobe_storage",
          "Mudden Laundry dry cloth storage",
          "south",
          1
        ),
      ],
      npcs: [npc(53, "washerwoman at the wash tubs")],
    },
    apartmentPlan(
      "rosewall_house",
      "respectable rose-textile household",
      "rose textiles, flower press and cared-for parlor",
      "town_textile_drape",
      "Rosewall dyed textile and flower-press accent"
    ),
    apartmentPlan(
      "sunbeam_house",
      "bright child-friendly daylight household",
      "breakfast table and window-oriented reading bench",
      "town_textile_drape",
      "Sunbeam pale curtain and daylight accent"
    ),
    apartmentPlan(
      "blue_shutter_house",
      "river-worker family home",
      "blue cloth, boot storage and river keepsakes",
      "town_rope_rack",
      "Blue Shutter river rope and coat accent"
    ),
    apartmentPlan(
      "chimneybend_house",
      "hearth-centered repaired household",
      "large warm hearth with soot-dark working details",
      "town_firewood_stack",
      "Chimneybend firewood and chimney-tool accent"
    ),
    apartmentPlan(
      "lavender_lane_house",
      "quiet domestic care and linen work",
      "linen cupboard, sachets and mending table",
      "town_reagent_shelf",
      "Lavender Lane herb and sachet shelf"
    ),
    apartmentPlan(
      "brass_knocker_house",
      "aspirational clerk and junior-merchant home",
      "writing desks, account storage and brass details",
      "town_record_stack",
      "Brass Knocker account-book accent"
    ),
    apartmentPlan(
      "appleblossom_house",
      "seasonal orchard-worker family home",
      "preserve jars, fruit strings and green textiles",
      "town_produce_crate",
      "Appleblossom orchard basket accent"
    ),
    apartmentPlan(
      "wheatgold_house",
      "field and mill household",
      "grain storage, work aprons and sturdy pantry",
      "town_produce_crate",
      "Wheatgold grain-sack pantry accent"
    ),
    apartmentPlan(
      "canalview_house",
      "dock and canal family home",
      "rain gear, net repair and blue-gray keepsakes",
      "town_rope_rack",
      "Canalview net and river-chart accent"
    ),
    apartmentPlan(
      "millers_rest_house",
      "mill-worker residential home",
      "flour cupboards, work belts and early-shift meals",
      "town_produce_crate",
      "Miller's Rest flour-sack and work-apron accent"
    ),
    stackPlan(
      "tangle_stairs_stack",
      "repair-minded homes fitted around difficult circulation",
      "rope handrails and landing tool niches",
      5,
      "town_rope_rack",
      "Tangle Stairs rope handrail and repair accent"
    ),
    stackPlan(
      "soot_ladder_stack",
      "charcoal, forge and chimney-worker housing",
      "clean sleeping bays above soot-dark work landings",
      5,
      "town_wash_tub",
      "Soot Ladder boot-wash and coal-bucket accent"
    ),
    stackPlan(
      "dripline_stack",
      "leak-managed raised-storage housing",
      "catch buckets and dry platforms show intelligent repair",
      4,
      "town_wash_tub",
      "Dripline rain catch and leak-repair accent"
    ),
    stackPlan(
      "washline_stack",
      "laundry-linked family stack",
      "mending surfaces, cloth baskets and communal tea",
      4,
      "town_textile_drape",
      "Washline suspended cloth and mending accent"
    ),
    {
      buildingName: "old_well_underways_entry_house",
      identity:
        "disguised municipal maintenance front for the buried Bellward descent",
      focalCue:
        "barred descent gear with rope windlass and faint bell markings",
      fixtures: [
        f(
          "well_windlass",
          "t_table",
          "Old Well rope windlass service table",
          "north"
        ),
        f(
          "well_records",
          "lockbox",
          "Old Well locked municipal records",
          "west"
        ),
        f(
          "well_tools",
          "display_shelf",
          "Old Well drain and grate tools",
          "east"
        ),
        f(
          "well_bucket",
          "wood_container",
          "Old Well rope and bucket gear",
          "south"
        ),
        d(
          "well_chain",
          "town_rope_rack",
          "Old Well rusted grate chain",
          [1.34, 1.66, 0.5],
          "east"
        ),
      ],
      npcs: [
        npc(62, "Bell witness at the concealed descent records"),
        npc(70, "Underways echo near the hidden mechanism"),
      ],
    },
    {
      buildingName: "rat_crown_drain_house",
      identity: "overlooked drain-keeper shop and recovered rat-cult evidence",
      focalCue: "tiny household shrine among rat crowns and tunnel maps",
      fixtures: [
        d(
          "drain_bench",
          "town_workbench",
          "Rat Crown drain-keeper workbench",
          [1.78, 0.98, 0.82],
          "north"
        ),
        f(
          "drain_traps",
          "cargo_crate",
          "Rat Crown trap and cage stock",
          "west"
        ),
        f("drain_maps", "display_shelf", "Rat Crown tunnel map shelf", "east"),
        f(
          "drain_shrine",
          "table",
          "Rat Crown cracked household shrine",
          "south"
        ),
        f(
          "drain_evidence",
          "lockbox",
          "Rat Crown crown-fragment evidence box",
          "north"
        ),
      ],
    },
    {
      buildingName: "last_watch_post_bunkhouse",
      identity:
        "last reliable warning and patrol post before the dangerous Wilds",
      focalCue: "heavily marked danger map beside the warning horn",
      fixtures: [
        ...commonOffice("last_watch_warning"),
        d(
          "last_watch_weapons",
          "town_tool_rack",
          "Last Watch spare weapon rack",
          [1.42, 1.8, 0.5],
          "east"
        ),
        ...bunkFloor("last_watch_bunks", 1),
      ],
    },
    {
      buildingName: "miller_rest_watermill",
      identity: "two-floor mill machinery, quality control and miller quarters",
      focalCue: "vertical drive mechanism linking work floor and drying loft",
      fixtures: [
        d(
          "wild_mill_bench",
          "town_workbench",
          "Miller Rest machinery repair bench",
          [1.78, 0.98, 0.82],
          "north"
        ),
        f(
          "wild_mill_hopper",
          "wood_container",
          "Miller Rest grain hopper",
          "west"
        ),
        f(
          "wild_mill_sacks",
          "cargo_crate",
          "Miller Rest sack-filling line",
          "east"
        ),
        f(
          "wild_mill_packing",
          "business_service_counter",
          "Miller Rest packing station",
          "south"
        ),
        ...commonHomeUpper("miller_rest_miller", 1),
        f(
          "wild_mill_spares",
          "display_shelf",
          "Miller Rest spare drive parts",
          "south",
          1
        ),
      ],
    },
    {
      buildingName: "mill_worker_cottage",
      identity: "modest dry cottage prepared for early mill shifts",
      focalCue: "work clothes and lunch provisions ready by the door",
      fixtures: [
        ...commonHomeGround("mill_worker", "cookpot"),
        f("mill_worker_bed", "small_bed", "Mill Worker Cottage bed", "north"),
        f(
          "mill_worker_dry",
          "lockbox",
          "Mill Worker Cottage protected dry chest",
          "south"
        ),
      ],
    },
    {
      buildingName: "northwest_ruined_watchtower",
      identity: "exposed ruined signal tower reused as a survivor camp",
      focalCue: "broken signal station beside a patched bedroll",
      fixtures: [
        c(
          "ruin_fire",
          "campfire",
          "Ruined Watchtower survivor campfire",
          "north"
        ),
        f(
          "ruin_bedroll",
          "small_bed",
          "Ruined Watchtower makeshift bedroll",
          "west"
        ),
        f(
          "ruin_table",
          "table",
          "Ruined Watchtower scavenged map table",
          "east"
        ),
        f(
          "ruin_chest",
          "lockbox",
          "Ruined Watchtower secured camp chest",
          "south"
        ),
        d(
          "ruin_weapons",
          "town_tool_rack",
          "Ruined Watchtower cracked weapon rack",
          [1.42, 1.8, 0.5],
          "east"
        ),
        f(
          "ruin_rope",
          "wood_container",
          "Ruined Watchtower climbing gear",
          "north",
          1
        ),
        f(
          "ruin_signal",
          "table",
          "Ruined Watchtower broken signal station",
          "south",
          1
        ),
        f(
          "ruin_rain",
          "wood_container",
          "Ruined Watchtower rain catch",
          "east",
          2
        ),
      ],
    },
    {
      buildingName: "southwest_orchard_windmill",
      identity: "orchard intake, press, drive gears and windmill maintenance",
      focalCue: "apple crates beneath the mill drive shaft",
      fixtures: [
        f(
          "orchard_intake",
          "business_service_counter",
          "Orchard Windmill produce intake",
          "north"
        ),
        d(
          "orchard_apples",
          "town_produce_crate",
          "Orchard Windmill apple crate",
          [1.18, 0.84, 0.88],
          "west"
        ),
        f(
          "orchard_barrels",
          "wood_container",
          "Orchard Windmill cider barrel stock",
          "east"
        ),
        f("orchard_scale", "table", "Orchard Windmill produce scale", "south"),
        d(
          "orchard_repair",
          "town_workbench",
          "Orchard Windmill gear repair bench",
          [1.78, 0.98, 0.82],
          "north",
          1
        ),
        f(
          "orchard_sails",
          "cargo_crate",
          "Orchard Windmill spare sail cloth",
          "south",
          1
        ),
        f(
          "orchard_access",
          "wood_container",
          "Orchard Windmill upper machinery tools",
          "east",
          2
        ),
      ],
    },
    {
      buildingName: "greenmere_edge_cabin",
      identity:
        "ranger field cabin for tracks, weather and emergency trail supply",
      focalCue: "track-and-route table covered with Greenmere observations",
      fixtures: [
        ...commonHomeGround("greenmere_cabin", "campfire"),
        f("greenmere_bed", "small_bed", "Greenmere ranger bed", "north"),
        d(
          "greenmere_bow",
          "town_tool_rack",
          "Greenmere bow and field-tool rack",
          [1.42, 1.8, 0.5],
          "east"
        ),
        f("greenmere_map", "table", "Greenmere track and route table", "west"),
        f(
          "greenmere_supplies",
          "lockbox",
          "Greenmere emergency trail supplies",
          "south"
        ),
      ],
    },
    {
      buildingName: "charcoal_burners_camp",
      identity:
        "dangerous charcoal labor with a clean food and recovery corner",
      focalCue: "medicine shelf beside soot-black work gear",
      fixtures: [
        c(
          "charcoal_hearth",
          "campfire",
          "Charcoal Burners central cook fire",
          "north"
        ),
        f("charcoal_bunk_a", "small_bed", "Charcoal Burners bunk A", "west"),
        f("charcoal_bunk_b", "small_bed", "Charcoal Burners bunk B", "east"),
        f(
          "charcoal_table",
          "table",
          "Charcoal Burners humble eating table",
          "south"
        ),
        f(
          "charcoal_medicine",
          "shelf",
          "Charcoal Burners respiratory remedy shelf",
          "north"
        ),
        d(
          "charcoal_tools",
          "town_tool_rack",
          "Charcoal Burners axe and shovel rack",
          [1.42, 1.8, 0.5],
          "east"
        ),
      ],
    },
    {
      buildingName: "briarfen_stilt_hut",
      identity: "raised dry marsh-guide storage and concealed route equipment",
      focalCue: "marsh-route table under hanging reed and herb bundles",
      fixtures: [
        ...commonHomeGround("briarfen_hut", "campfire"),
        f("briarfen_bed", "small_bed", "Briarfen compact raised bed", "north"),
        f("briarfen_map", "table", "Briarfen marsh-route table", "west"),
        f(
          "briarfen_antidote",
          "lockbox",
          "Briarfen antidote and smuggler compartment",
          "south"
        ),
        d(
          "briarfen_rope",
          "town_rope_rack",
          "Briarfen pole-hook and rope gear",
          [1.34, 1.66, 0.5],
          "east"
        ),
      ],
    },
    {
      buildingName: "grave_tender_caretaker_house",
      identity: "solemn practical grave care, records and funeral preparation",
      focalCue: "grave ledger beside ribbon and candle preparation",
      fixtures: [
        ...commonHomeGround("grave_tender", "cookpot"),
        f("grave_tender_bed", "small_bed", "Grave Tender modest bed", "north"),
        f(
          "grave_tender_ledger",
          "table",
          "Grave Tender grave ledger desk",
          "west"
        ),
        d(
          "grave_tender_tools",
          "town_grave_tool_rack",
          "Grave Tender shovel and rake rack",
          [1.3, 1.7, 0.46],
          "east"
        ),
        f(
          "grave_tender_ritual",
          "lockbox",
          "Grave Tender recovered-goods chest",
          "south"
        ),
      ],
    },
    {
      buildingName: "deep_old_wood_glade_lodge",
      identity:
        "rough-hewn threshold lodge for forest lore, medicine and riddles",
      focalCue: "low ritual map table ringed by forest specimens",
      fixtures: [
        ...commonHomeGround("old_wood_lodge", "campfire"),
        f("old_wood_bed", "small_bed", "Deep Old Wood woven bed", "north"),
        f(
          "old_wood_ritual",
          "t_table",
          "Deep Old Wood ritual and forest map table",
          "west"
        ),
        f(
          "old_wood_specimens",
          "display_shelf",
          "Deep Old Wood herb and fungus shelf",
          "east"
        ),
        f(
          "old_wood_guest",
          "wooden_chair",
          "Deep Old Wood riddle guest seat",
          "south"
        ),
      ],
    },
    {
      buildingName: "thornbridge_crossing_shelter",
      identity: "public refuge and bridge-condition warning point",
      focalCue: "bridge condition board beside emergency repair gear",
      fixtures: [
        c(
          "thornbridge_hearth",
          "campfire",
          "Thornbridge safe emergency hearth",
          "north"
        ),
        f("thornbridge_bench_a", "bench", "Thornbridge wall bench A", "west"),
        f("thornbridge_bench_b", "bench", "Thornbridge wall bench B", "east"),
        f(
          "thornbridge_rations",
          "lockbox",
          "Thornbridge emergency ration chest",
          "south"
        ),
        f(
          "thornbridge_tools",
          "display_shelf",
          "Thornbridge bridge repair rack",
          "north"
        ),
        f("thornbridge_log", "table", "Thornbridge route log table", "south"),
      ],
    },
    {
      buildingName: "mail_post_house",
      identity: "dispatch, sorting, secure parcels and courier quarters",
      focalCue: "floor-to-ceiling sorting wall of letters and route tags",
      fixtures: [
        f(
          "mail_counter",
          "business_service_counter",
          "Mail Post dispatch counter",
          "south"
        ),
        f(
          "mail_sorting",
          "display_shelf",
          "Mail Post sorting cubbies",
          "north"
        ),
        f("mail_scale", "table", "Mail Post parcel scale", "west"),
        f("mail_secure", "lockbox", "Mail Post secure parcel cage", "east"),
        f("mail_outgoing", "cargo_crate", "Mail Post outgoing bins", "north"),
        f("mail_bench", "bench", "Mail Post courier bench", "west"),
        ...commonHomeUpper("courier_anwen", 1),
        f("mail_journals", "shelf", "Courier Anwen route journals", "south", 1),
      ],
      npcs: [npc(43, "Courier Anwen at the dispatch counter")],
    },
    {
      buildingName: "tailor_loft_house",
      identity: "cutting, fitting, dyes, banners and private commission loft",
      focalCue: "cutting station surrounded by faded district colors",
      fixtures: [
        f("tailor_cutting", "t_table", "Tailor Loft cutting table", "north"),
        f(
          "tailor_fabric",
          "display_shelf",
          "Tailor Loft fabric bolt and dye shelf",
          "west"
        ),
        f(
          "tailor_orders",
          "business_service_counter",
          "Tailor Loft fitting and order counter",
          "south"
        ),
        f(
          "tailor_garments",
          "wardrobe_storage",
          "Tailor Loft garment rack",
          "east"
        ),
        f("tailor_stool", "padded_chair", "Tailor Loft fitting stool", "west"),
        ...commonHomeUpper("helna_tailor", 1),
        f(
          "tailor_commissions",
          "lockbox",
          "Tailor Loft locked noble commissions",
          "south",
          1
        ),
      ],
      npcs: [npc(49, "Helna at the cutting and fitting station")],
    },
    {
      buildingName: "tannery_court_house",
      identity: "separated raw-hide processing and clean finished leatherwork",
      focalCue: "clear transition from hide work to finished tack display",
      fixtures: [
        f(
          "tannery_raw",
          "cargo_crate",
          "Tannery raw hide holding rack",
          "north"
        ),
        f("tannery_vat", "wood_container", "Tannery wash and tan vat", "west"),
        d(
          "tannery_scrape",
          "town_workbench",
          "Tannery scraping and knife bench",
          [1.78, 0.98, 0.82],
          "east"
        ),
        f("tannery_clean", "table", "Tannery clean leather bench", "south"),
        f(
          "tannery_tack",
          "display_shelf",
          "Tannery finished tack and boot display",
          "north"
        ),
        f(
          "tannery_orders",
          "business_service_counter",
          "Tannery order counter",
          "east"
        ),
        f(
          "tannery_bed",
          "small_bed",
          "Tannery screened sleeping nook",
          "south"
        ),
      ],
    },
    {
      buildingName: "dockside_family_house",
      identity:
        "river family home, ledger office and concealed smuggling contact point",
      focalCue: "family table beside official and hidden ledgers",
      fixtures: [
        ...commonHomeGround("dockside_family", "cookpot"),
        f(
          "dockside_ledger",
          "table",
          "Dockside Family official river ledger desk",
          "west"
        ),
        f(
          "dockside_hidden",
          "lockbox",
          "Dockside Family concealed smuggler papers",
          "south"
        ),
        d(
          "dockside_net",
          "town_rope_rack",
          "Dockside Family net-repair gear",
          [1.34, 1.66, 0.5],
          "east"
        ),
        ...commonHomeUpper("dockside_family", 1),
        f(
          "dockside_child_bed",
          "small_bed",
          "Dockside Family children's bed",
          "south",
          1
        ),
        f(
          "dockside_letters",
          "shelf",
          "Dockside Family river correspondence shelf",
          "east",
          1
        ),
      ],
    },
  ] as const;

const PLAN_BY_BUILDING = new Map(
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_PLANS.map((plan) => [
    plan.buildingName,
    plan,
  ])
);

const BUILDING_BY_NAME = new Map(
  HARTHMERE_BUILDINGS.map((building) => [building.name, building])
);

function storyHeight(building: HarthmereBuilding) {
  return building.profile === "gatehouse" || building.profile === "tower"
    ? 6
    : 5;
}

function floorCount(building: HarthmereBuilding) {
  return Math.max(1, building.floors ?? (building.upper ? 2 : 1));
}

function fixtureBaseSize(
  blueprint: HarthmereTownInteriorFixtureBlueprint
): readonly [number, number, number] {
  if (blueprint.kind === "furniture") {
    return HARTHMERE_BUSINESS_FURNITURE_ASSETS[blueprint.itemId].collidableSize;
  }
  if (blueprint.kind === "decor") {
    return blueprint.footprint;
  }
  if (blueprint.stationKind === "oven") {
    return HARTHMERE_BUSINESS_FURNITURE_ASSETS.town_oven_range.collidableSize;
  }
  if (blueprint.stationKind === "cookpot") {
    return HARTHMERE_BUSINESS_FURNITURE_ASSETS.town_cookpot.collidableSize;
  }
  return [1.0, 0.8, 1.0];
}

function wallYaw(wall: HarthmereTownInteriorWall) {
  if (wall === "north") return 0;
  if (wall === "south") return Math.PI;
  if (wall === "west") return Math.PI / 2;
  return -Math.PI / 2;
}

function rotatedSize(
  size: readonly [number, number, number],
  yaw: number
): readonly [number, number, number] {
  const quarterTurns = Math.round(Math.abs(yaw) / (Math.PI / 2)) % 2;
  return quarterTurns === 1 ? [size[2], size[1], size[0]] : size;
}

export function harthmereAdditiveTownInteriorFixtureClearanceSize(
  fixture: Pick<HarthmereTownInteriorFixture, "fixtureId" | "size" | "yaw"> & {
    readonly clearanceSize?: readonly [number, number, number];
  }
): readonly [number, number, number] {
  const size = fixture.clearanceSize ?? rotatedSize(fixture.size, fixture.yaw);
  if (size.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error(`${fixture.fixtureId}: invalid fixture clearance size`);
  }
  return size;
}

interface Candidate {
  readonly x: number;
  readonly z: number;
  readonly wall: HarthmereTownInteriorWall;
  readonly yaw: number;
}

function wallCandidates(
  building: HarthmereBuilding,
  preferred?: HarthmereTownInteriorWall
): Candidate[] {
  const walls: HarthmereTownInteriorWall[] = preferred
    ? [
        preferred,
        ...(["north", "east", "south", "west"] as const).filter(
          (wall) => wall !== preferred
        ),
      ]
    : ["north", "east", "south", "west"];
  const candidates: Candidate[] = [];
  const margin = 2.15;
  const step = 2.25;
  for (const wall of walls) {
    if (wall === "north" || wall === "south") {
      const z = wall === "north" ? building.z0 + margin : building.z1 - margin;
      for (let x = building.x0 + margin; x <= building.x1 - margin; x += step) {
        candidates.push({ x, z, wall, yaw: wallYaw(wall) });
      }
    } else {
      const x = wall === "west" ? building.x0 + margin : building.x1 - margin;
      for (let z = building.z0 + margin; z <= building.z1 - margin; z += step) {
        candidates.push({ x, z, wall, yaw: wallYaw(wall) });
      }
    }
  }
  return candidates;
}

function doorLaneContains(
  building: HarthmereBuilding,
  floor: number,
  x: number,
  z: number
) {
  if (floor !== 0) return false;
  const lateral = 3.2;
  const depth = 5.2;
  if (building.doorSide === "north") {
    return (
      Math.abs(x - building.doorCenter) <= lateral && z <= building.z0 + depth
    );
  }
  if (building.doorSide === "south") {
    return (
      Math.abs(x - building.doorCenter) <= lateral && z >= building.z1 - depth
    );
  }
  if (building.doorSide === "west") {
    return (
      Math.abs(z - building.doorCenter) <= lateral && x <= building.x0 + depth
    );
  }
  return (
    Math.abs(z - building.doorCenter) <= lateral && x >= building.x1 - depth
  );
}

function stairKeepClearContains(
  building: HarthmereBuilding,
  x: number,
  z: number
) {
  const stairs = building.stairs;
  if (!stairs) return false;
  const spanX =
    stairs.direction === "east" || stairs.direction === "west"
      ? stairs.length
      : stairs.width;
  const spanZ =
    stairs.direction === "east" || stairs.direction === "west"
      ? stairs.width
      : stairs.length;
  const pad = 1.35;
  return (
    x >= stairs.x0 - pad &&
    x <= stairs.x0 + spanX + pad &&
    z >= stairs.z0 - pad &&
    z <= stairs.z0 + spanZ + pad
  );
}

function partitionContains(building: HarthmereBuilding, x: number, z: number) {
  const width = building.x1 - building.x0 + 1;
  const depth = building.z1 - building.z0 + 1;
  if (width < 12 || depth < 12) return false;
  const midX = Math.floor((building.x0 + building.x1) / 2);
  const midZ = Math.floor((building.z0 + building.z1) / 2);
  const verticalWall = Math.abs(x - midX) <= 0.75 && Math.abs(z - midZ) > 2.3;
  const horizontalWall = Math.abs(z - midZ) <= 0.75 && Math.abs(x - midX) > 2.3;
  return verticalWall || horizontalWall;
}

function centerCirculationContains(
  building: HarthmereBuilding,
  x: number,
  z: number
) {
  const midX = (building.x0 + building.x1) / 2;
  const midZ = (building.z0 + building.z1) / 2;
  return Math.abs(x - midX) <= 1.25 && Math.abs(z - midZ) <= 1.25;
}

function samplesForAabb(
  x: number,
  z: number,
  size: readonly [number, number, number]
) {
  const hx = size[0] / 2;
  const hz = size[2] / 2;
  return [
    [x - hx, z - hz],
    [x + hx, z - hz],
    [x - hx, z + hz],
    [x + hx, z + hz],
    [x, z],
  ] as const;
}

function aabbOverlaps(
  a: { x: number; z: number; size: readonly [number, number, number] },
  b: { x: number; z: number; size: readonly [number, number, number] },
  pad = 0.18
) {
  return (
    Math.abs(a.x - b.x) < (a.size[0] + b.size[0]) / 2 + pad &&
    Math.abs(a.z - b.z) < (a.size[2] + b.size[2]) / 2 + pad
  );
}

function fixtureFits(input: {
  building: HarthmereBuilding;
  floor: number;
  x: number;
  z: number;
  size: readonly [number, number, number];
  occupied: readonly {
    x: number;
    z: number;
    size: readonly [number, number, number];
  }[];
}) {
  const { building, floor, x, z, size, occupied } = input;
  for (const [sx, sz] of samplesForAabb(x, z, size)) {
    if (
      sx <= building.x0 + 0.65 ||
      sx >= building.x1 - 0.65 ||
      sz <= building.z0 + 0.65 ||
      sz >= building.z1 - 0.65
    ) {
      return false;
    }
    if (
      doorLaneContains(building, floor, sx, sz) ||
      stairKeepClearContains(building, sx, sz) ||
      partitionContains(building, sx, sz) ||
      centerCirculationContains(building, sx, sz)
    ) {
      return false;
    }
  }
  return !occupied.some((other) => aabbOverlaps({ x, z, size }, other));
}

function placePlan(
  building: HarthmereBuilding,
  plan: HarthmereTownInteriorPlan
): HarthmereTownInteriorFixture[] {
  const fixtures: HarthmereTownInteriorFixture[] = [];
  const occupiedByFloor = new Map<
    number,
    Array<{ x: number; z: number; size: readonly [number, number, number] }>
  >();
  for (const blueprint of plan.fixtures) {
    const floor = blueprint.floor ?? 0;
    if (floor < 0 || floor >= floorCount(building)) {
      throw new Error(
        `${building.name}:${blueprint.key} requests missing floor ${floor + 1}`
      );
    }
    const occupied = occupiedByFloor.get(floor) ?? [];
    const baseSize = fixtureBaseSize(blueprint);
    let selected:
      | { candidate: Candidate; size: readonly [number, number, number] }
      | undefined;
    for (const candidate of wallCandidates(building, blueprint.preferredWall)) {
      const size = rotatedSize(baseSize, candidate.yaw);
      if (
        fixtureFits({
          building,
          floor,
          x: candidate.x,
          z: candidate.z,
          size,
          occupied,
        })
      ) {
        selected = { candidate, size };
        break;
      }
    }
    if (!selected) {
      throw new Error(
        `${building.name}:${blueprint.key} has no safe interior slot`
      );
    }
    occupied.push({
      x: selected.candidate.x,
      z: selected.candidate.z,
      size: selected.size,
    });
    occupiedByFloor.set(floor, occupied);
    const scale = blueprint.kind === "decor" ? (blueprint.scale ?? 0.8) : 1;
    const cookingAsset =
      blueprint.kind === "cooking"
        ? blueprint.stationKind === "oven"
          ? "town_oven_range"
          : blueprint.stationKind === "cookpot"
            ? "town_cookpot"
            : undefined
        : undefined;
    fixtures.push({
      fixtureId: `${building.name}:${blueprint.key}`,
      buildingName: building.name,
      district: building.district,
      identity: plan.identity,
      focalCue: plan.focalCue,
      kind: blueprint.kind,
      label: blueprint.label,
      asset: blueprint.kind === "decor" ? blueprint.asset : cookingAsset,
      furnitureItemId:
        blueprint.kind === "furniture" ? blueprint.itemId : undefined,
      stationKind:
        blueprint.kind === "cooking" ? blueprint.stationKind : undefined,
      floor,
      position: [
        selected.candidate.x,
        HARTHMERE_ADDITIVE_TOWN_INTERIOR_GROUND_Y +
          floor * storyHeight(building) +
          0.05,
        selected.candidate.z,
      ],
      yaw: selected.candidate.yaw,
      size: baseSize,
      clearanceSize: selected.size,
      scale,
      collidable:
        blueprint.kind === "decor" ? blueprint.collidable !== false : true,
    });
  }
  return fixtures;
}

export const HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES: readonly HarthmereTownInteriorFixture[] =
  HARTHMERE_BUILDINGS.flatMap((building) => {
    const plan = PLAN_BY_BUILDING.get(building.name);
    if (!plan) {
      throw new Error(
        `Missing additive-town interior plan for ${building.name}`
      );
    }
    return placePlan(building, plan);
  });

const FIXTURES_BY_BUILDING = new Map<string, HarthmereTownInteriorFixture[]>();
for (const fixture of HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES) {
  const list = FIXTURES_BY_BUILDING.get(fixture.buildingName) ?? [];
  list.push(fixture);
  FIXTURES_BY_BUILDING.set(fixture.buildingName, list);
}

export function harthmereAdditiveTownInteriorFixturesForBuilding(
  buildingName: string
) {
  return FIXTURES_BY_BUILDING.get(buildingName) ?? [];
}

function npcCandidates(building: HarthmereBuilding) {
  const midX = (building.x0 + building.x1) / 2;
  const midZ = (building.z0 + building.z1) / 2;
  const spreadX = Math.min(3.25, (building.x1 - building.x0) * 0.2);
  const spreadZ = Math.min(3.25, (building.z1 - building.z0) * 0.2);
  const priority = [
    [midX - spreadX, midZ - spreadZ],
    [midX + spreadX, midZ - spreadZ],
    [midX - spreadX, midZ + spreadZ],
    [midX + spreadX, midZ + spreadZ],
    [midX, midZ],
    [midX - spreadX, midZ],
    [midX + spreadX, midZ],
    [midX, midZ - spreadZ],
    [midX, midZ + spreadZ],
  ] as Array<readonly [number, number]>;
  // Large public interiors can host several named workers/patrons. Continue
  // with a deterministic two-metre grid after the readable room-role points so
  // the seventh tavern NPC does not get pushed outside merely because the four
  // quadrants are already claimed.
  for (let x = building.x0 + 2; x <= building.x1 - 2; x += 2) {
    for (let z = building.z0 + 2; z <= building.z1 - 2; z += 2) {
      priority.push([x, z]);
    }
  }
  return priority;
}

function makeNpcAnchors(): HarthmereTownInteriorNpcAnchor[] {
  const anchors: HarthmereTownInteriorNpcAnchor[] = [];
  for (const plan of HARTHMERE_ADDITIVE_TOWN_INTERIOR_PLANS) {
    if (!plan.npcs?.length) continue;
    const building = BUILDING_BY_NAME.get(plan.buildingName);
    if (!building)
      throw new Error(`NPC plan references missing ${plan.buildingName}`);
    const claimedByFloor = new Map<number, Array<readonly [number, number]>>();
    for (const assignment of plan.npcs) {
      const floor = assignment.floor ?? 0;
      const fixtureObstacles = harthmereAdditiveTownInteriorFixturesForBuilding(
        building.name
      ).filter((fixture) => fixture.floor === floor && fixture.collidable);
      const claimed = claimedByFloor.get(floor) ?? [];
      const selected = npcCandidates(building).find(([x, z]) => {
        if (
          doorLaneContains(building, floor, x, z) ||
          stairKeepClearContains(building, x, z) ||
          partitionContains(building, x, z)
        ) {
          return false;
        }
        if (claimed.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 1.5)) {
          return false;
        }
        return !fixtureObstacles.some((fixture) =>
          aabbOverlaps(
            { x, z, size: [0.8, 1.8, 0.8] },
            {
              x: fixture.position[0],
              z: fixture.position[2],
              size: harthmereAdditiveTownInteriorFixtureClearanceSize(fixture),
            },
            0.35
          )
        );
      });
      if (!selected) {
        throw new Error(
          `${building.name}: no safe interior NPC point for offset ${assignment.offset}`
        );
      }
      claimed.push(selected);
      claimedByFloor.set(floor, claimed);
      anchors.push({
        offset: assignment.offset,
        role: assignment.role,
        buildingName: building.name,
        floor,
        position: [
          selected[0],
          HARTHMERE_ADDITIVE_TOWN_INTERIOR_GROUND_Y +
            floor * storyHeight(building),
          selected[1],
        ],
      });
    }
  }
  return anchors;
}

export const HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS: readonly HarthmereTownInteriorNpcAnchor[] =
  makeNpcAnchors();

const NPC_ANCHOR_BY_OFFSET = new Map(
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS.map((anchor) => [
    anchor.offset,
    anchor,
  ])
);

export function harthmereAdditiveTownInteriorNpcAnchor(offset: number) {
  return NPC_ANCHOR_BY_OFFSET.get(offset);
}

export function validateHarthmereAdditiveTownInteriors(): string[] {
  const problems: string[] = [];
  const plans = new Set(
    HARTHMERE_ADDITIVE_TOWN_INTERIOR_PLANS.map((plan) => plan.buildingName)
  );
  if (plans.size !== 57)
    problems.push(`expected 57 unique plans, found ${plans.size}`);
  for (const building of HARTHMERE_BUILDINGS) {
    const plan = PLAN_BY_BUILDING.get(building.name);
    if (!plan) {
      problems.push(`${building.name}:missing_plan`);
      continue;
    }
    const fixtures = harthmereAdditiveTownInteriorFixturesForBuilding(
      building.name
    );
    if (fixtures.length < 5) problems.push(`${building.name}:too_few_fixtures`);
    for (const fixture of fixtures) {
      for (const [x, z] of samplesForAabb(
        fixture.position[0],
        fixture.position[2],
        harthmereAdditiveTownInteriorFixtureClearanceSize(fixture)
      )) {
        if (
          x <= building.x0 ||
          x >= building.x1 ||
          z <= building.z0 ||
          z >= building.z1
        ) {
          problems.push(`${fixture.fixtureId}:outside_shell`);
        }
        if (doorLaneContains(building, fixture.floor, x, z)) {
          problems.push(`${fixture.fixtureId}:door_intrusion`);
        }
        if (stairKeepClearContains(building, x, z)) {
          problems.push(`${fixture.fixtureId}:stair_intrusion`);
        }
        if (partitionContains(building, x, z)) {
          problems.push(`${fixture.fixtureId}:partition_intrusion`);
        }
      }
    }
  }
  for (const anchor of HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS) {
    const building = BUILDING_BY_NAME.get(anchor.buildingName);
    if (!building) {
      problems.push(`npc_${anchor.offset}:missing_building`);
      continue;
    }
    const [x, , z] = anchor.position;
    if (
      x <= building.x0 ||
      x >= building.x1 ||
      z <= building.z0 ||
      z >= building.z1
    ) {
      problems.push(`npc_${anchor.offset}:outside_shell`);
    }
    if (
      harthmereAdditiveTownInteriorFixturesForBuilding(building.name).some(
        (fixture) =>
          fixture.floor === anchor.floor &&
          fixture.collidable &&
          aabbOverlaps(
            { x, z, size: [0.8, 1.8, 0.8] },
            {
              x: fixture.position[0],
              z: fixture.position[2],
              size: harthmereAdditiveTownInteriorFixtureClearanceSize(fixture),
            },
            0.35
          )
      )
    ) {
      problems.push(`npc_${anchor.offset}:fixture_overlap`);
    }
  }
  return problems;
}

const LEGACY_INTERIOR_ASSET_RE =
  /bed|chair|bench|table|counter|desk|shelf|bookcase|cabinet|wardrobe|chest|crate|box|barrel|keg|anvil|workbench|rack|cauldron|pulpit|candle|lantern|bucket|bag|rope|chain|scroll|book|bread|food/i;
const LEGACY_INTERIOR_LABEL_RE =
  /interior|inside|against (?:the )?wall|on (?:the )?floor|bedroom|pantry|kitchen|hearth|bunk|ledger|archive|treatment cot|dining table|service counter|repair bench|storage shelf|room bed/i;
const PROTECTED_GAMEPLAY_LABEL_RE =
  /quest|objective|interactable|marker|bellbinder|missing bell|voice handbell|trapdoor|tomb|dungeon|container reward/i;

const LEGACY_OWNER_TOKENS = [
  ...HARTHMERE_BUILDINGS.map((building) =>
    building.name.replace(/_/g, " ").toLowerCase()
  ),
  "dawn loaf",
  "brindle provision",
  "brass scale",
  "black anvil",
  "green mortar",
  "wyrm and candle",
  "copper kettle",
  "saint verena",
  "brother vance",
  "river dock supply",
  "dock warehouse",
  "mudden shelter",
  "mudden laundry",
  "mail post",
  "tailor loft",
  "tannery court",
  "dockside family",
] as const;

export function isHarthmereLegacyAdditiveTownInteriorPlacement(input: {
  asset?: string;
  name?: string;
  district?: string;
  kind?: string;
}) {
  if (input.kind === "actor") return false;
  const label = `${input.asset ?? ""} ${input.name ?? ""} ${
    input.district ?? ""
  }`.toLowerCase();
  if (label.includes(HARTHMERE_ADDITIVE_TOWN_INTERIORS_VERSION)) return false;
  if (PROTECTED_GAMEPLAY_LABEL_RE.test(label)) return false;
  if (
    !LEGACY_INTERIOR_ASSET_RE.test(label) ||
    !LEGACY_INTERIOR_LABEL_RE.test(label)
  ) {
    return false;
  }
  return LEGACY_OWNER_TOKENS.some((token) => label.includes(token));
}
