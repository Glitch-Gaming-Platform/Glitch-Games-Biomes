import type {
  HarthmereBusinessCustomerNpc,
  HarthmereBusinessOutpost,
} from "./business_customer_simulator";
import type { HarthmereEconomyBusinessTypeId } from "./mmo_economy_authority";
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

export const HARTHMERE_BUSINESS_NPC_GROVE_COSMETIC_VERSION =
  "grove-business-npc-cosmetics" as const;

function businessTypeText(
  typeId: HarthmereEconomyBusinessTypeId | string,
) {
  return String(typeId).replace(/_/g, " ");
}

function businessTypesText(types: readonly HarthmereEconomyBusinessTypeId[]) {
  return types.map(businessTypeText).join(" ");
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFromText<T>(items: readonly T[], text: string, salt: string): T {
  return items[stableHash(`${text}:${salt}`) % items.length];
}

export function roleForBusinessText(text: string): HarthmereCharacterRole {
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

export function harthmereBusinessOutpostStaffAsset(
  outpost: HarthmereBusinessOutpost,
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

export function harthmereBusinessOutpostStaffRole(
  outpost: HarthmereBusinessOutpost,
): HarthmereCharacterRole {
  return roleForBusinessText(businessTypeText(outpost.businessType));
}

export function harthmereBusinessOutpostStaffSeed(
  outpost: HarthmereBusinessOutpost,
) {
  let hash = 17;
  for (const char of `${outpost.outpostId}:${outpost.ownerNpcId}:${outpost.businessType}`) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return 9300000 + (hash % 500000);
}

export function groveBusinessRoleClothing(
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

function finalizeGroveBusinessAppearance(
  appearance: HarthmereCharacterAppearance,
  clothing: HarthmereCharacterClothing,
  sourceKind: "staff" | "customer",
) {
  const requiredSource = `${HARTHMERE_BUSINESS_NPC_GROVE_COSMETIC_VERSION}:${sourceKind}`;
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

function customerSpecificAppearanceSpread(
  npc: HarthmereBusinessCustomerNpc,
  appearance: HarthmereCharacterAppearance,
): HarthmereCharacterAppearance {
  const featureKey = `${npc.npcId}:${JSON.stringify(npc.appearance)}`;
  const humanSkinTones = HARTHMERE_SKIN_TONES.filter((tone) => tone !== "metal");
  return normalizeHarthmereCharacterAppearance({
    ...appearance,
    face: {
      ...appearance.face,
      skinTone: pickFromText(humanSkinTones, featureKey, "skin"),
      hairStyle: pickFromText(HARTHMERE_HAIR_STYLES, featureKey, "hairStyle"),
      hairColor: pickFromText(HARTHMERE_HAIR_COLORS, featureKey, "hairColor"),
      eyeColor: pickFromText(HARTHMERE_EYE_COLORS, featureKey, "eyeColor"),
      faceShape: pickFromText(HARTHMERE_FACE_SHAPES, featureKey, "faceShape"),
      eyeShape: pickFromText(HARTHMERE_EYE_SHAPES, featureKey, "eyeShape"),
      browStyle: pickFromText(HARTHMERE_BROW_STYLES, featureKey, "browStyle"),
      noseStyle: pickFromText(HARTHMERE_NOSE_STYLES, featureKey, "noseStyle"),
      mouthStyle: pickFromText(HARTHMERE_MOUTH_STYLES, featureKey, "mouthStyle"),
      facialHair: pickFromText(HARTHMERE_FACIAL_HAIR_STYLES, featureKey, "facialHair"),
      cheekStyle: pickFromText(HARTHMERE_CHEEK_STYLES, featureKey, "cheekStyle"),
      accessory: pickFromText(HARTHMERE_FACE_ACCESSORIES, featureKey, "accessory"),
    },
    body: {
      ...appearance.body,
      bodyType: pickFromText(HARTHMERE_BODY_TYPES, featureKey, "bodyType"),
      bodyHeight: pickFromText(HARTHMERE_BODY_HEIGHTS, featureKey, "bodyHeight"),
      shoulderWidth: pickFromText(HARTHMERE_SHOULDER_WIDTHS, featureKey, "shoulderWidth"),
      armLength: pickFromText(HARTHMERE_ARM_LENGTHS, featureKey, "armLength"),
      legLength: pickFromText(HARTHMERE_LEG_LENGTHS, featureKey, "legLength"),
      stance: pickFromText(HARTHMERE_BODY_STANCES, featureKey, "stance"),
      outfitColor: pickFromText(HARTHMERE_OUTFIT_COLORS, featureKey, "outfitColor"),
    },
    source: `${appearance.source ?? "generated:npc"};customer-freeform-feature-spread`,
  });
}

// HARTHMERE_BUSINESS_OWNER_DISTINCT_LOOK:
// The role + role-based clothing a shopkeeper/owner should wear, derived from
// their business type and job title. Business *staff* and *customers* already
// pass this explicit clothing (with distinctive hats: straw_hat, hunter_cap,
// militia_halfhelm, noble_cap, mage_hood) into the appearance generator, which
// is what makes them read as unique. Owners previously passed no clothing and
// fell back to the generic auto-derived set — so they looked blander/hatless.
// This exposes the same role-clothing lookup so the owner seed can opt in.
export function harthmereBusinessOwnerRoleClothing(input: {
  businessType: string;
  roleTitle?: string;
}): {
  role: HarthmereCharacterRole;
  roleHint: string;
  clothing: HarthmereCharacterClothing;
} {
  const text = [businessTypeText(input.businessType), input.roleTitle ?? ""]
    .join(" ")
    .trim();
  const role = roleForBusinessText(text);
  return { role, roleHint: text, clothing: groveBusinessRoleClothing(role, text) };
}

export function harthmereBusinessOutpostStaffAppearance(
  outpost: HarthmereBusinessOutpost,
): HarthmereCharacterAppearance {
  const role = harthmereBusinessOutpostStaffRole(outpost);
  const text = businessTypeText(outpost.businessType);
  const clothing = groveBusinessRoleClothing(role, text);
  return finalizeGroveBusinessAppearance(
    makeHarthmereNpcAppearanceConfig({
      id: harthmereBusinessOutpostStaffSeed(outpost),
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
      source: `${HARTHMERE_BUSINESS_NPC_GROVE_COSMETIC_VERSION}:staff`,
    }),
    clothing,
    "staff",
  );
}

function customerAppearanceText(npc: HarthmereBusinessCustomerNpc) {
  const appearance = npc.appearance;
  return [
    "Grove townsperson business customer",
    "Bikkie clothing",
    businessTypesText(npc.businessPreferences),
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

function customerRole(npc: HarthmereBusinessCustomerNpc) {
  return roleForBusinessText(customerAppearanceText(npc));
}

export function harthmereBusinessCustomerCharacterAppearance(
  npc: HarthmereBusinessCustomerNpc,
): HarthmereCharacterAppearance {
  const role = customerRole(npc);
  const roleHint = customerAppearanceText(npc);
  const clothing = groveBusinessRoleClothing(role, roleHint);
  const generated = makeHarthmereNpcAppearanceConfig({
      id: stableHash(npc.npcId),
      name: npc.displayName,
      species: "human",
      role,
      roleHint,
      clothing,
      source: `${HARTHMERE_BUSINESS_NPC_GROVE_COSMETIC_VERSION}:customer`,
    });
  return finalizeGroveBusinessAppearance(
    customerSpecificAppearanceSpread(npc, generated),
    clothing,
    "customer",
  );
}
