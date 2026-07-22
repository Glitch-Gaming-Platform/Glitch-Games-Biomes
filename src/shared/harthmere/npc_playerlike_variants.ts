import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_PLAYER_LIKE_NPC_VARIANT_VERSION =
  "harthmere-player-like-npc-mixed-radix-variants" as const;

export interface HarthmerePlayerLikeNpcVariant {
  skin: number;
  eyes: number;
  hairColor: number;
  top: number;
  bottoms: number;
  hair: number;
  face: number;
  ears: number;
  neck: number;
  hands: number;
  hat: number;
  outerwear: number;
}

const VARIANT_RADICES = [12, 5, 9, 4, 4, 9, 8, 6, 5, 5, 4, 2] as const;
const VARIANT_COUNT = VARIANT_RADICES.reduce(
  (count, radix) => count * BigInt(radix),
  1n
);

// 48,271 is coprime with every radix factor (2, 3, and 5), so this affine
// permutation keeps nearby stable ECS ids distinct instead of relying on
// floating-point sine hashing, which produced occasional duplicate NPC looks.
const VARIANT_PERMUTATION_MULTIPLIER = 48_271n;
const VARIANT_PERMUTATION_OFFSET = 104_729n;

function npcVariantIndex(id: BiomesId | number) {
  const numericId = Number(id);
  const stableId = Number.isSafeInteger(numericId)
    ? BigInt(numericId)
    : BigInt(Math.trunc(numericId || 0));
  return (
    (stableId * VARIANT_PERMUTATION_MULTIPLIER + VARIANT_PERMUTATION_OFFSET) %
    VARIANT_COUNT
  );
}

export function harthmerePlayerLikeNpcVariant(
  id: BiomesId | number
): HarthmerePlayerLikeNpcVariant {
  let value = npcVariantIndex(id);
  const take = (radix: number) => {
    const digit = Number(value % BigInt(radix));
    value /= BigInt(radix);
    return digit;
  };

  return {
    skin: take(VARIANT_RADICES[0]),
    eyes: take(VARIANT_RADICES[1]),
    hairColor: take(VARIANT_RADICES[2]),
    top: take(VARIANT_RADICES[3]),
    bottoms: take(VARIANT_RADICES[4]),
    hair: take(VARIANT_RADICES[5]),
    face: take(VARIANT_RADICES[6]),
    ears: take(VARIANT_RADICES[7]),
    neck: take(VARIANT_RADICES[8]),
    hands: take(VARIANT_RADICES[9]),
    hat: take(VARIANT_RADICES[10]),
    outerwear: take(VARIANT_RADICES[11]),
  };
}

export function harthmerePlayerLikeNpcVariantSignature(id: BiomesId | number) {
  const variant = harthmerePlayerLikeNpcVariant(id);
  return [
    variant.skin,
    variant.eyes,
    variant.hairColor,
    variant.top,
    variant.bottoms,
    variant.hair,
    variant.face,
    variant.ears,
    variant.neck,
    variant.hands,
    variant.hat,
    variant.outerwear,
  ].join(":");
}
