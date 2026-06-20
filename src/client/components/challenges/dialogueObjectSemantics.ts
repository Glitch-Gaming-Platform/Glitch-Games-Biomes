import { BikkieIds } from "@/shared/bikkie/ids";
import { isHarthmereNonLivingObjectLabel } from "@/shared/harthmere/object_interaction_semantics";
import type { BiomesId } from "@/shared/ids";

export function isHarthmereNonLivingDialogueObjectLabel(input: {
  label?: string | null;
  entityDescription?: string | null;
}) {
  return isHarthmereNonLivingObjectLabel(input);
}

// HARTHMERE_COMBAT_CREATURE_NOT_TALKABLE:
// Muckers, hexers, and the huntable wildlife (cows/sheep/rabbits) are ALL seeded
// with the single shared `dMucker` damageable-creature NPC type (see
// live_entity_ecs_seed.ts — `monsterTypeId`). They are combat targets you
// attack, never conversational NPCs. The seed strips their `default_dialog` to
// suppress the "F: Talk" prompt, but the talk gate also treats an
// `entity_description` as a talk signal — and these creatures carry a flavour
// description — so they were still wrongly talkable. Their npc type is the only
// reliable, label-independent discriminator, so gate talkability on it here.
export function isHarthmereCombatCreatureNpcType(
  typeId: BiomesId | number | null | undefined
): boolean {
  return (
    typeId !== null &&
    typeId !== undefined &&
    Number(typeId) === Number(BikkieIds.dMucker)
  );
}
