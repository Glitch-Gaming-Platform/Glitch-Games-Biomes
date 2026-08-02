import { BikkieIds } from "@/shared/bikkie/ids";
import { isHarthmereNonLivingObjectLabel } from "@/shared/harthmere/object_interaction_semantics";
import { harthmereNativeNpcCombatProfileForTypeId } from "@/shared/harthmere/harthmere_native_combat_catalog";
import type { BiomesId } from "@/shared/ids";

export function isHarthmereNonLivingDialogueObjectLabel(input: {
  label?: string | null;
  entityDescription?: string | null;
  hasNpcMetadata?: boolean;
}) {
  // ECS NPC identity is stronger evidence than prose. Snapshot NPC roles such
  // as Helsa's "night lamp keeper" legitimately contain object nouns; treating
  // that description as a lamp suppresses Talk and sends an invalid Inspect
  // receipt for the NPC entity instead.
  if (input.hasNpcMetadata) {
    return false;
  }
  return isHarthmereNonLivingObjectLabel(input);
}

export function shouldUseHarthmereCursorObjectSemantics(input: {
  canTalk: boolean;
  isNativeDialogueQuestObject: boolean;
  canUseObjectSemantics: boolean;
}) {
  return (
    !input.canTalk &&
    !input.isNativeDialogueQuestObject &&
    input.canUseObjectSemantics
  );
}

// HARTHMERE_COMBAT_CREATURE_NOT_TALKABLE:
// Exact native combat types are combat targets, never conversational NPCs. The
// legacy dMucker check remains only for pre-migration worlds while the seed
// reconciler replaces those entities with exact type ids.
export function isHarthmereCombatCreatureNpcType(
  typeId: BiomesId | number | null | undefined
): boolean {
  if (typeId === null || typeId === undefined) return false;
  const id = Number(typeId) as BiomesId;
  return (
    Number(id) === Number(BikkieIds.dMucker) ||
    Boolean(harthmereNativeNpcCombatProfileForTypeId(id))
  );
}
