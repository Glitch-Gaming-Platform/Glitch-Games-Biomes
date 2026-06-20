import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_EXOTIC_MATTER_CAVES_VERSION =
  "harthmere-exotic-matter-caves" as const;
export const HARTHMERE_EXOTIC_MATTER_POWER_MW_PER_UNIT = 100_400;
export const HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS =
  6 * 60 * 60 * 1000;
export const HARTHMERE_EXOTIC_MATTER_ACCEPTED_JOB_DEPOSIT_COUNT = 5;
export const HARTHMERE_USER_CONFIRMED_EXOTIC_MATTER_CAVE_ANCHOR: Vec3 = [
  689.4810980055339,
  46,
  -89.5315360331334,
];
export const HARTHMERE_LIGHT_EXOTIC_MATTER_CAVE_ANCHOR: Vec3 = [
  609.375,
  33,
  -480.061,
];
export const HARTHMERE_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR: Vec3 = [
  722.441,
  -32,
  -369.337,
];
export const HARTHMERE_USER_CONFIRMED_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR: Vec3 =
  [939.9062759137818, -1, -298.56392097891904];
export const HARTHMERE_USER_CONFIRMED_FAR_HOLLOW_EXOTIC_MATTER_CAVE_ANCHOR: Vec3 =
  [972.1264198844514, 13, -673.9895505004225];
export const HARTHMERE_USER_CONFIRMED_HIGH_VAULT_EXOTIC_MATTER_CAVE_ANCHOR: Vec3 =
  [193.88611292790915, 102, 309.03182989715185];

export type HarthmereExoticMatterComponentId =
  | "antihydrogen"
  | "antihelium"
  | "antiboron";

export interface HarthmereExoticMatterComponent {
  componentId: HarthmereExoticMatterComponentId;
  itemId: string;
  displayName: string;
  shortName: string;
  jobTargetName: string;
  lore: string;
}

export const HARTHMERE_EXOTIC_MATTER_COMPONENTS = {
  antihydrogen: {
    componentId: "antihydrogen",
    itemId: "antihydrogen_block",
    displayName: "Antihydrogen Block",
    shortName: "Antihydrogen",
    jobTargetName: "Antihydrogen seam",
    lore: "A contained antimatter block made from antiprotons and positrons.",
  },
  antihelium: {
    componentId: "antihelium",
    itemId: "antihelium_block",
    displayName: "Antihelium Block",
    shortName: "Antihelium",
    jobTargetName: "Antihelium pocket",
    lore: "A contained antihelium block with antiprotons, antineutrons, and positrons.",
  },
  antiboron: {
    componentId: "antiboron",
    itemId: "antiboron_block",
    displayName: "Antiboron Block",
    shortName: "Antiboron",
    jobTargetName: "Antiboron vein",
    lore: "A rare contained antiboron block used in Raw Exotic Matter synthesis.",
  },
} satisfies Record<
  HarthmereExoticMatterComponentId,
  HarthmereExoticMatterComponent
>;

export const HARTHMERE_EXOTIC_MATTER_COMPONENT_IDS = Object.keys(
  HARTHMERE_EXOTIC_MATTER_COMPONENTS
) as HarthmereExoticMatterComponentId[];
export const HARTHMERE_EXOTIC_MATTER_MATERIAL_ITEM_IDS =
  HARTHMERE_EXOTIC_MATTER_COMPONENT_IDS.map(
    (componentId) => HARTHMERE_EXOTIC_MATTER_COMPONENTS[componentId].itemId
  );

export type HarthmereExoticMatterCaveId =
  | "old_well_descent_room"
  | "underways_north_south_tunnel"
  | "underways_east_west_tunnel"
  | "rat_crowns_den"
  | "smuggler_drain_vault"
  | "crypt_rest_room"
  | "mossglass_survey_cave"
  | "windowlight_little_cave"
  | "deep_spindle_massive_cave"
  | "harthmere_core_massive_cave"
  | "harthmere_far_hollow_massive_cave"
  | "harthmere_high_vault_massive_cave";

export interface HarthmereExoticMatterBounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export interface HarthmereExoticMatterCave {
  caveId: HarthmereExoticMatterCaveId;
  label: string;
  entranceLabel: string;
  entrancePosition: Vec3;
  bounds: HarthmereExoticMatterBounds;
  confirmedCave: true;
  terrainEvidence: string;
}

export const HARTHMERE_EXOTIC_MATTER_CAVES: readonly HarthmereExoticMatterCave[] =
  [
    {
      caveId: "old_well_descent_room",
      label: "Old Well Descent Room",
      entranceLabel: "Old Well",
      entrancePosition: [400, 53, -235],
      bounds: { x0: 394, x1: 408, y0: 46, y1: 51, z0: -242, z1: -228 },
      confirmedCave: true,
      terrainEvidence: "Server terrain carves the Old Well shaft and room below Harthmere.",
    },
    {
      caveId: "underways_north_south_tunnel",
      label: "North-South Underways",
      entranceLabel: "Underways Grate",
      entrancePosition: [402, 53, -236],
      bounds: { x0: 399, x1: 403, y0: 47, y1: 51, z0: -270, z1: -226 },
      confirmedCave: true,
      terrainEvidence: "Server terrain carves the long north-south Underways tunnel.",
    },
    {
      caveId: "underways_east_west_tunnel",
      label: "East-West Underways",
      entranceLabel: "Old Well Crossing",
      entrancePosition: [402, 53, -236],
      bounds: { x0: 399, x1: 446, y0: 47, y1: 51, z0: -238, z1: -234 },
      confirmedCave: true,
      terrainEvidence: "Server terrain carves the east-west Underways tunnel toward the Rat Crown den.",
    },
    {
      caveId: "rat_crowns_den",
      label: "Rat Crown's Den",
      entranceLabel: "Rat Crown Drain House",
      entrancePosition: [418, 53, -237],
      bounds: { x0: 424, x1: 446, y0: 46, y1: 51, z0: -246, z1: -228 },
      confirmedCave: true,
      terrainEvidence: "Server terrain carves the Rat Crown's underground den.",
    },
    {
      caveId: "smuggler_drain_vault",
      label: "Smuggler Drain Vault",
      entranceLabel: "Underways Drain",
      entrancePosition: [400, 53, -266],
      bounds: { x0: 388, x1: 408, y0: 46, y1: 51, z0: -276, z1: -260 },
      confirmedCave: true,
      terrainEvidence: "Server terrain carves the western drain vault off the Underways.",
    },
    {
      caveId: "crypt_rest_room",
      label: "Crypt Rest Room",
      entranceLabel: "Underways Crypt Bend",
      entrancePosition: [438, 53, -223],
      bounds: { x0: 430, x1: 450, y0: 46, y1: 51, z0: -226, z1: -210 },
      confirmedCave: true,
      terrainEvidence: "Server terrain carves the quiet crypt room past the east tunnel.",
    },
    {
      caveId: "mossglass_survey_cave",
      label: "Mossglass Survey Cave",
      entranceLabel: "Mossglass Survey Point",
      entrancePosition: [689.4810980055339, 46, -89.5315360331334],
      bounds: { x0: 684, x1: 696, y0: 46, y1: 49, z0: -96, z1: -84 },
      confirmedCave: true,
      terrainEvidence:
        "Live terrain was user-confirmed as cave space at x 689.481, y 46, z -89.532.",
    },
    {
      caveId: "windowlight_little_cave",
      label: "Windowlight Little Cave",
      entranceLabel: "Windowlight Cave Mouth",
      entrancePosition: [609.375, 33, -480.061],
      bounds: { x0: 604, x1: 615, y0: 31, y1: 35, z0: -486, z1: -474 },
      confirmedCave: true,
      terrainEvidence:
        "Live terrain was user-confirmed as cave space at x 609.375, y 33, z -480.061.",
    },
    {
      caveId: "deep_spindle_massive_cave",
      label: "Deep Spindle Massive Cave",
      entranceLabel: "Deep Spindle Descent",
      entrancePosition: [722.441, -32, -369.337],
      bounds: { x0: 706, x1: 742, y0: -36, y1: -26, z0: -389, z1: -349 },
      confirmedCave: true,
      terrainEvidence:
        "Live terrain was user-confirmed as a massive cave at x 722.441, y -32, z -369.337.",
    },
    {
      caveId: "harthmere_core_massive_cave",
      label: "Harthmere Core Massive Cave",
      entranceLabel: "Harthmere Core Descent",
      entrancePosition:
        HARTHMERE_USER_CONFIRMED_MASSIVE_EXOTIC_MATTER_CAVE_ANCHOR,
      bounds: { x0: 908, x1: 972, y0: -7, y1: 6, z0: -330, z1: -268 },
      confirmedCave: true,
      terrainEvidence:
        "Live terrain was user-confirmed as a massive cave system at x 939.906, y -1, z -298.564.",
    },
    {
      caveId: "harthmere_far_hollow_massive_cave",
      label: "Harthmere Far Hollow Massive Cave",
      entranceLabel: "Harthmere Far Hollow Descent",
      entrancePosition:
        HARTHMERE_USER_CONFIRMED_FAR_HOLLOW_EXOTIC_MATTER_CAVE_ANCHOR,
      bounds: { x0: 940, x1: 1004, y0: 7, y1: 20, z0: -706, z1: -642 },
      confirmedCave: true,
      terrainEvidence:
        "Live terrain was user-confirmed as a massive cave system at x 972.126, y 13, z -673.990.",
    },
    {
      caveId: "harthmere_high_vault_massive_cave",
      label: "Harthmere High Vault Massive Cave",
      entranceLabel: "Harthmere High Vault",
      entrancePosition:
        HARTHMERE_USER_CONFIRMED_HIGH_VAULT_EXOTIC_MATTER_CAVE_ANCHOR,
      bounds: { x0: 162, x1: 226, y0: 96, y1: 109, z0: 277, z1: 341 },
      confirmedCave: true,
      terrainEvidence:
        "Live terrain was user-confirmed as a massive high cave system at x 193.886, y 102, z 309.032.",
    },
  ];

