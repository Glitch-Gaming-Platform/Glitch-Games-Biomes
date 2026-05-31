import type {
  HarthmereBusinessCustomerNpcV1,
  HarthmereBusinessOutpostV1,
} from "./business_customer_simulator_v1";
import type { HarthmereEconomyBusinessTypeIdV1 } from "./mmo_economy_authority_v1";
import {
  HARTHMERE_ARM_LENGTHS,
  HARTHMERE_BODY_STANCES,
  HARTHMERE_BODY_HEIGHTS,
  HARTHMERE_BODY_TYPES,
  HARTHMERE_BROW_STYLES,
  HARTHMERE_CHEEK_STYLES,
  HARTHMERE_EYE_COLORS,
  HARTHMERE_EYE_SHAPES,
  HARTHMERE_FACE_ACCESSORIES,
  HARTHMERE_FACE_SHAPES,
  HARTHMERE_FACIAL_HAIR_STYLES,
  HARTHMERE_HAIR_COLORS,
  HARTHMERE_HAIR_STYLES,
  HARTHMERE_LEG_LENGTHS,
  HARTHMERE_MOUTH_STYLES,
  HARTHMERE_NOSE_STYLES,
  HARTHMERE_OUTFIT_COLORS,
  HARTHMERE_SKIN_TONES,
  HARTHMERE_SHOULDER_WIDTHS,
  harthmereThreeJsClothingItem,
  makeHarthmereNpcAppearanceConfig,
  normalizeHarthmereCharacterAppearance,
  type HarthmereCharacterAppearance,
  type HarthmereCharacterClothing,
  type HarthmereCharacterRole,
} from "./voxel_faces";

export const HARTHMERE_BUSINESS_NPC_GROVE_COSMETIC_VERSION_V1 =
  "grove-business-npc-cosmetics-v1" as const;

function businessTypeTextV1(
  typeId: HarthmereEconomyBusinessTypeIdV1 | string,
) {
  return String(typeId).replace(/_/g, " ");
}

function businessTypesTextV1(types: readonly HarthmereEconomyBusinessTypeIdV1[]) {
  return types.map(businessTypeTextV1).join(" ");
}

