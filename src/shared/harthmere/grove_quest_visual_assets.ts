// Shared Grove quest presentation/combat contract. Content, renderer, browser
// E2E, and combat targeting all read these exact ids so a visible prop cannot
// drift away from the map marker or the target a real weapon swing resolves.

export const HARTHMERE_GROVE_QUEST_OBJECT_ASSET_URLS: Readonly<
  Record<string, string>
> = Object.freeze({
  guild_charter_board:
    "/assets/harthmere/glb/quest/grove/grove_guild_charter_board.glb",
  econ_kit_mailbag:
    "/assets/harthmere/glb/quest/grove/grove_courier_parcel_stand.glb",
  grove_combat_practice_dummy:
    "/assets/harthmere/glb/quest/grove/grove_softwood_practice_dummy.glb",
  doc_clean_root_sample:
    "/assets/harthmere/glb/quest/grove/grove_clean_root_sample.glb",
  doc_mucked_root_sample:
    "/assets/harthmere/glb/quest/grove/grove_mucked_root_sample.glb",
  doc_sealed_muck_sample:
    "/assets/harthmere/glb/quest/grove/grove_sealed_muck_sample.glb",
});

// 9014 is reserved for the live-entity-helper Muck boss.
export const HARTHMERE_GROVE_TRAINING_DUMMY_OFFSET = 9015;
export const HARTHMERE_GROVE_TRAINING_DUMMY_WORLD_XZ = [548, -226] as const;
export const HARTHMERE_GROVE_SPARRING_RING_WORLD_XZ = [542, -222] as const;