export interface HarthmereExoticMatterDeposit {
  depositId: string;
  caveId: HarthmereExoticMatterCaveId;
  componentId: HarthmereExoticMatterComponentId;
  label: string;
  position: Vec3;
  terrainPosition?: Vec3;
  jobEligible: boolean;
  clusterRadius: number;
}

const deposit = (
  caveId: HarthmereExoticMatterCaveId,
  componentId: HarthmereExoticMatterComponentId,
  suffix: string,
  label: string,
  position: Vec3,
  terrainPosition?: Vec3,
  jobEligible = true
): HarthmereExoticMatterDeposit => ({
  depositId: `exotic_${componentId}_${suffix}`,
  caveId,
  componentId,
  label,
  position,
  terrainPosition,
  jobEligible,
  clusterRadius: 1,
});

const shiftedWorldDeposit = (
  caveId: HarthmereExoticMatterCaveId,
  componentId: HarthmereExoticMatterComponentId,
  suffix: string,
  label: string,
  position: Vec3,
  jobEligible = true
) =>
  deposit(
    caveId,
    componentId,
    suffix,
    label,
    position,
    [position[0] - 512, position[1], position[2]],
    jobEligible
  );

const mossglassSurveyDeposit = (
  componentId: HarthmereExoticMatterComponentId,
  suffix: string,
  label: string,
  position: Vec3
) =>
  shiftedWorldDeposit(
    "mossglass_survey_cave",
    componentId,
    suffix,
    label,
    position
  );

const windowlightDeposit = (
  componentId: HarthmereExoticMatterComponentId,
  suffix: string,
  label: string,
  position: Vec3
) =>
  shiftedWorldDeposit(
    "windowlight_little_cave",
    componentId,
    suffix,
    label,
    position,
    false
  );

const deepSpindleDeposit = (
  componentId: HarthmereExoticMatterComponentId,
  suffix: string,
  label: string,
  position: Vec3
) =>
  shiftedWorldDeposit(
    "deep_spindle_massive_cave",
    componentId,
    suffix,
    label,
    position
  );

const massiveCaveGridDeposit = (
  caveId: HarthmereExoticMatterCaveId,
  componentId: HarthmereExoticMatterComponentId,
  suffix: string,
  label: string,
  position: Vec3
) =>
  shiftedWorldDeposit(
    caveId,
    componentId,
    suffix,
    label,
    position
  );

