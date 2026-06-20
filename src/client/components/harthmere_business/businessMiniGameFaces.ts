import { BikkieIds } from "@/shared/bikkie/ids";
import type { Appearance, ItemAssignment } from "@/shared/ecs/gen/types";
import { anItem } from "@/shared/game/item";
import type { HarthmereBusinessCustomerAppearance } from "@/shared/harthmere/business_customer_simulator";
import type { BiomesId } from "@/shared/ids";

export function harthmereBusinessCustomerFaceSeed(input: {
  npcId?: string;
  displayName?: string;
}): number {
  const identity = `${input.npcId ?? ""}:${input.displayName ?? ""}`;
  let seed = 2166136261;
  for (let i = 0; i < identity.length; i++) {
    seed ^= identity.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

const CUSTOMER_AVATAR_HAIR_IDS = [
  1534621126189652, 1534621126189649, 4537020877769664, 1534621126189628,
  4537020877769985, 7539420629350273, 1534621126189616, 7539420629350306,
  1534621126189781,
] as unknown as readonly BiomesId[];

function pickStable<T>(values: readonly T[], seed: number, salt: number): T {
  return values[Math.abs(Math.trunc(seed + salt * 2654435761)) % values.length];
}

function normalizedAppearanceText(
  appearance: HarthmereBusinessCustomerAppearance | undefined,
  field: keyof HarthmereBusinessCustomerAppearance
) {
  return String(appearance?.[field] ?? "").toLowerCase();
}

function skinPaletteIdForCustomer(
  appearance: HarthmereBusinessCustomerAppearance | undefined,
  seed: number
) {
  const text = normalizedAppearanceText(appearance, "skinTone");
  if (/ebony|deep|dark|umber|neutral/.test(text)) {
    return pickStable(
      ["skin_color_4", "skin_color_5", "skin_color_14"],
      seed,
      1
    );
  }
  if (/brown|bronze|copper|clay/.test(text)) {
    return pickStable(
      ["skin_color_3", "skin_color_4", "skin_color_9"],
      seed,
      2
    );
  }
  if (/tan|olive|gold|beige|tawny|sand/.test(text)) {
    return pickStable(
      ["skin_color_2", "skin_color_3", "skin_color_12"],
      seed,
      3
    );
  }
  if (/pale|light|ivory|peach/.test(text)) {
    return pickStable(
      ["skin_color_1", "skin_color_2", "skin_color_12"],
      seed,
      4
    );
  }
  return pickStable(
    [
      "skin_color_1",
      "skin_color_2",
      "skin_color_3",
      "skin_color_4",
      "skin_color_5",
    ],
    seed,
    5
  );
}

function eyePaletteIdForCustomer(
  appearance: HarthmereBusinessCustomerAppearance | undefined,
  seed: number
) {
  const text = normalizedAppearanceText(appearance, "eyeColor");
  if (/black|pearl/.test(text)) return "eye_color_17";
  if (/brown|honey/.test(text))
    return pickStable(["eye_color_0", "eye_color_1"], seed, 6);
  if (/hazel|amber|gold|ocher|rust/.test(text)) {
    return pickStable(["eye_color_2", "eye_color_3", "eye_color_4"], seed, 7);
  }
  if (/green|jade|fern|mint|pine/.test(text)) {
    return pickStable(["eye_color_7", "eye_color_8"], seed, 8);
  }
  if (/blue|sea|steel|electric/.test(text)) {
    return pickStable(
      ["eye_color_9", "eye_color_10", "eye_color_11"],
      seed,
      9
    );
  }
  if (/gray|storm|silver/.test(text)) return "eye_color_5";
  if (/violet|lilac/.test(text)) {
    return pickStable(
      ["eye_color_11", "eye_color_12", "eye_color_13"],
      seed,
      10
    );
  }
  return pickStable(
    ["eye_color_0", "eye_color_5", "eye_color_7", "eye_color_10"],
    seed,
    11
  );
}

function hairPaletteIdForCustomer(
  appearance: HarthmereBusinessCustomerAppearance | undefined,
  seed: number
) {
  const text = normalizedAppearanceText(appearance, "hairColor");
  if (/black|charcoal|matte/.test(text)) return "hair_color_6";
  if (/white|platinum|silver|moon/.test(text)) return "hair_color_4";
  if (/gray|grey|ash|salt|iron/.test(text)) return "hair_color_5";
  if (/green|moss|kelp/.test(text))
    return pickStable(["hair_color_1", "hair_color_17"], seed, 12);
  if (/blue|teal|prism/.test(text))
    return pickStable(["hair_color_3", "hair_color_16"], seed, 13);
  if (/purple|violet/.test(text)) return "hair_color_2";
  if (/red|rust|auburn|copper|cherry/.test(text)) {
    return pickStable(
      ["hair_color_7", "hair_color_13", "hair_color_14", "hair_color_15"],
      seed,
      14
    );
  }
  if (/blond|blonde|yellow|honey|dust/.test(text)) {
    return pickStable(["hair_color_10", "hair_color_11"], seed, 15);
  }
  if (/brown|chestnut|mud/.test(text)) {
    return pickStable(
      ["hair_color_8", "hair_color_9", "hair_color_12"],
      seed,
      16
    );
  }
  return pickStable(
    [
      "hair_color_6",
      "hair_color_8",
      "hair_color_9",
      "hair_color_10",
      "hair_color_13",
    ],
    seed,
    17
  );
}

function hairWearableIdForCustomer(
  appearance: HarthmereBusinessCustomerAppearance | undefined,
  seed: number
) {
  const styleSeed = harthmereBusinessCustomerFaceSeed({
    npcId: normalizedAppearanceText(appearance, "hairStyle"),
    displayName: normalizedAppearanceText(appearance, "bodyBuild"),
  });
  return pickStable(CUSTOMER_AVATAR_HAIR_IDS, seed ^ styleSeed, 18);
}

export interface HarthmereBusinessCustomerPlayerMeshAvatar {
  seed: number;
  appearance: Appearance;
  wearableOverrides: ItemAssignment;
  meshVersionKey: string;
}

export function harthmereBusinessCustomerPlayerMeshAvatar(input: {
  npcId?: string;
  displayName?: string;
  appearance?: HarthmereBusinessCustomerAppearance;
}): HarthmereBusinessCustomerPlayerMeshAvatar {
  const seed = harthmereBusinessCustomerFaceSeed(input);
  const hairItem = anItem(hairWearableIdForCustomer(input.appearance, seed));
  const wearableOverrides: ItemAssignment = new Map([
    [BikkieIds.hair, hairItem],
  ]);
  return {
    seed,
    appearance: {
      skin_color_id: skinPaletteIdForCustomer(input.appearance, seed),
      eye_color_id: eyePaletteIdForCustomer(input.appearance, seed),
      hair_color_id: hairPaletteIdForCustomer(input.appearance, seed),
      head_id: BikkieIds.androgenous,
    },
    wearableOverrides,
    meshVersionKey: `business-customer-player-mesh-avatar:${seed}`,
  };
}
