import type { BiomesId } from "@/shared/ids";
import { safeParseBiomesId } from "@/shared/ids";

export const HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION =
  "harthmere-native-bikkie-items-v1" as const;

// Keep generated ids in a deterministic 8.65-8.69 quadrillion segment, away
// from Harthmere's 8.81-quadrillion seeded world-entity ranges. Snapshot ids
// are sparse random values, so collision is extraordinarily unlikely; the
// server-side tray augmenter still fails loudly on an actual biscuit collision.
const HARTHMERE_BIKKIE_ID_BASE = 8_650_000_000_000_000n;
const HARTHMERE_BIKKIE_ID_SPAN = 40_000_000_000_000n;
const FNV_OFFSET_BASIS_64 = 14_695_981_039_346_656_037n;
const FNV_PRIME_64 = 1_099_511_628_211n;

function fnv1a64(value: string) {
  let hash = FNV_OFFSET_BASIS_64;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * FNV_PRIME_64);
  }
  return hash;
}

/** Exact, deterministic item identity used by ECS inventory and triggers. */
export function harthmereNativeBiomesIdForItemId(
  itemId: string | number | undefined
): BiomesId | undefined {
  if (itemId === undefined || itemId === null) return undefined;
  const key = String(itemId).trim();
  if (!key) return undefined;
  const existing = safeParseBiomesId(key);
  if (existing !== undefined) return existing;
  return Number(
    HARTHMERE_BIKKIE_ID_BASE +
      (fnv1a64(`harthmere:item:${key}`) % HARTHMERE_BIKKIE_ID_SPAN)
  ) as BiomesId;
}