const massiveCaveGridDeposits = (input: {
  caveId: HarthmereExoticMatterCaveId;
  suffixPrefix: string;
  labelPrefix: string;
  origin: Vec3;
  minY: number;
}): HarthmereExoticMatterDeposit[] => {
  const xOffsets = [-28, -21, -14, -7, 0, 7, 14, 21, 28];
  const zOffsets = [-28, -21, -14, -7, 0, 7, 14, 21, 28];
  const componentIds = [
    "antihydrogen",
    "antihelium",
    "antiboron",
  ] as const;
  const labelNouns = {
    antihydrogen: "Spark",
    antihelium: "Pocket",
    antiboron: "Vein",
  } satisfies Record<HarthmereExoticMatterComponentId, string>;
  const deposits: HarthmereExoticMatterDeposit[] = [];

  for (let zIndex = 0; zIndex < zOffsets.length; zIndex += 1) {
    for (let xIndex = 0; xIndex < xOffsets.length; xIndex += 1) {
      const ordinal = deposits.length + 1;
      const componentId =
        componentIds[(xIndex + zIndex + 1) % componentIds.length];
      const isAnchorDeposit = xOffsets[xIndex] === 0 && zOffsets[zIndex] === 0;
      deposits.push(
        massiveCaveGridDeposit(
          input.caveId,
          componentId,
          `${input.suffixPrefix}_${String(ordinal).padStart(2, "0")}`,
          `${HARTHMERE_EXOTIC_MATTER_COMPONENTS[componentId].shortName} ${input.labelPrefix} ${labelNouns[componentId]}`,
          [
            input.origin[0] + xOffsets[xIndex],
            isAnchorDeposit
              ? input.origin[1]
              : input.minY + ((xIndex * 2 + zIndex * 3) % 12),
            input.origin[2] + zOffsets[zIndex],
          ]
        )
      );
    }
  }

  return deposits;
};

const harthmereCoreMassiveDeposits = (): HarthmereExoticMatterDeposit[] =>
  massiveCaveGridDeposits({
    caveId: "harthmere_core_massive_cave",
    suffixPrefix: "harthmere_core",
    labelPrefix: "Harthmere Core",
    origin: [940, -1, -299],
    minY: -6,
  });

const harthmereFarHollowMassiveDeposits =
  (): HarthmereExoticMatterDeposit[] =>
    massiveCaveGridDeposits({
      caveId: "harthmere_far_hollow_massive_cave",
      suffixPrefix: "harthmere_far_hollow",
      labelPrefix: "Harthmere Far Hollow",
      origin: [972, 13, -674],
      minY: 8,
    });

const harthmereHighVaultMassiveDeposits =
  (): HarthmereExoticMatterDeposit[] =>
    massiveCaveGridDeposits({
      caveId: "harthmere_high_vault_massive_cave",
      suffixPrefix: "harthmere_high_vault",
      labelPrefix: "Harthmere High Vault",
      origin: [194, 102, 309],
      minY: 97,
    });

