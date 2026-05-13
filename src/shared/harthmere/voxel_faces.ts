import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_FACE_VERSION = 2 as const;

export const HARTHMERE_GENDER_OPTIONS = [
  { id: "woman", label: "Woman", defaultPronouns: "she/her" },
  { id: "man", label: "Man", defaultPronouns: "he/him" },
  { id: "nonbinary", label: "Non-binary", defaultPronouns: "they/them" },
  { id: "genderfluid", label: "Genderfluid", defaultPronouns: "they/them" },
  { id: "agender", label: "Agender", defaultPronouns: "they/them" },
  { id: "two_spirit", label: "Two-Spirit", defaultPronouns: "they/them" },
  { id: "custom", label: "Custom", defaultPronouns: "they/them" },
] as const;

export type HarthmereGenderIdentity =
  (typeof HARTHMERE_GENDER_OPTIONS)[number]["id"];

export const HARTHMERE_PRONOUN_OPTIONS = [
  "they/them",
  "she/her",
  "he/him",
  "she/they",
  "he/they",
  "ze/zir",
  "xe/xem",
  "name only",
  "custom",
] as const;

export type HarthmerePronouns = (typeof HARTHMERE_PRONOUN_OPTIONS)[number];

export const HARTHMERE_SKIN_TONES = [
  "porcelain",
  "light",
  "warm",
  "tan",
  "brown",
  "deep",
  "metal",
] as const;
export type HarthmereSkinTone = (typeof HARTHMERE_SKIN_TONES)[number];

export const HARTHMERE_HAIR_COLORS = [
  "black",
  "brown",
  "auburn",
  "blonde",
  "gray",
  "white",
  "red",
  "blue",
  "green",
  "purple",
] as const;
export type HarthmereHairColor = (typeof HARTHMERE_HAIR_COLORS)[number];

export const HARTHMERE_EYE_COLORS = [
  "black",
  "brown",
  "blue",
  "green",
  "hazel",
  "gray",
  "amber",
  "violet",
] as const;
export type HarthmereEyeColor = (typeof HARTHMERE_EYE_COLORS)[number];

export const HARTHMERE_FACE_SHAPES = [
  "bolt_square",
  "wide",
  "narrow",
  "tall",
  "soft",
] as const;
export type HarthmereFaceShape = (typeof HARTHMERE_FACE_SHAPES)[number];

export const HARTHMERE_EYE_SHAPES = [
  "square",
  "wide",
  "small",
  "sleepy",
  "sharp",
] as const;
export type HarthmereEyeShape = (typeof HARTHMERE_EYE_SHAPES)[number];

export const HARTHMERE_BROW_STYLES = [
  "soft",
  "straight",
  "arched",
  "stern",
  "scarred",
] as const;
export type HarthmereBrowStyle = (typeof HARTHMERE_BROW_STYLES)[number];

export const HARTHMERE_NOSE_STYLES = [
  "small",
  "straight",
  "wide",
  "long",
  "button",
] as const;
export type HarthmereNoseStyle = (typeof HARTHMERE_NOSE_STYLES)[number];

export const HARTHMERE_MOUTH_STYLES = [
  "line",
  "smile",
  "frown",
  "open",
  "stern",
  "smirk",
] as const;
export type HarthmereMouthStyle = (typeof HARTHMERE_MOUTH_STYLES)[number];

export const HARTHMERE_HAIR_STYLES = [
  "flat",
  "side_part",
  "short_crown",
  "balding",
  "hood",
  "cap",
  "braids",
  "curly",
  "shaved",
  "bob",
  "long",
  "bun",
  "pigtails",
  "wavy",
] as const;
export type HarthmereHairStyle = (typeof HARTHMERE_HAIR_STYLES)[number];

export const HARTHMERE_FACIAL_HAIR_STYLES = [
  "none",
  "mustache",
  "goatee",
  "short_beard",
  "full_beard",
] as const;
export type HarthmereFacialHairStyle =
  (typeof HARTHMERE_FACIAL_HAIR_STYLES)[number];

export const HARTHMERE_CHEEK_STYLES = [
  "none",
  "soft",
  "strong",
  "freckled",
] as const;
export type HarthmereCheekStyle = (typeof HARTHMERE_CHEEK_STYLES)[number];

