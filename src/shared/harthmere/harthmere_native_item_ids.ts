import type { BiomesId } from "@/shared/ids";
import { safeParseBiomesId } from "@/shared/ids";
import { NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID } from "@/shared/harthmere/native_road_ahead_contract";

export const HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION =
  "harthmere-native-bikkie-combat-v2" as const;

// Keep generated ids in a deterministic 8.65-8.69 quadrillion segment, away
// from Harthmere's 8.81-quadrillion seeded world-entity ranges. Snapshot ids
// are sparse random values, so collision is extraordinarily unlikely; the
// server-side tray augmenter still fails loudly on an actual biscuit collision.
const HARTHMERE_BIKKIE_ID_BASE = 8_650_000_000_000_000n;
const HARTHMERE_BIKKIE_ID_SPAN = 40_000_000_000_000n;
const HARTHMERE_NPC_BIKKIE_ID_BASE = 8_700_000_000_000_000n;
const HARTHMERE_NPC_BIKKIE_ID_SPAN = 40_000_000_000_000n;
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

const EXACT_SNAPSHOT_ITEM_IDS: Readonly<Record<string, BiomesId>> = {
  // The original May 16 quest, terrain drops, hotbar, collect trigger, and
  // placement all refer to this exact biscuit. Generating a second Muckwad id
  // makes the quest and combat inventory observe different items.
  muckwad: NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID,
  muckwad_voxel_block: NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID,
};

const HARTHMERE_ITEM_ID_BY_NATIVE_BIOMES_ID = new Map<BiomesId, string>();

/** Exact, deterministic item identity used by ECS inventory and triggers. */
export function harthmereNativeBiomesIdForItemId(
  itemId: string | number | undefined
): BiomesId | undefined {
  if (itemId === undefined || itemId === null) return undefined;
  const key = String(itemId).trim();
  if (!key) return undefined;
  const exactSnapshotId = EXACT_SNAPSHOT_ITEM_IDS[key.toLowerCase()];
  if (exactSnapshotId !== undefined) {
    HARTHMERE_ITEM_ID_BY_NATIVE_BIOMES_ID.set(
      exactSnapshotId,
      key.toLowerCase() === "muckwad_voxel_block" ? "muckwad" : key
    );
    return exactSnapshotId;
  }
  const existing = safeParseBiomesId(key);
  if (existing !== undefined) return existing;
  const generated = Number(
    HARTHMERE_BIKKIE_ID_BASE +
      (fnv1a64(`harthmere:item:${key}`) % HARTHMERE_BIKKIE_ID_SPAN)
  ) as BiomesId;
  HARTHMERE_ITEM_ID_BY_NATIVE_BIOMES_ID.set(generated, key);
  return generated;
}

/** Reverse only exact Harthmere identities previously registered/generated. */
export function harthmereNativeItemIdForBiomesId(
  biomesId: BiomesId | number | undefined
) {
  const id = safeParseBiomesId(String(biomesId ?? ""));
  return id ? HARTHMERE_ITEM_ID_BY_NATIVE_BIOMES_ID.get(id) : undefined;
}

/** Exact deterministic identity for a code-authored native NPC type biscuit. */
export function harthmereNativeBiomesIdForNpcType(
  npcTypeKey: string | undefined
): BiomesId | undefined {
  const key = String(npcTypeKey ?? "").trim();
  if (!key) return undefined;
  return Number(
    HARTHMERE_NPC_BIKKIE_ID_BASE +
      (fnv1a64(`harthmere:npc:${key}`) % HARTHMERE_NPC_BIKKIE_ID_SPAN)
  ) as BiomesId;
}