export const HARTHMERE_EXOTIC_MATTER_DEPOSITS: readonly HarthmereExoticMatterDeposit[] =
  [
    deposit("old_well_descent_room", "antihydrogen", "old_well_01", "Antihydrogen Float-Seam", [396, 48, -240]),
    deposit("old_well_descent_room", "antihelium", "old_well_02", "Antihelium Bright Pocket", [398, 49, -237]),
    deposit("old_well_descent_room", "antiboron", "old_well_03", "Antiboron Blackglass Vein", [402, 48, -234]),
    deposit("old_well_descent_room", "antihydrogen", "old_well_04", "Antihydrogen Well Spark", [405, 48, -231]),
    deposit("old_well_descent_room", "antihelium", "old_well_05", "Antihelium Well Bloom", [406, 49, -230]),

    deposit("underways_north_south_tunnel", "antiboron", "north_underways_01", "Antiboron Drain Vein", [400, 48, -266]),
    deposit("underways_north_south_tunnel", "antihydrogen", "north_underways_02", "Antihydrogen Pipe Spark", [401, 48, -260]),
    deposit("underways_north_south_tunnel", "antihelium", "north_underways_03", "Antihelium Tunnel Pocket", [402, 49, -254]),
    deposit("underways_north_south_tunnel", "antiboron", "north_underways_04", "Antiboron Slate Vein", [400, 48, -248]),
    deposit("underways_north_south_tunnel", "antihydrogen", "north_underways_05", "Antihydrogen Grate Spark", [402, 49, -232]),

    deposit("underways_east_west_tunnel", "antihelium", "east_underways_01", "Antihelium Cross-Tunnel Pocket", [406, 48, -236]),
    deposit("underways_east_west_tunnel", "antiboron", "east_underways_02", "Antiboron Rail Vein", [414, 49, -237]),
    deposit("underways_east_west_tunnel", "antihydrogen", "east_underways_03", "Antihydrogen Blue Seam", [422, 48, -236]),
    deposit("underways_east_west_tunnel", "antihelium", "east_underways_04", "Antihelium Wall Bloom", [432, 49, -235]),
    deposit("underways_east_west_tunnel", "antiboron", "east_underways_05", "Antiboron East Vein", [442, 48, -237]),

    deposit("rat_crowns_den", "antihydrogen", "rat_den_01", "Antihydrogen Crown Shard", [426, 48, -244]),
    deposit("rat_crowns_den", "antihelium", "rat_den_02", "Antihelium Den Pocket", [431, 49, -241]),
    deposit("rat_crowns_den", "antiboron", "rat_den_03", "Antiboron Crown Vein", [436, 48, -238]),
    deposit("rat_crowns_den", "antihelium", "rat_den_04", "Antihelium Nest Bloom", [441, 49, -234]),
    deposit("rat_crowns_den", "antihydrogen", "rat_den_05", "Antihydrogen Tail Spark", [444, 48, -230]),

    deposit("smuggler_drain_vault", "antiboron", "drain_vault_01", "Antiboron Smuggler Vein", [390, 47, -274]),
    deposit("smuggler_drain_vault", "antihydrogen", "drain_vault_02", "Antihydrogen Drain Spark", [394, 48, -270]),
    deposit("smuggler_drain_vault", "antihelium", "drain_vault_03", "Antihelium Vault Pocket", [398, 49, -266]),
    deposit("smuggler_drain_vault", "antiboron", "drain_vault_04", "Antiboron Filter Vein", [402, 48, -263]),
    deposit("smuggler_drain_vault", "antihelium", "drain_vault_05", "Antihelium Drain Bloom", [406, 47, -262]),

    deposit("crypt_rest_room", "antihydrogen", "crypt_01", "Antihydrogen Crypt Spark", [432, 48, -224]),
    deposit("crypt_rest_room", "antihelium", "crypt_02", "Antihelium Quiet Pocket", [436, 49, -221]),
    deposit("crypt_rest_room", "antiboron", "crypt_03", "Antiboron Rest Vein", [440, 48, -218]),
    deposit("crypt_rest_room", "antihydrogen", "crypt_04", "Antihydrogen Chapel Glint", [444, 49, -215]),
    deposit("crypt_rest_room", "antiboron", "crypt_05", "Antiboron Crypt Glass", [448, 48, -212]),

    mossglassSurveyDeposit("antihelium", "mossglass_survey_01", "Antihelium Mossglass Pocket", [686, 46, -94]),
    mossglassSurveyDeposit("antihydrogen", "mossglass_survey_02", "Antihydrogen Survey Spark", [690, 47, -94]),
    mossglassSurveyDeposit("antiboron", "mossglass_survey_03", "Antiboron Mossglass Vein", [694, 46, -94]),
    mossglassSurveyDeposit("antihydrogen", "mossglass_survey_04", "Antihydrogen Cave Glow", [686, 48, -90]),
    mossglassSurveyDeposit("antihelium", "mossglass_survey_05", "Antihelium Anchor Pocket", [690, 46, -90]),
    mossglassSurveyDeposit("antiboron", "mossglass_survey_06", "Antiboron Anchor Vein", [694, 48, -90]),
    mossglassSurveyDeposit("antiboron", "mossglass_survey_07", "Antiboron Low Seam", [686, 46, -86]),
    mossglassSurveyDeposit("antihydrogen", "mossglass_survey_08", "Antihydrogen Backwall Spark", [690, 48, -86]),
    mossglassSurveyDeposit("antihelium", "mossglass_survey_09", "Antihelium Backwall Bloom", [694, 46, -86]),

    windowlightDeposit("antihelium", "windowlight_01", "Antihelium Windowlight Pocket", [607, 33, -483]),
    windowlightDeposit("antihydrogen", "windowlight_02", "Antihydrogen Windowlight Spark", [609, 33, -480]),
    windowlightDeposit("antiboron", "windowlight_03", "Antiboron Windowlight Vein", [612, 33, -478]),
    windowlightDeposit("antihelium", "windowlight_04", "Antihelium Quiet Glint", [606, 32, -477]),

    deepSpindleDeposit("antihydrogen", "deep_spindle_01", "Antihydrogen Deep Spindle Spark", [710, -34, -385]),
    deepSpindleDeposit("antihelium", "deep_spindle_02", "Antihelium Deep Spindle Pocket", [714, -33, -384]),
    deepSpindleDeposit("antiboron", "deep_spindle_03", "Antiboron Deep Spindle Vein", [718, -32, -385]),
    deepSpindleDeposit("antihydrogen", "deep_spindle_04", "Antihydrogen Lower Blue Seam", [724, -35, -384]),
    deepSpindleDeposit("antihelium", "deep_spindle_05", "Antihelium Vault Bloom", [732, -31, -384]),
    deepSpindleDeposit("antiboron", "deep_spindle_06", "Antiboron Blackglass Shelf", [738, -33, -383]),
    deepSpindleDeposit("antihelium", "deep_spindle_07", "Antihelium Spindle North Pocket", [708, -30, -378]),
    deepSpindleDeposit("antiboron", "deep_spindle_08", "Antiboron Spindle North Vein", [714, -28, -377]),
    deepSpindleDeposit("antihydrogen", "deep_spindle_09", "Antihydrogen Hanging Spark", [720, -32, -377]),
    deepSpindleDeposit("antihelium", "deep_spindle_10", "Antihelium Bright Shelf", [728, -34, -376]),
    deepSpindleDeposit("antiboron", "deep_spindle_11", "Antiboron Deep Wall", [736, -29, -377]),
    deepSpindleDeposit("antihydrogen", "deep_spindle_12", "Antihydrogen Spindle Mid-Seam", [740, -32, -376]),
    deepSpindleDeposit("antiboron", "deep_spindle_13", "Antiboron Central Vein", [710, -33, -369]),
    deepSpindleDeposit("antihydrogen", "deep_spindle_14", "Antihydrogen Central Spark", [716, -31, -369]),
    deepSpindleDeposit("antihelium", "deep_spindle_15", "Antihelium Central Pocket", [722, -32, -369]),
    deepSpindleDeposit("antiboron", "deep_spindle_16", "Antiboron Massive Rib", [728, -35, -369]),
    deepSpindleDeposit("antihydrogen", "deep_spindle_17", "Antihydrogen Massive Blue Rib", [734, -29, -368]),
    deepSpindleDeposit("antihelium", "deep_spindle_18", "Antihelium Massive Bloom", [740, -33, -368]),
    deepSpindleDeposit("antihelium", "deep_spindle_19", "Antihelium South Pocket", [708, -35, -358]),
    deepSpindleDeposit("antiboron", "deep_spindle_20", "Antiboron South Wall", [714, -32, -357]),
    deepSpindleDeposit("antihydrogen", "deep_spindle_21", "Antihydrogen South Spark", [720, -30, -356]),
    deepSpindleDeposit("antihelium", "deep_spindle_22", "Antihelium Far Bloom", [728, -34, -355]),
    deepSpindleDeposit("antiboron", "deep_spindle_23", "Antiboron Far Vein", [736, -31, -356]),
    deepSpindleDeposit("antihydrogen", "deep_spindle_24", "Antihydrogen Far Blue Seam", [740, -33, -354]),

    ...harthmereCoreMassiveDeposits(),
    ...harthmereFarHollowMassiveDeposits(),
    ...harthmereHighVaultMassiveDeposits(),
  ];