export const HARTHMERE_FACE_ACCESSORIES = [
  "none",
  "cap",
  "hood",
  "headband",
  "spectacles",
] as const;
export type HarthmereFaceAccessory =
  (typeof HARTHMERE_FACE_ACCESSORIES)[number];

export type HarthmereVoxelFaceConfig = {
  version: typeof HARTHMERE_FACE_VERSION;
  genderIdentity: HarthmereGenderIdentity;
  pronouns: HarthmerePronouns;
  customPronouns?: string;
  skinTone: HarthmereSkinTone;
  faceShape: HarthmereFaceShape;
  eyeShape: HarthmereEyeShape;
  eyeColor: HarthmereEyeColor;
  browStyle: HarthmereBrowStyle;
  noseStyle: HarthmereNoseStyle;
  mouthStyle: HarthmereMouthStyle;
  hairStyle: HarthmereHairStyle;
  hairColor: HarthmereHairColor;
  facialHair: HarthmereFacialHairStyle;
  cheekStyle: HarthmereCheekStyle;
  accessory: HarthmereFaceAccessory;
};

export const DEFAULT_HARTHMERE_PLAYER_FACE: HarthmereVoxelFaceConfig = {
  version: HARTHMERE_FACE_VERSION,
  genderIdentity: "nonbinary",
  pronouns: "they/them",
  skinTone: "warm",
  faceShape: "bolt_square",
  eyeShape: "square",
  eyeColor: "black",
  browStyle: "straight",
  noseStyle: "straight",
  mouthStyle: "line",
  hairStyle: "flat",
  hairColor: "brown",
  facialHair: "none",
  cheekStyle: "none",
  accessory: "none",
};

export const HARTHMERE_BODY_TYPES = [
  "average",
  "slim",
  "broad",
  "stocky",
  "athletic",
  "soft",
] as const;
export type HarthmereBodyType = (typeof HARTHMERE_BODY_TYPES)[number];

export const HARTHMERE_BODY_HEIGHTS = [
  "short",
  "average",
  "tall",
  "very_tall",
] as const;
export type HarthmereBodyHeight = (typeof HARTHMERE_BODY_HEIGHTS)[number];

export const HARTHMERE_SHOULDER_WIDTHS = [
  "narrow",
  "average",
  "wide",
] as const;
export type HarthmereShoulderWidth =
  (typeof HARTHMERE_SHOULDER_WIDTHS)[number];

export const HARTHMERE_ARM_LENGTHS = [
  "short",
  "average",
  "long",
] as const;
export type HarthmereArmLength = (typeof HARTHMERE_ARM_LENGTHS)[number];

export const HARTHMERE_LEG_LENGTHS = [
  "short",
  "average",
  "long",
] as const;
export type HarthmereLegLength = (typeof HARTHMERE_LEG_LENGTHS)[number];

export const HARTHMERE_BODY_STANCES = [
  "relaxed",
  "upright",
  "heroic",
  "reserved",
] as const;
export type HarthmereBodyStance = (typeof HARTHMERE_BODY_STANCES)[number];

export const HARTHMERE_OUTFIT_COLORS = [
  "earth",
  "forest",
  "river",
  "ember",
  "royal",
  "ash",
] as const;
export type HarthmereOutfitColor = (typeof HARTHMERE_OUTFIT_COLORS)[number];

export type HarthmereVoxelBodyConfig = {
  version: typeof HARTHMERE_FACE_VERSION;
  bodyType: HarthmereBodyType;
  bodyHeight: HarthmereBodyHeight;
  shoulderWidth: HarthmereShoulderWidth;
  armLength: HarthmereArmLength;
  legLength: HarthmereLegLength;
  stance: HarthmereBodyStance;
  outfitColor: HarthmereOutfitColor;
};

export const DEFAULT_HARTHMERE_PLAYER_BODY: HarthmereVoxelBodyConfig = {
  version: HARTHMERE_FACE_VERSION,
  bodyType: "average",
  bodyHeight: "average",
  shoulderWidth: "average",
  armLength: "average",
  legLength: "average",
  stance: "relaxed",
  outfitColor: "earth",
};

