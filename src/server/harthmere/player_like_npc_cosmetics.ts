export const HARTHMERE_PLAYER_LIKE_NPC_COSMETIC_RESET_VERSION =
  "harthmere-player-like-npc-cosmetic-reset-v2" as const;

export type HarthmereNpcSeedChangeKind = "create" | "update";

export function prepareHarthmerePlayerLikeNpcForUniqueAppearance<
  T extends object
>(entity: T, kind: HarthmereNpcSeedChangeKind) {
  const prepared = { ...entity } as T & {
    appearance_component?: unknown | null;
    wearing?: unknown | null;
  };

  if (kind === "update") {
    // ECS deltas treat an omitted component as "leave the old value alone".
    // Explicit nulls are therefore required to remove the shared defaults from
    // NPCs that already exist in production and activate the per-id player mesh.
    prepared.appearance_component = null;
    prepared.wearing = null;
  } else {
    delete prepared.appearance_component;
    delete prepared.wearing;
  }

  return prepared;
}