export interface HarthmereExoticMatterQuestMarker {
  markerId: string;
  label: string;
  position: Vec3;
  depositId: string;
  caveId: HarthmereExoticMatterCaveId;
  componentId: HarthmereExoticMatterComponentId;
}

export function harthmereExoticMatterCaveById(
  caveId: string | undefined
) {
  return HARTHMERE_EXOTIC_MATTER_CAVES.find(
    (cave) => cave.caveId === caveId
  );
}

export function harthmereExoticMatterDepositById(
  depositId: string | undefined
) {
  return HARTHMERE_EXOTIC_MATTER_DEPOSITS.find(
    (deposit) => deposit.depositId === depositId
  );
}

export function harthmereExoticMatterDepositsForCave(
  caveId: HarthmereExoticMatterCaveId
) {
  return HARTHMERE_EXOTIC_MATTER_DEPOSITS.filter(
    (deposit) => deposit.caveId === caveId
  );
}

export function harthmereExoticMatterJobEligibleDeposits() {
  return HARTHMERE_EXOTIC_MATTER_DEPOSITS.filter(
    (deposit) => deposit.jobEligible
  );
}

export function isHarthmereExoticMatterMaterialItemId(
  itemId: string | undefined
): boolean {
  return Boolean(
    itemId && HARTHMERE_EXOTIC_MATTER_MATERIAL_ITEM_IDS.includes(itemId)
  );
}