const HARTHMERE_FACE_MARKER = "<!-- harthmere:face:";
const HARTHMERE_FACE_MARKER_END = " -->";
const HARTHMERE_BODY_MARKER = "<!-- harthmere:body:";
const HARTHMERE_BODY_MARKER_END = " -->";
const HARTHMERE_PLAYER_FACE_KEY_PREFIX =
  "biomes.localDev.harthmere.playerFace.v2.user.";
const HARTHMERE_PLAYER_BODY_KEY_PREFIX =
  "biomes.localDev.harthmere.playerBody.v1.user.";

function hashString(value: string) {
  let seed = 2166136261;
  for (const char of value) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  return seed >>> 0;
}

function pick<T>(items: readonly T[], seed: number, salt: number): T {
  return items[((seed >>> 0) + salt * 2654435761) % items.length]!;
}

function stripMarkerRange(
  value: string,
  marker: string,
  markerEnd: string,
) {
  const start = value.indexOf(marker);
  if (start < 0) {
    return value.trim();
  }
  const end = value.indexOf(markerEnd, start + marker.length);
  if (end < 0) {
    return value.slice(0, start).trim();
  }
  return `${value.slice(0, start)}${value.slice(end + markerEnd.length)}`.trim();
}

function shouldHaveFacialHair(gender: HarthmereGenderIdentity, seed: number) {
  if (gender === "woman") {
    return (seed & 63) === 7;
  }
  if (gender === "agender") {
    return (seed & 31) === 7;
  }
  if (gender === "nonbinary" || gender === "genderfluid" || gender === "two_spirit") {
    return (seed & 7) <= 2;
  }
  return (seed & 3) !== 0;
}

export function defaultPronounsForGender(
  genderIdentity: HarthmereGenderIdentity,
): HarthmerePronouns {
  return (
    HARTHMERE_GENDER_OPTIONS.find((option) => option.id === genderIdentity)
      ?.defaultPronouns ?? "they/them"
  ) as HarthmerePronouns;
}

export function normalizeHarthmereFaceConfig(
  value: Partial<HarthmereVoxelFaceConfig> | undefined,
): HarthmereVoxelFaceConfig {
  const merged = {
    ...DEFAULT_HARTHMERE_PLAYER_FACE,
    ...(value ?? {}),
    version: HARTHMERE_FACE_VERSION,
  } as HarthmereVoxelFaceConfig;

  if (!HARTHMERE_GENDER_OPTIONS.some((option) => option.id === merged.genderIdentity)) {
    merged.genderIdentity = DEFAULT_HARTHMERE_PLAYER_FACE.genderIdentity;
  }
  if (!HARTHMERE_PRONOUN_OPTIONS.includes(merged.pronouns)) {
    merged.pronouns = defaultPronounsForGender(merged.genderIdentity);
  }
  if (!HARTHMERE_SKIN_TONES.includes(merged.skinTone)) {
    merged.skinTone = DEFAULT_HARTHMERE_PLAYER_FACE.skinTone;
  }
  if (!HARTHMERE_FACE_SHAPES.includes(merged.faceShape)) {
    merged.faceShape = DEFAULT_HARTHMERE_PLAYER_FACE.faceShape;
  }
  if (!HARTHMERE_EYE_SHAPES.includes(merged.eyeShape)) {
    merged.eyeShape = DEFAULT_HARTHMERE_PLAYER_FACE.eyeShape;
  }
  if (!HARTHMERE_EYE_COLORS.includes(merged.eyeColor)) {
    merged.eyeColor = DEFAULT_HARTHMERE_PLAYER_FACE.eyeColor;
  }
  if (!HARTHMERE_BROW_STYLES.includes(merged.browStyle)) {
    merged.browStyle = DEFAULT_HARTHMERE_PLAYER_FACE.browStyle;
  }
  if (!HARTHMERE_NOSE_STYLES.includes(merged.noseStyle)) {
    merged.noseStyle = DEFAULT_HARTHMERE_PLAYER_FACE.noseStyle;
  }
  if (!HARTHMERE_MOUTH_STYLES.includes(merged.mouthStyle)) {
    merged.mouthStyle = DEFAULT_HARTHMERE_PLAYER_FACE.mouthStyle;
  }
  if (!HARTHMERE_HAIR_STYLES.includes(merged.hairStyle)) {
    merged.hairStyle = DEFAULT_HARTHMERE_PLAYER_FACE.hairStyle;
  }
  if (!HARTHMERE_HAIR_COLORS.includes(merged.hairColor)) {
    merged.hairColor = DEFAULT_HARTHMERE_PLAYER_FACE.hairColor;
  }
  if (!HARTHMERE_FACIAL_HAIR_STYLES.includes(merged.facialHair)) {
    merged.facialHair = DEFAULT_HARTHMERE_PLAYER_FACE.facialHair;
  }
  if (!HARTHMERE_CHEEK_STYLES.includes(merged.cheekStyle)) {
    merged.cheekStyle = DEFAULT_HARTHMERE_PLAYER_FACE.cheekStyle;
  }
  if (!HARTHMERE_FACE_ACCESSORIES.includes(merged.accessory)) {
    merged.accessory = DEFAULT_HARTHMERE_PLAYER_FACE.accessory;
  }

  return merged;
}

