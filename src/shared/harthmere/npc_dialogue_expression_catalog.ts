import { HARTHMERE_DIALOGUE_EXPRESSION_RECORDS } from "@/shared/harthmere/generated/npc_dialogue_expression_catalog";
import {
  harthmereDialogueExpressionTextKey,
  normalizeHarthmereDialogueExpressionText,
} from "@/shared/harthmere/npc_dialogue_expression_text_key";
import type { HarthmereDialogueExpressionRecord } from "@/shared/harthmere/npc_dialogue_expression_types";
import { snapshotGroveNpcEntityIdsEquivalent } from "@/shared/harthmere/snapshot_grove_ids";

const HARTHMERE_LOCAL_NPC_ID_BASE = 8_810_000_000_010_000;

const DIALOGUE_EXPRESSION_RECORDS =
  HARTHMERE_DIALOGUE_EXPRESSION_RECORDS as readonly HarthmereDialogueExpressionRecord[];

const RECORDS_BY_TEXT_KEY = new Map<
  string,
  HarthmereDialogueExpressionRecord[]
>();
for (const record of DIALOGUE_EXPRESSION_RECORDS) {
  const matches = RECORDS_BY_TEXT_KEY.get(record.textKey) ?? [];
  matches.push(record);
  RECORDS_BY_TEXT_KEY.set(record.textKey, matches);
}

const TEMPLATE_RECORDS = DIALOGUE_EXPRESSION_RECORDS.filter(
  (record) => record.textTemplate !== undefined
);

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function templateRegex(template: string): RegExp {
  const parts = template.split(/(\{username\}|\{robotName\})/g);
  return new RegExp(
    `^${parts
      .map((part) =>
        part === "{username}" || part === "{robotName}"
          ? ".+?"
          : escapeRegex(part)
      )
      .join("")}$`
  );
}

const TEMPLATE_REGEX_BY_TEXT = new Map(
  TEMPLATE_RECORDS.map((record) => [
    record.textTemplate!,
    templateRegex(record.textTemplate!),
  ])
);

function numericDialogueStepId(value: string | number | undefined) {
  const match = String(value ?? "").match(/^\d+/);
  if (!match) return undefined;
  const numeric = Number(match[0]);
  return Number.isSafeInteger(numeric) ? numeric : undefined;
}

function actorMatches(
  record: HarthmereDialogueExpressionRecord,
  actor: { entityId: number; title: string }
) {
  if (record.actorEntityId !== undefined) {
    return snapshotGroveNpcEntityIdsEquivalent(
      actor.entityId,
      record.actorEntityId
    );
  }
  const entityOffset = actor.entityId - HARTHMERE_LOCAL_NPC_ID_BASE;
  const normalizedTitle = actor.title.trim().toLocaleLowerCase();
  const normalizedDisplayName = record.actorDisplayName
    .trim()
    .toLocaleLowerCase();
  return (
    entityOffset === record.actorEntityOffset ||
    normalizedTitle === normalizedDisplayName
  );
}

function dialogueStepMatches(
  record: HarthmereDialogueExpressionRecord,
  dialogueId: string | number | undefined
) {
  return (
    record.dialogueStepId === undefined ||
    numericDialogueStepId(dialogueId) === record.dialogueStepId
  );
}

export const HARTHMERE_DIALOGUE_EXPRESSION_RECORD_COUNT =
  DIALOGUE_EXPRESSION_RECORDS.length;

export function harthmereDialogueExpressionForText(
  text: string | undefined,
  actor?: {
    entityId: number;
    title: string;
    dialogueId?: string | number;
  }
): HarthmereDialogueExpressionRecord | undefined {
  if (!text?.trim()) {
    return undefined;
  }
  const exactRecords =
    RECORDS_BY_TEXT_KEY.get(harthmereDialogueExpressionTextKey(text)) ?? [];
  const record = actor
    ? (exactRecords.find(
        (candidate) =>
          actorMatches(candidate, actor) &&
          dialogueStepMatches(candidate, actor.dialogueId)
      ) ??
      TEMPLATE_RECORDS.find((candidate) => {
        if (
          !candidate.textTemplate ||
          !actorMatches(candidate, actor) ||
          !dialogueStepMatches(candidate, actor.dialogueId)
        ) {
          return false;
        }
        return TEMPLATE_REGEX_BY_TEXT.get(candidate.textTemplate)?.test(
          normalizeHarthmereDialogueExpressionText(text)
        );
      }))
    : exactRecords[0];
  if (!record || !actor) {
    return record;
  }
  return actorMatches(record, actor) ? record : undefined;
}
