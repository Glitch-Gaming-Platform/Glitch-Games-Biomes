import { HARTHMERE_DIALOGUE_EXPRESSION_RECORDS } from "@/shared/harthmere/generated/npc_dialogue_expression_catalog";
import { harthmereDialogueExpressionTextKey } from "@/shared/harthmere/npc_dialogue_expression_text_key";
import type { HarthmereDialogueExpressionRecord } from "@/shared/harthmere/npc_dialogue_expression_types";

const HARTHMERE_LOCAL_NPC_ID_BASE = 8_810_000_000_010_000;

const RECORD_BY_TEXT_KEY = new Map<string, HarthmereDialogueExpressionRecord>(
  HARTHMERE_DIALOGUE_EXPRESSION_RECORDS.map((record) => [
    record.textKey,
    record,
  ])
);

export const HARTHMERE_DIALOGUE_EXPRESSION_RECORD_COUNT =
  HARTHMERE_DIALOGUE_EXPRESSION_RECORDS.length;

export function harthmereDialogueExpressionForText(
  text: string | undefined,
  actor?: { entityId: number; title: string }
): HarthmereDialogueExpressionRecord | undefined {
  if (!text?.trim()) {
    return undefined;
  }
  const record = RECORD_BY_TEXT_KEY.get(
    harthmereDialogueExpressionTextKey(text)
  );
  if (!record || !actor) {
    return record;
  }
  const entityOffset = actor.entityId - HARTHMERE_LOCAL_NPC_ID_BASE;
  const normalizedTitle = actor.title.trim().toLocaleLowerCase();
  const normalizedDisplayName = record.actorDisplayName
    .trim()
    .toLocaleLowerCase();
  return entityOffset === record.actorEntityOffset ||
    normalizedTitle === normalizedDisplayName
    ? record
    : undefined;
}