export function normalizeHarthmereBodyConfig(
  value: Partial<HarthmereVoxelBodyConfig> | undefined,
): HarthmereVoxelBodyConfig {
  const merged = {
    ...DEFAULT_HARTHMERE_PLAYER_BODY,
    ...(value ?? {}),
    version: HARTHMERE_FACE_VERSION,
  } as HarthmereVoxelBodyConfig;

  if (!HARTHMERE_BODY_TYPES.includes(merged.bodyType)) {
    merged.bodyType = DEFAULT_HARTHMERE_PLAYER_BODY.bodyType;
  }
  if (!HARTHMERE_BODY_HEIGHTS.includes(merged.bodyHeight)) {
    merged.bodyHeight = DEFAULT_HARTHMERE_PLAYER_BODY.bodyHeight;
  }
  if (!HARTHMERE_SHOULDER_WIDTHS.includes(merged.shoulderWidth)) {
    merged.shoulderWidth = DEFAULT_HARTHMERE_PLAYER_BODY.shoulderWidth;
  }
  if (!HARTHMERE_ARM_LENGTHS.includes(merged.armLength)) {
    merged.armLength = DEFAULT_HARTHMERE_PLAYER_BODY.armLength;
  }
  if (!HARTHMERE_LEG_LENGTHS.includes(merged.legLength)) {
    merged.legLength = DEFAULT_HARTHMERE_PLAYER_BODY.legLength;
  }
  if (!HARTHMERE_BODY_STANCES.includes(merged.stance)) {
    merged.stance = DEFAULT_HARTHMERE_PLAYER_BODY.stance;
  }
  if (!HARTHMERE_OUTFIT_COLORS.includes(merged.outfitColor)) {
    merged.outfitColor = DEFAULT_HARTHMERE_PLAYER_BODY.outfitColor;
  }

  return merged;
}


function hairStylesForGender(gender: HarthmereGenderIdentity): readonly HarthmereHairStyle[] {
  if (gender === "woman") {
    return [
      "bob",
      "long",
      "bun",
      "pigtails",
      "wavy",
      "braids",
      "curly",
      "side_part",
      "short_crown",
      "hood",
      "cap",
    ] as const;
  }
  if (gender === "nonbinary" || gender === "genderfluid" || gender === "two_spirit") {
    return [
      "bob",
      "long",
      "bun",
      "braids",
      "curly",
      "wavy",
      "side_part",
      "short_crown",
      "shaved",
      "hood",
      "cap",
    ] as const;
  }
  if (gender === "agender") {
    return ["shaved", "short_crown", "bob", "flat", "hood", "cap", "curly", "side_part"] as const;
  }
  return ["flat", "side_part", "short_crown", "shaved", "balding", "curly", "wavy", "cap", "hood"] as const;
}