function stableHashV1(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFromTextV1<T>(items: readonly T[], text: string, salt: string): T {
  return items[stableHashV1(`${text}:${salt}`) % items.length];
}

function roleForBusinessTextV1(text: string): HarthmereCharacterRole {
  if (/security|defense|guard/.test(text)) return "guard";
  if (/hunter|exploration|wild meat|trail/.test(text)) return "hunter";
  if (/medical|doctor|magic/.test(text)) {
    return "clergy";
  }
  if (/farming|food|restaurant|repair|maintenance|waste|sanitation|refinery|exotic|weapon|tool|biome maintenance/.test(text)) {
    return "farmer";
  }
  return "merchant";
}

export function harthmereBusinessOutpostStaffAssetV1(
  outpost: HarthmereBusinessOutpostV1,
) {
  const businessType = outpost.businessType;
  if (/security/.test(businessType)) return "townsperson_guard";
  if (/courier|portal|teleport/.test(businessType)) return "townsperson_courier";
  if (/medical|magic/.test(businessType)) return "townsperson_clergy";
  if (/hunter|exploration/.test(businessType)) return "townsperson_hunter";
  if (/farming|food/.test(businessType)) return "townsperson_farmer";
  if (/waste|sanitation|repair|maintenance|refinery|weapons|tools|biome_maintenance/.test(businessType)) return "townsperson_dockhand";
  return "townsperson_market";
}

export function harthmereBusinessOutpostStaffRoleV1(
  outpost: HarthmereBusinessOutpostV1,
): HarthmereCharacterRole {
  return roleForBusinessTextV1(businessTypeTextV1(outpost.businessType));
}

export function harthmereBusinessOutpostStaffSeedV1(
  outpost: HarthmereBusinessOutpostV1,
) {
  let hash = 17;
  for (const char of `${outpost.outpostId}:${outpost.ownerNpcId}:${outpost.businessType}`) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return 9300000 + (hash % 500000);
}

function groveBusinessRoleClothingV1(
  role: HarthmereCharacterRole,
  text: string,
): HarthmereCharacterClothing {
  if (role === "guard") {
    return {
      head: harthmereThreeJsClothingItem("militia_halfhelm"),
      torso: harthmereThreeJsClothingItem("guard_tabard_armor"),
      legs: harthmereThreeJsClothingItem("guard_greaves"),
      feet: harthmereThreeJsClothingItem("guard_boots"),
      hands: harthmereThreeJsClothingItem("guard_gloves"),
      belt: harthmereThreeJsClothingItem("simple_belt"),
      back: harthmereThreeJsClothingItem("short_cape"),
      weapon: harthmereThreeJsClothingItem("sword_1handed"),
      shield: harthmereThreeJsClothingItem("shield_round"),
    };
  }
  if (role === "clergy") {
    return {
      head: harthmereThreeJsClothingItem(/doctor|medical|clinic|repair|refinery/.test(text) ? "noble_cap" : "mage_hood"),
      torso: harthmereThreeJsClothingItem(/doctor|medical|clinic/.test(text) ? "field_medic_coat" : "scholar_robe"),
      legs: harthmereThreeJsClothingItem("robe_skirt"),
      feet: harthmereThreeJsClothingItem("soft_shoes"),
      hands: harthmereThreeJsClothingItem("cloth_wraps"),
      belt: harthmereThreeJsClothingItem("simple_belt"),
      back: harthmereThreeJsClothingItem("short_cape"),
    };
  }
  if (role === "hunter") {
    return {
      head: harthmereThreeJsClothingItem("hunter_cap"),
      torso: harthmereThreeJsClothingItem("hunter_jerkin"),
      legs: harthmereThreeJsClothingItem("forest_trousers"),
      feet: harthmereThreeJsClothingItem("travel_boots"),
      hands: harthmereThreeJsClothingItem("fingerless_gloves"),
      belt: harthmereThreeJsClothingItem("rope_belt"),
      back: harthmereThreeJsClothingItem("quiver_and_bedroll"),
      weapon: harthmereThreeJsClothingItem("bow"),
    };
  }
  if (role === "farmer") {
    const workshop = /repair|maintenance|waste|sanitation|refinery|exotic|weapon|tool|biome maintenance/.test(text);
    return {
      head: harthmereThreeJsClothingItem(workshop ? "hunter_cap" : "straw_hat"),
      torso: harthmereThreeJsClothingItem(workshop ? "blacksmith_apron" : "work_apron"),
      legs: harthmereThreeJsClothingItem(/food|restaurant|hospitality|inn/.test(text) ? "ember_trousers" : "earth_trousers"),
      feet: harthmereThreeJsClothingItem(workshop ? "work_boots" : "mud_boots"),
      hands: harthmereThreeJsClothingItem(workshop ? "fingerless_gloves" : "cloth_wraps"),
      belt: harthmereThreeJsClothingItem(workshop ? "tool_belt" : "rope_belt"),
      weapon: workshop ? harthmereThreeJsClothingItem("tool_hammer") : undefined,
    };
  }
  const transit = /courier|delivery|parcel|transit|portal|teleport/.test(text);
  return {
    head: harthmereThreeJsClothingItem("noble_cap"),
    torso: harthmereThreeJsClothingItem(transit ? "river_tunic" : "merchant_coat"),
    legs: harthmereThreeJsClothingItem(transit ? "river_trousers" : "royal_trousers"),
    feet: harthmereThreeJsClothingItem(transit ? "travel_boots" : "soft_shoes"),
    hands: harthmereThreeJsClothingItem("fingerless_gloves"),
    belt: harthmereThreeJsClothingItem("ledger_belt"),
    back: harthmereThreeJsClothingItem("merchant_satchel"),
  };
}

function finalizeGroveBusinessAppearanceV1(
  appearance: HarthmereCharacterAppearance,
  clothing: HarthmereCharacterClothing,
  sourceKind: "staff" | "customer",
) {
  const requiredSource = `${HARTHMERE_BUSINESS_NPC_GROVE_COSMETIC_VERSION_V1}:${sourceKind}`;
  return normalizeHarthmereCharacterAppearance({
    ...appearance,
    species: "human",
    clothing: {
      ...(appearance.clothing ?? {}),
      ...clothing,
    },
    source: appearance.source?.includes(requiredSource)
      ? appearance.source
      : `${appearance.source ?? "generated:npc"};${requiredSource}`,
  });
}

function customerSpecificAppearanceSpreadV1(
  npc: HarthmereBusinessCustomerNpcV1,
  appearance: HarthmereCharacterAppearance,
): HarthmereCharacterAppearance {
  const featureKey = `${npc.npcId}:${JSON.stringify(npc.appearance)}`;
  const humanSkinTones = HARTHMERE_SKIN_TONES.filter((tone) => tone !== "metal");
  return normalizeHarthmereCharacterAppearance({
    ...appearance,
    face: {
      ...appearance.face,
      skinTone: pickFromTextV1(humanSkinTones, featureKey, "skin"),
      hairStyle: pickFromTextV1(HARTHMERE_HAIR_STYLES, featureKey, "hairStyle"),
      hairColor: pickFromTextV1(HARTHMERE_HAIR_COLORS, featureKey, "hairColor"),
      eyeColor: pickFromTextV1(HARTHMERE_EYE_COLORS, featureKey, "eyeColor"),
      faceShape: pickFromTextV1(HARTHMERE_FACE_SHAPES, featureKey, "faceShape"),
      eyeShape: pickFromTextV1(HARTHMERE_EYE_SHAPES, featureKey, "eyeShape"),
      browStyle: pickFromTextV1(HARTHMERE_BROW_STYLES, featureKey, "browStyle"),
      noseStyle: pickFromTextV1(HARTHMERE_NOSE_STYLES, featureKey, "noseStyle"),
      mouthStyle: pickFromTextV1(HARTHMERE_MOUTH_STYLES, featureKey, "mouthStyle"),
      facialHair: pickFromTextV1(HARTHMERE_FACIAL_HAIR_STYLES, featureKey, "facialHair"),
      cheekStyle: pickFromTextV1(HARTHMERE_CHEEK_STYLES, featureKey, "cheekStyle"),
      accessory: pickFromTextV1(HARTHMERE_FACE_ACCESSORIES, featureKey, "accessory"),
    },
    body: {
      ...appearance.body,
      bodyType: pickFromTextV1(HARTHMERE_BODY_TYPES, featureKey, "bodyType"),
      bodyHeight: pickFromTextV1(HARTHMERE_BODY_HEIGHTS, featureKey, "bodyHeight"),
      shoulderWidth: pickFromTextV1(HARTHMERE_SHOULDER_WIDTHS, featureKey, "shoulderWidth"),
      armLength: pickFromTextV1(HARTHMERE_ARM_LENGTHS, featureKey, "armLength"),
      legLength: pickFromTextV1(HARTHMERE_LEG_LENGTHS, featureKey, "legLength"),
      stance: pickFromTextV1(HARTHMERE_BODY_STANCES, featureKey, "stance"),
      outfitColor: pickFromTextV1(HARTHMERE_OUTFIT_COLORS, featureKey, "outfitColor"),
    },
    source: `${appearance.source ?? "generated:npc"};customer-freeform-feature-spread-v1`,
  });
}

export function harthmereBusinessOutpostStaffAppearanceV1(
  outpost: HarthmereBusinessOutpostV1,
): HarthmereCharacterAppearance {
  const role = harthmereBusinessOutpostStaffRoleV1(outpost);
  const text = businessTypeTextV1(outpost.businessType);
  const clothing = groveBusinessRoleClothingV1(role, text);
  return finalizeGroveBusinessAppearanceV1(
    makeHarthmereNpcAppearanceConfig({
      id: harthmereBusinessOutpostStaffSeedV1(outpost),
      name: `${outpost.displayName} ${outpost.job.title}`,
      species: "human",
      role,
      roleHint: [
        "Grove townsperson business staff",
        "Bikkie clothing",
        text,
        outpost.job.title,
        outpost.displayName,
      ].join(" "),
      clothing,
      source: `${HARTHMERE_BUSINESS_NPC_GROVE_COSMETIC_VERSION_V1}:staff`,
    }),
    clothing,
    "staff",
  );
}

function customerAppearanceTextV1(npc: HarthmereBusinessCustomerNpcV1) {
  const appearance = npc.appearance;
  return [
    "Grove townsperson business customer",
    "Bikkie clothing",
    businessTypesTextV1(npc.businessPreferences),
    npc.temperament,
    appearance.hairStyle,
    appearance.hairColor,
    appearance.bodyBuild,
    appearance.heightBand,
    appearance.shoulderShape,
    appearance.posture,
    appearance.gait,
    appearance.eyeColor,
    appearance.eyeShape,
    appearance.browShape,
    appearance.noseShape,
    appearance.noseBridge,
    appearance.skinTone,
    appearance.outfit,
    appearance.accessory,
    appearance.voice,
  ].join(" ");
}

function customerRoleV1(npc: HarthmereBusinessCustomerNpcV1) {
  return roleForBusinessTextV1(customerAppearanceTextV1(npc));
}

export function harthmereBusinessCustomerCharacterAppearanceV1(
  npc: HarthmereBusinessCustomerNpcV1,
): HarthmereCharacterAppearance {
  const role = customerRoleV1(npc);
  const roleHint = customerAppearanceTextV1(npc);
  const clothing = groveBusinessRoleClothingV1(role, roleHint);
  const generated = makeHarthmereNpcAppearanceConfig({
      id: stableHashV1(npc.npcId),
      name: npc.displayName,
      species: "human",
      role,
      roleHint,
      clothing,
      source: `${HARTHMERE_BUSINESS_NPC_GROVE_COSMETIC_VERSION_V1}:customer`,
    });
  return finalizeGroveBusinessAppearanceV1(
    customerSpecificAppearanceSpreadV1(npc, generated),
    clothing,
    "customer",
  );
}