export function harthmereExoticMatterComponentForItemId(
  itemId: string | undefined
) {
  return HARTHMERE_EXOTIC_MATTER_COMPONENT_IDS.find(
    (componentId) =>
      HARTHMERE_EXOTIC_MATTER_COMPONENTS[componentId].itemId === itemId
  );
}

export function harthmereExoticMatterDepositQuestMarkers(): readonly HarthmereExoticMatterQuestMarker[] {
  return HARTHMERE_EXOTIC_MATTER_DEPOSITS.map((deposit) => ({
    markerId: deposit.depositId,
    label: deposit.label,
    position: [...deposit.position] as Vec3,
    depositId: deposit.depositId,
    caveId: deposit.caveId,
    componentId: deposit.componentId,
  }));
}

export function harthmereExoticMatterDepositAtBlock(input: {
  x: number;
  y: number;
  z: number;
}) {
  const x = Math.trunc(input.x);
  const y = Math.trunc(input.y);
  const z = Math.trunc(input.z);
  for (const deposit of HARTHMERE_EXOTIC_MATTER_DEPOSITS) {
    for (const position of [
      deposit.position,
      deposit.terrainPosition,
    ].filter((value): value is Vec3 => Boolean(value))) {
      const [dx, dy, dz] = position.map((value) =>
        Math.trunc(value)
      ) as Vec3;
      const distance =
        Math.abs(x - dx) + Math.abs(y - dy) + Math.abs(z - dz);
      if (distance <= deposit.clusterRadius + 1) {
        return deposit;
      }
    }
  }
  return undefined;
}

export interface HarthmereExoticMatterDepositAvailability {
  depositId: string;
  componentId: HarthmereExoticMatterComponentId;
  itemId: string;
  available: boolean;
  minedAtMs?: number;
  replenishesAtMs?: number;
}

export type HarthmereExoticMatterDepositState = Record<
  string,
  HarthmereExoticMatterDepositAvailability
>;

export function defaultHarthmereExoticMatterDepositState(): HarthmereExoticMatterDepositState {
  const state: HarthmereExoticMatterDepositState = {};
  for (const deposit of HARTHMERE_EXOTIC_MATTER_DEPOSITS) {
    const component = HARTHMERE_EXOTIC_MATTER_COMPONENTS[deposit.componentId];
    state[deposit.depositId] = {
      depositId: deposit.depositId,
      componentId: deposit.componentId,
      itemId: component.itemId,
      available: true,
    };
  }
  return state;
}

function normalizeDepositState(
  state: HarthmereExoticMatterDepositState
) {
  const next = defaultHarthmereExoticMatterDepositState();
  for (const [depositId, entry] of Object.entries(state)) {
    if (!next[depositId]) continue;
    next[depositId] = {
      ...next[depositId],
      ...entry,
      depositId,
      available: entry.available !== false,
    };
  }
  return next;
}