function outfitColorsForRole(roleHint: string, name: string): readonly HarthmereOutfitColor[] {
  const normalized = `${roleHint} ${name}`.toLowerCase();
  if (normalized.includes("guard") || normalized.includes("watch") || normalized.includes("sergeant")) {
    return ["ash", "ember", "royal"] as const;
  }
  if (normalized.includes("chapel") || normalized.includes("father") || normalized.includes("sister") || normalized.includes("choir")) {
    return ["river", "ash", "royal"] as const;
  }
  if (normalized.includes("dock") || normalized.includes("ferry") || normalized.includes("river")) {
    return ["river", "earth", "ash"] as const;
  }
  if (normalized.includes("farmer") || normalized.includes("orchard") || normalized.includes("stable")) {
    return ["forest", "earth", "ember"] as const;
  }
  if (normalized.includes("merchant") || normalized.includes("vendor") || normalized.includes("banker") || normalized.includes("clerk")) {
    return ["royal", "forest", "river", "ember"] as const;
  }
  if (normalized.includes("mudden") || normalized.includes("smuggler") || normalized.includes("underways")) {
    return ["earth", "ash", "forest"] as const;
  }
  return HARTHMERE_OUTFIT_COLORS;
}

export function makeHarthmereNpcFaceConfig(input: {
  id: BiomesId | number;
  name: string;
  roleHint?: string;
}): HarthmereVoxelFaceConfig {
  const normalizedName = input.name.toLowerCase();
  const roleHint = input.roleHint?.toLowerCase() ?? "";
  const seed = hashString(`${input.id}:${input.name}:${roleHint}`);
  const genderIdentity: HarthmereGenderIdentity = normalizedName.includes("bolt")
    ? "nonbinary"
    : pick(
        [
          "woman",
          "man",
          "nonbinary",
          "woman",
          "man",
          "genderfluid",
          "agender",
        ] as const,
        seed,
        1,
      );
  const pronouns =
    genderIdentity === "woman"
      ? pick(["she/her", "she/they"] as const, seed, 2)
      : genderIdentity === "man"
      ? pick(["he/him", "he/they"] as const, seed, 2)
      : pick(["they/them", "ze/zir", "xe/xem", "name only"] as const, seed, 2);

  const lawfulOrGuard =
    roleHint.includes("guard") ||
    normalizedName.includes("guard") ||
    normalizedName.includes("watch") ||
    normalizedName.includes("sergeant");
  const clergy =
    roleHint.includes("chapel") ||
    normalizedName.includes("father") ||
    normalizedName.includes("sister") ||
    normalizedName.includes("choir");
  const mudden =
    roleHint.includes("mudden") ||
    normalizedName.includes("mudden") ||
    normalizedName.includes("rat catcher") ||
    normalizedName.includes("washerwoman");
  const merchant =
    roleHint.includes("merchant") ||
    normalizedName.includes("merchant") ||
    normalizedName.includes("vendor") ||
    normalizedName.includes("teller") ||
    normalizedName.includes("banker") ||
    normalizedName.includes("clerk");

  const skinTone = normalizedName.includes("bolt")
    ? "metal"
    : clergy
    ? pick(["light", "warm", "tan"] as const, seed, 3)
    : mudden
    ? pick(["tan", "brown", "deep", "warm"] as const, seed, 3)
    : pick(HARTHMERE_SKIN_TONES.filter((tone) => tone !== "metal"), seed, 3);

  const genderHairStyles = hairStylesForGender(genderIdentity);
  const hairStyle = normalizedName.includes("bolt")
    ? "flat"
    : lawfulOrGuard
    ? pick(["flat", "short_crown", "shaved", "side_part", "bob"] as const, seed, 4)
    : clergy
    ? pick(["hood", "bun", "side_part", "short_crown", "bob"] as const, seed, 4)
    : merchant
    ? pick(["side_part", "bob", "wavy", "bun", "cap", "curly"] as const, seed, 4)
    : pick(genderHairStyles, seed, 4);

  const accessory = normalizedName.includes("bolt")
    ? "none"
    : hairStyle === "cap"
    ? "cap"
    : hairStyle === "hood"
    ? "hood"
    : lawfulOrGuard
    ? pick(["none", "headband"] as const, seed, 5)
    : merchant
    ? pick(["none", "spectacles", "cap"] as const, seed, 5)
    : pick(HARTHMERE_FACE_ACCESSORIES, seed, 5);

  const facialHair = shouldHaveFacialHair(genderIdentity, seed)
    ? pick(["mustache", "goatee", "short_beard", "full_beard"] as const, seed, 6)
    : "none";

  return normalizeHarthmereFaceConfig({
    version: HARTHMERE_FACE_VERSION,
    genderIdentity,
    pronouns,
    skinTone,
    faceShape: normalizedName.includes("bolt")
      ? "bolt_square"
      : pick(HARTHMERE_FACE_SHAPES, seed, 7),
    eyeShape: pick(HARTHMERE_EYE_SHAPES, seed, 8),
    eyeColor: pick(HARTHMERE_EYE_COLORS, seed, 9),
    browStyle: lawfulOrGuard
      ? pick(["straight", "stern", "scarred"] as const, seed, 10)
      : pick(HARTHMERE_BROW_STYLES, seed, 10),
    noseStyle: pick(HARTHMERE_NOSE_STYLES, seed, 11),
    mouthStyle: lawfulOrGuard
      ? pick(["line", "stern", "frown"] as const, seed, 12)
      : pick(HARTHMERE_MOUTH_STYLES, seed, 12),
    hairStyle,
    hairColor: normalizedName.includes("bolt")
      ? "gray"
      : pick(HARTHMERE_HAIR_COLORS, seed, 13),
    facialHair,
    cheekStyle: pick(HARTHMERE_CHEEK_STYLES, seed, 14),
    accessory,
  });
}


