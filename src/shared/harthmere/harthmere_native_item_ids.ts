import type { BiomesId } from "@/shared/ids";
import { safeParseBiomesId } from "@/shared/ids";
import {
  HARTHMERE_NATIVE_ITEM_ID_MANIFEST,
  HARTHMERE_NATIVE_NPC_ID_MANIFEST,
  HARTHMERE_NATIVE_RECIPE_ID_MANIFEST,
} from "@/shared/harthmere/harthmere_native_id_manifest";

export const HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION =
  "harthmere-native-bikkie-identity-manifest-v3" as const;

const HARTHMERE_ITEM_ID_BY_NATIVE_BIOMES_ID = new Map<BiomesId, string>();
for (const [itemId, nativeId] of Object.entries(
  HARTHMERE_NATIVE_ITEM_ID_MANIFEST
)) {
  // Both legacy Muckwad names deliberately identify the same physical voxel
  // stack. Keep the canonical name stable for reverse inventory projection.
  if (
    !HARTHMERE_ITEM_ID_BY_NATIVE_BIOMES_ID.has(nativeId) ||
    itemId === "muckwad"
  ) {
    HARTHMERE_ITEM_ID_BY_NATIVE_BIOMES_ID.set(nativeId, itemId);
  }
}

const HARTHMERE_RECIPE_ID_BY_NATIVE_BIOMES_ID = new Map<BiomesId, string>(
  Object.entries(HARTHMERE_NATIVE_RECIPE_ID_MANIFEST).map(
    ([recipeId, nativeId]) => [nativeId, recipeId]
  )
);

/** Exact, deterministic item identity used by ECS inventory and triggers. */
export function harthmereNativeBiomesIdForItemId(
  itemId: string | number | undefined
): BiomesId | undefined {
  if (itemId === undefined || itemId === null) return undefined;
  const key = String(itemId).trim();
  if (!key) return undefined;
  const existing = safeParseBiomesId(key);
  if (existing !== undefined) return existing;
  return (
    HARTHMERE_NATIVE_ITEM_ID_MANIFEST[
      key as keyof typeof HARTHMERE_NATIVE_ITEM_ID_MANIFEST
    ] ??
    HARTHMERE_NATIVE_ITEM_ID_MANIFEST[
      key.toLowerCase() as keyof typeof HARTHMERE_NATIVE_ITEM_ID_MANIFEST
    ]
  );
}

/** Reverse only explicitly authored Harthmere identities. */
export function harthmereNativeItemIdForBiomesId(
  biomesId: BiomesId | number | undefined
) {
  const id = safeParseBiomesId(String(biomesId ?? ""));
  return id !== undefined
    ? HARTHMERE_ITEM_ID_BY_NATIVE_BIOMES_ID.get(id)
    : undefined;
}

/** Exact checked-in identity for a code-authored native NPC type biscuit. */
export function harthmereNativeBiomesIdForNpcType(
  npcTypeKey: string | undefined
): BiomesId | undefined {
  const key = String(npcTypeKey ?? "").trim();
  if (!key) return undefined;
  return HARTHMERE_NATIVE_NPC_ID_MANIFEST[
    key as keyof typeof HARTHMERE_NATIVE_NPC_ID_MANIFEST
  ];
}

/** Exact checked-in identity for a native-compatible Harthmere recipe. */
export function harthmereNativeBiomesIdForRecipeId(
  recipeId: string | undefined
): BiomesId | undefined {
  const key = String(recipeId ?? "").trim();
  if (!key) return undefined;
  return HARTHMERE_NATIVE_RECIPE_ID_MANIFEST[
    key as keyof typeof HARTHMERE_NATIVE_RECIPE_ID_MANIFEST
  ];
}

export function harthmereNativeRecipeIdForBiomesId(
  biomesId: BiomesId | number | undefined
) {
  const id = safeParseBiomesId(String(biomesId ?? ""));
  return id !== undefined
    ? HARTHMERE_RECIPE_ID_BY_NATIVE_BIOMES_ID.get(id)
    : undefined;
}