export function replenishHarthmereExoticMatterDeposits(input: {
  state: HarthmereExoticMatterDepositState;
  nowMs: number;
}) {
  const nowMs = Math.max(0, Math.trunc(input.nowMs));
  const next = normalizeDepositState(input.state);
  for (const entry of Object.values(next)) {
    // A depleted entry recovers only once its replenish timer is due. Entries that are
    // available:false WITHOUT a timer are an intentionally-preserved saved-depleted state
    // (normal mining always stamps replenishesAtMs), so they are left untouched here.
    if (
      entry.available === false &&
      typeof entry.replenishesAtMs === "number" &&
      entry.replenishesAtMs <= nowMs
    ) {
      entry.available = true;
      delete entry.minedAtMs;
      delete entry.replenishesAtMs;
    }
  }
  return next;
}

export function mineHarthmereExoticMatterDeposit(input: {
  state: HarthmereExoticMatterDepositState;
  depositId: string;
  nowMs: number;
}) {
  const nowMs = Math.max(0, Math.trunc(input.nowMs));
  const deposit = harthmereExoticMatterDepositById(input.depositId);
  const next = replenishHarthmereExoticMatterDeposits({
    state: input.state,
    nowMs,
  });
  const inventoryItemDeltas: Record<string, number> = {};
  const warnings: string[] = [];

  if (!deposit) {
    warnings.push("exotic_matter_rejected:unknown_deposit");
    return { deposits: next, inventoryItemDeltas, warnings };
  }

  const entry = next[deposit.depositId];
  if (!entry.available) {
    warnings.push("exotic_matter_rejected:deposit_replenishing");
    return { deposits: next, inventoryItemDeltas, warnings };
  }

  entry.available = false;
  entry.minedAtMs = nowMs;
  entry.replenishesAtMs =
    nowMs + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS;
  inventoryItemDeltas[entry.itemId] = 1;
  return {
    deposits: next,
    inventoryItemDeltas,
    warnings,
    minedDeposit: deposit,
  };
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRng(seed: number) {
  let state = seed || 0x9e3779b9;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function harthmereExoticMatterAcceptedJobDepositMarkers(input: {
  jobId: string;
  todoId: string;
  itemId?: string;
  count?: number;
  targetCaveId?: HarthmereExoticMatterCaveId;
}): readonly HarthmereExoticMatterQuestMarker[] {
  const componentId = harthmereExoticMatterComponentForItemId(input.itemId);
  const allCandidates = harthmereExoticMatterJobEligibleDeposits().filter(
    (deposit) => !componentId || deposit.componentId === componentId
  );
  const caveCandidates = input.targetCaveId
    ? allCandidates.filter((deposit) => deposit.caveId === input.targetCaveId)
    : [];
  const candidates = caveCandidates.length > 0 ? caveCandidates : allCandidates;
  const requestedCount = Math.trunc(
    Number(input.count ?? HARTHMERE_EXOTIC_MATTER_ACCEPTED_JOB_DEPOSIT_COUNT)
  );
  const safeCount = Number.isFinite(requestedCount)
    ? requestedCount
    : HARTHMERE_EXOTIC_MATTER_ACCEPTED_JOB_DEPOSIT_COUNT;
  const targetCount = Math.max(
    1,
    Math.min(
      candidates.length,
      safeCount
    )
  );
  const rng = seededRng(hashString(`${input.jobId}:${input.todoId}:${input.itemId ?? "all"}`));
  const pool = [...candidates];
  const selected: HarthmereExoticMatterDeposit[] = [];
  while (selected.length < targetCount && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected.map((deposit) => {
    const component = HARTHMERE_EXOTIC_MATTER_COMPONENTS[deposit.componentId];
    return {
      markerId: `fresh_${input.todoId}_${deposit.depositId}`,
      label: `Fresh ${component.shortName} Deposit`,
      position: [...deposit.position] as Vec3,
      depositId: deposit.depositId,
      caveId: deposit.caveId,
      componentId: deposit.componentId,
    };
  });
}
