import { BikkieIds } from "@/shared/bikkie/ids";
import { isHarthmereNonLivingObjectLabelV1 } from "@/shared/harthmere/object_interaction_semantics_v1";
import type { BiomesId } from "@/shared/ids";

export function isHarthmereNonLivingDialogueObjectLabelV1(input: {
  label?: string | null;
  entityDescription?: string | null;
}) {
  return isHarthmereNonLivingObjectLabelV1(input);
}

// HARTHMERE_COMBAT_CREATURE_NOT_TALKABLE_V1:
// Muckers, hexers, and the huntable wildlife (cows/sheep/rabbits) are ALL seeded
// with the single shared `dMucker` damageable-creature NPC type (see
// live_entity_ecs_seed_v1.ts — `monsterTypeId`). They are combat targets you
// attack, never conversational NPCs. The seed strips their `default_dialog` to
// suppress the "F: Talk" prompt, but the talk gate also treats an
// `entity_description` as a talk signal — and these creatures carry a flavour
// description — so they were still wrongly talkable. Their npc type is the only
// reliable, label-independent discriminator, so gate talkability on it here.
export function isHarthmereCombatCreatureNpcTypeV1(
  typeId: BiomesId | number | null | undefined
): boolean {
  return (
    typeId !== null &&
    typeId !== undefined &&
    Number(typeId) === Number(BikkieIds.dMucker)
  );
}