export function makeHarthmereNpcBodyConfig(input: {
  id: BiomesId | number;
  name: string;
  roleHint?: string;
  face?: HarthmereVoxelFaceConfig;
}): HarthmereVoxelBodyConfig {
  const roleHint = input.roleHint?.toLowerCase() ?? "";
  const normalizedName = input.name.toLowerCase();
  const seed = hashString(`${input.id}:${input.name}:${roleHint}:body`);
  const face = input.face ?? makeHarthmereNpcFaceConfig(input);
  const roleOutfits = outfitColorsForRole(roleHint, input.name);
  const gender = face.genderIdentity;

  const bodyPool: readonly HarthmereBodyType[] = normalizedName.includes("bolt")
    ? (["average"] as const)
    : roleHint.includes("guard") || normalizedName.includes("guard") || normalizedName.includes("watch")
    ? (["athletic", "broad", "stocky", "average"] as const)
    : roleHint.includes("smith") || normalizedName.includes("blacksmith") || normalizedName.includes("forge")
    ? (["broad", "stocky", "athletic"] as const)
    : roleHint.includes("dock") || normalizedName.includes("dock")
    ? (["stocky", "athletic", "average", "broad"] as const)
    : gender === "woman"
    ? (["slim", "soft", "average", "athletic", "stocky"] as const)
    : gender === "man"
    ? (["average", "broad", "stocky", "athletic", "slim"] as const)
    : (["average", "slim", "soft", "athletic", "stocky", "broad"] as const);

  const shoulderPool: readonly HarthmereShoulderWidth[] =
    roleHint.includes("guard") || normalizedName.includes("guard") || normalizedName.includes("watch")
      ? (["wide", "average"] as const)
      : gender === "woman"
      ? (["narrow", "average", "wide"] as const)
      : (["average", "wide", "narrow"] as const);

  return normalizeHarthmereBodyConfig({
    version: HARTHMERE_FACE_VERSION,
    bodyType: pick(bodyPool, seed, 1),
    bodyHeight: pick(HARTHMERE_BODY_HEIGHTS, seed, 2),
    shoulderWidth: pick(shoulderPool, seed, 3),
    armLength: pick(HARTHMERE_ARM_LENGTHS, seed, 4),
    legLength: pick(HARTHMERE_LEG_LENGTHS, seed, 5),
    stance: roleHint.includes("guard") || normalizedName.includes("guard")
      ? pick(["upright", "heroic"] as const, seed, 6)
      : pick(HARTHMERE_BODY_STANCES, seed, 6),
    outfitColor: pick(roleOutfits, seed, 7),
  });
}

export function withHarthmereFaceMarker(
  description: string,
  face: HarthmereVoxelFaceConfig,
) {
  const cleanDescription = description.replace(
    new RegExp(`${HARTHMERE_FACE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*?${HARTHMERE_FACE_MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"),
    "",
  ).trim();
  return `${cleanDescription}\n${HARTHMERE_FACE_MARKER}${encodeURIComponent(
    JSON.stringify(normalizeHarthmereFaceConfig(face)),
  )}${HARTHMERE_FACE_MARKER_END}`;
}

export function parseHarthmereFaceMarker(
  value: string | undefined | null,
): HarthmereVoxelFaceConfig | undefined {
  if (!value) {
    return undefined;
  }
  const start = value.indexOf(HARTHMERE_FACE_MARKER);
  if (start < 0) {
    return undefined;
  }
  const payloadStart = start + HARTHMERE_FACE_MARKER.length;
  const end = value.indexOf(HARTHMERE_FACE_MARKER_END, payloadStart);
  if (end < 0) {
    return undefined;
  }
  try {
    return normalizeHarthmereFaceConfig(
      JSON.parse(decodeURIComponent(value.slice(payloadStart, end))),
    );
  } catch {
    return undefined;
  }
}

export function stripHarthmereFaceMarker(value: string | undefined | null) {
  if (!value) {
    return value ?? "";
  }
  const start = value.indexOf(HARTHMERE_FACE_MARKER);
  if (start < 0) {
    return value;
  }
  return value.slice(0, start).trim();
}

export function withHarthmereBodyMarker(
  description: string,
  body: HarthmereVoxelBodyConfig,
) {
  const cleanDescription = stripMarkerRange(
    description,
    HARTHMERE_BODY_MARKER,
    HARTHMERE_BODY_MARKER_END,
  );
  return `${cleanDescription}
${HARTHMERE_BODY_MARKER}${encodeURIComponent(
    JSON.stringify(normalizeHarthmereBodyConfig(body)),
  )}${HARTHMERE_BODY_MARKER_END}`;
}

export function parseHarthmereBodyMarker(
  value: string | undefined | null,
): HarthmereVoxelBodyConfig | undefined {
  if (!value) {
    return undefined;
  }
  const start = value.indexOf(HARTHMERE_BODY_MARKER);
  if (start < 0) {
    return undefined;
  }
  const payloadStart = start + HARTHMERE_BODY_MARKER.length;
  const end = value.indexOf(HARTHMERE_BODY_MARKER_END, payloadStart);
  if (end < 0) {
    return undefined;
  }
  try {
    return normalizeHarthmereBodyConfig(
      JSON.parse(decodeURIComponent(value.slice(payloadStart, end))),
    );
  } catch {
    return undefined;
  }
}

export function withHarthmereBodyAndFaceMarkers(
  description: string,
  face: HarthmereVoxelFaceConfig,
  body: HarthmereVoxelBodyConfig,
) {
  return withHarthmereBodyMarker(withHarthmereFaceMarker(description, face), body);
}

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && !!window.localStorage;
}

const HARTHMERE_ANONYMOUS_CUSTOMIZATION_SESSION_KEY =
  "biomes.localDev.harthmere.customizationAnonymousSession.v1";

function harthmereCustomizationOwnerKey(userId: BiomesId | number | string) {
  const raw = String(userId ?? "").trim();
  if (raw && raw !== "0" && raw !== "anonymous" && raw !== "undefined" && raw !== "null") {
    return raw;
  }

  // Anonymous/observer sessions used to share one localStorage bucket, which
  // made the wake-up/customization screen appear to leak face/body settings
  // between local-dev users. Give anonymous setup work a browser-session owner
  // until the real user id exists.
  if (typeof window !== "undefined" && window.sessionStorage) {
    let sessionOwner = window.sessionStorage.getItem(
      HARTHMERE_ANONYMOUS_CUSTOMIZATION_SESSION_KEY,
    );
    if (!sessionOwner) {
      const randomPart =
        typeof window.crypto?.randomUUID === "function"
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionOwner = `anonymous.${randomPart}`;
      window.sessionStorage.setItem(
        HARTHMERE_ANONYMOUS_CUSTOMIZATION_SESSION_KEY,
        sessionOwner,
      );
    }
    return sessionOwner;
  }

  return "anonymous.server";
}

export function harthmerePlayerFaceStorageKey(userId: BiomesId | number | string) {
  return `${HARTHMERE_PLAYER_FACE_KEY_PREFIX}${harthmereCustomizationOwnerKey(userId)}`;
}

export function loadHarthmerePlayerFaceConfig(
  userId: BiomesId | number | string,
): HarthmereVoxelFaceConfig {
  if (!isBrowserStorageAvailable()) {
    return DEFAULT_HARTHMERE_PLAYER_FACE;
  }
  const raw = window.localStorage.getItem(harthmerePlayerFaceStorageKey(userId));
  if (!raw) {
    return DEFAULT_HARTHMERE_PLAYER_FACE;
  }
  try {
    return normalizeHarthmereFaceConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_HARTHMERE_PLAYER_FACE;
  }
}

export function saveHarthmerePlayerFaceConfig(
  userId: BiomesId | number | string,
  face: HarthmereVoxelFaceConfig,
) {
  if (!isBrowserStorageAvailable()) {
    return;
  }
  window.localStorage.setItem(
    harthmerePlayerFaceStorageKey(userId),
    JSON.stringify(normalizeHarthmereFaceConfig(face)),
  );
  window.dispatchEvent(new CustomEvent("biomes:harthmere-face-changed"));
}


export function harthmerePlayerBodyStorageKey(userId: BiomesId | number | string) {
  return `${HARTHMERE_PLAYER_BODY_KEY_PREFIX}${harthmereCustomizationOwnerKey(userId)}`;
}

export function migrateHarthmereAnonymousCustomizationToUser(
  userId: BiomesId | number | string,
) {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  const raw = String(userId ?? "").trim();
  if (!raw || raw === "0" || raw === "anonymous" || raw === "undefined" || raw === "null") {
    return;
  }

  const sessionOwner = window.sessionStorage?.getItem(
    HARTHMERE_ANONYMOUS_CUSTOMIZATION_SESSION_KEY,
  );
  if (!sessionOwner) {
    return;
  }

  const anonymousFaceKey = `${HARTHMERE_PLAYER_FACE_KEY_PREFIX}${sessionOwner}`;
  const anonymousBodyKey = `${HARTHMERE_PLAYER_BODY_KEY_PREFIX}${sessionOwner}`;
  const userFaceKey = harthmerePlayerFaceStorageKey(raw);
  const userBodyKey = harthmerePlayerBodyStorageKey(raw);

  // First-start customization can begin while the client still has an
  // anonymous/observer user id and finish after dev login creates the real
  // user. Copy that temporary session customization into the real user bucket
  // exactly once. Do not overwrite an existing real user's saved body/face.
  if (!window.localStorage.getItem(userFaceKey)) {
    const anonymousFace = window.localStorage.getItem(anonymousFaceKey);
    if (anonymousFace) {
      window.localStorage.setItem(userFaceKey, anonymousFace);
    }
  }
  if (!window.localStorage.getItem(userBodyKey)) {
    const anonymousBody = window.localStorage.getItem(anonymousBodyKey);
    if (anonymousBody) {
      window.localStorage.setItem(userBodyKey, anonymousBody);
    }
  }
}

export function loadHarthmerePlayerBodyConfig(
  userId: BiomesId | number | string,
): HarthmereVoxelBodyConfig {
  if (!isBrowserStorageAvailable()) {
    return DEFAULT_HARTHMERE_PLAYER_BODY;
  }
  const raw = window.localStorage.getItem(harthmerePlayerBodyStorageKey(userId));
  if (!raw) {
    return DEFAULT_HARTHMERE_PLAYER_BODY;
  }
  try {
    return normalizeHarthmereBodyConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_HARTHMERE_PLAYER_BODY;
  }
}

export function saveHarthmerePlayerBodyConfig(
  userId: BiomesId | number | string,
  body: HarthmereVoxelBodyConfig,
) {
  if (!isBrowserStorageAvailable()) {
    return;
  }
  window.localStorage.setItem(
    harthmerePlayerBodyStorageKey(userId),
    JSON.stringify(normalizeHarthmereBodyConfig(body)),
  );
  window.dispatchEvent(new CustomEvent("biomes:harthmere-body-changed"));
}
