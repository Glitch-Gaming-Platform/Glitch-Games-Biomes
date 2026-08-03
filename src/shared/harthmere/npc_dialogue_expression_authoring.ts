// Authoring and generation helpers. Do not import this module from client
// runtime code: it intentionally loads the complete NPC dialogue corpus.

import { isHarthmereCinematicExpression } from "@/shared/cutscene/cinematic_expressions";
import { HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE } from "@/shared/harthmere/additive_town_npc_dialogue";
import { GROVE_QUEST_CATALOG } from "@/shared/harthmere/grove/grove_quest_catalog";
import { groveQuestGiverId } from "@/shared/harthmere/grove/grove_quest_schema";
import { HARTHMERE_ALL_NPCS } from "@/shared/harthmere/npc_compendium";
import { HARTHMERE_NATIVE_QUEST_DIALOGUE_EXPRESSION_EVENTS } from "@/shared/harthmere/native_quest_dialogue_expression_plan";
import {
  HARTHMERE_ADDITIVE_TOWN_DIALOGUE_EXPRESSION_PLAN,
  HARTHMERE_COMPENDIUM_DIALOGUE_EXPRESSION_PLAN,
  SNAPSHOT_GROVE_AMBIENT_DIALOGUE_EXPRESSION_PLAN,
  SNAPSHOT_GROVE_QUEST_DIALOGUE_EXPRESSION_PLAN,
  type HarthmereCompendiumDialogueExpressionTuple,
  type HarthmereThreeLineDialogueExpressionTuple,
} from "@/shared/harthmere/npc_dialogue_expression_plan";
import {
  harthmereDialogueExpressionTextKey,
  normalizeHarthmereDialogueExpressionText,
} from "@/shared/harthmere/npc_dialogue_expression_text_key";
import type { HarthmereDialogueExpressionRecord } from "@/shared/harthmere/npc_dialogue_expression_types";
import { SNAPSHOT_GROVE_NPCS } from "@/shared/harthmere/snapshot_grove_content";
import { SNAPSHOT_GROVE_AMBIENT_DIALOGUE } from "@/shared/harthmere/snapshot_grove_ambient_dialogue";

type CompendiumDialogue = {
  greeting: string;
  service: string;
  rumor: string;
  questOffer: string;
  farewell: string;
};

function assertExactKeys(
  label: string,
  sourceKeys: readonly (string | number)[],
  planKeys: readonly (string | number)[]
) {
  const source = new Set(sourceKeys.map(String));
  const plan = new Set(planKeys.map(String));
  const missing = [...source].filter((key) => !plan.has(key));
  const unknown = [...plan].filter((key) => !source.has(key));
  if (missing.length || unknown.length) {
    throw new Error(
      `${label} expression plan mismatch; missing=[${missing.join(
        ", "
      )}] unknown=[${unknown.join(", ")}]`
    );
  }
}

function addRecord(
  records: HarthmereDialogueExpressionRecord[],
  input: Omit<HarthmereDialogueExpressionRecord, "textKey"> & { text: string }
) {
  if (!isHarthmereCinematicExpression(input.expression)) {
    throw new Error(
      `Unknown dialogue expression ${String(input.expression)} for ${
        input.dialogueKey
      }.${input.field}`
    );
  }
  const normalizedText = normalizeHarthmereDialogueExpressionText(input.text);
  const textTemplate = /\{(?:username|robotName)\}/.test(normalizedText)
    ? normalizedText
    : undefined;
  records.push({
    textKey: harthmereDialogueExpressionTextKey(input.text),
    expression: input.expression,
    source: input.source,
    actorKey: input.actorKey,
    actorDisplayName: input.actorDisplayName,
    ...(input.actorEntityOffset !== undefined
      ? { actorEntityOffset: input.actorEntityOffset }
      : {}),
    ...(input.actorEntityId !== undefined
      ? { actorEntityId: input.actorEntityId }
      : {}),
    ...(textTemplate !== undefined ? { textTemplate } : {}),
    ...(input.dialogueStepId !== undefined
      ? { dialogueStepId: input.dialogueStepId }
      : {}),
    dialogueKey: input.dialogueKey,
    field: input.field,
  });
}

export function buildHarthmereDialogueExpressionRecords(): HarthmereDialogueExpressionRecord[] {
  const records: HarthmereDialogueExpressionRecord[] = [];
  const humanCompendium = HARTHMERE_ALL_NPCS.filter(
    (npc) => npc.kind === "humanoid"
  );
  assertExactKeys(
    "compendium",
    humanCompendium.map((npc) => npc.id),
    Object.keys(HARTHMERE_COMPENDIUM_DIALOGUE_EXPRESSION_PLAN)
  );
  const compendiumFields = [
    "greeting",
    "service",
    "rumor",
    "farewell",
  ] as const;
  for (const npc of humanCompendium) {
    const dialogue = npc.dialogue as CompendiumDialogue;
    const expressions = HARTHMERE_COMPENDIUM_DIALOGUE_EXPRESSION_PLAN[
      npc.id as keyof typeof HARTHMERE_COMPENDIUM_DIALOGUE_EXPRESSION_PLAN
    ] as HarthmereCompendiumDialogueExpressionTuple;
    compendiumFields.forEach((field, index) => {
      addRecord(records, {
        text: dialogue[field],
        expression: expressions[index],
        source: "compendium",
        actorKey: npc.id,
        actorDisplayName: npc.name,
        actorEntityOffset: npc.combatOffset,
        dialogueKey: npc.id,
        field,
      });
    });
  }

  assertExactKeys(
    "additive town",
    HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE.map((profile) => profile.offset),
    Object.keys(HARTHMERE_ADDITIVE_TOWN_DIALOGUE_EXPRESSION_PLAN)
  );
  const additiveFields = ["intro", "story", "location"] as const;
  for (const profile of HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE) {
    const expressions = HARTHMERE_ADDITIVE_TOWN_DIALOGUE_EXPRESSION_PLAN[
      profile.offset as keyof typeof HARTHMERE_ADDITIVE_TOWN_DIALOGUE_EXPRESSION_PLAN
    ] as HarthmereThreeLineDialogueExpressionTuple;
    additiveFields.forEach((field, index) => {
      const expression = expressions[index];
      if (profile.kind === "humanoid" && !expression) {
        throw new Error(
          `Human additive NPC ${profile.offset} is missing ${field} expression`
        );
      }
      if (profile.kind !== "humanoid" && expression) {
        throw new Error(
          `Non-human additive NPC ${profile.offset} has ${field} expression`
        );
      }
      if (expression) {
        addRecord(records, {
          text: profile[field],
          expression,
          source: "additive_town",
          actorKey: String(profile.offset),
          actorDisplayName: profile.displayName,
          actorEntityOffset: profile.offset,
          dialogueKey: String(profile.offset),
          field,
        });
      }
    });
  }

  assertExactKeys(
    "Grove ambient",
    Object.keys(SNAPSHOT_GROVE_AMBIENT_DIALOGUE),
    Object.keys(SNAPSHOT_GROVE_AMBIENT_DIALOGUE_EXPRESSION_PLAN)
  );
  for (const [npcId, lines] of Object.entries(
    SNAPSHOT_GROVE_AMBIENT_DIALOGUE
  )) {
    const groveNpc = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === npcId);
    if (!groveNpc) {
      throw new Error(`Missing Snapshot Grove NPC ${npcId}`);
    }
    const expressions = SNAPSHOT_GROVE_AMBIENT_DIALOGUE_EXPRESSION_PLAN[
      npcId as keyof typeof SNAPSHOT_GROVE_AMBIENT_DIALOGUE_EXPRESSION_PLAN
    ] as HarthmereThreeLineDialogueExpressionTuple;
    const nonHuman = npcId === "buddy" || npcId === "mucked_robot";
    lines.forEach((text, index) => {
      const expression = expressions[index];
      if (!nonHuman && !expression) {
        throw new Error(
          `Human Grove NPC ${npcId} is missing ambient expression ${index}`
        );
      }
      if (nonHuman && expression) {
        throw new Error(
          `Robot Grove NPC ${npcId} has ambient expression ${index}`
        );
      }
      if (expression) {
        addRecord(records, {
          text,
          expression,
          source: "grove_ambient",
          actorKey: npcId,
          actorDisplayName: groveNpc.displayName,
          actorEntityOffset: groveNpc.idOffset,
          dialogueKey: npcId,
          field: ["neutral", "familiar", "trusted"][index],
        });
      }
    });
  }

  assertExactKeys(
    "Grove quest",
    GROVE_QUEST_CATALOG.map((quest) => quest.id),
    Object.keys(SNAPSHOT_GROVE_QUEST_DIALOGUE_EXPRESSION_PLAN)
  );
  for (const quest of GROVE_QUEST_CATALOG) {
    const expression =
      SNAPSHOT_GROVE_QUEST_DIALOGUE_EXPRESSION_PLAN[
        quest.id as keyof typeof SNAPSHOT_GROVE_QUEST_DIALOGUE_EXPRESSION_PLAN
      ];
    const giverNpcId = groveQuestGiverId(quest);
    const giver = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === giverNpcId);
    if (!giver) {
      throw new Error(`Missing Snapshot Grove quest giver ${giverNpcId}`);
    }
    const nonHuman = giverNpcId === "buddy" || giverNpcId === "mucked_robot";
    if (!nonHuman && !expression) {
      throw new Error(`Human Grove quest ${quest.id} is missing an expression`);
    }
    if (nonHuman && expression) {
      throw new Error(`Robot Grove quest ${quest.id} has an expression`);
    }
    if (expression) {
      addRecord(records, {
        text: quest.sampleDialogue,
        expression,
        source: "grove_quest",
        actorKey: giverNpcId,
        actorDisplayName: giver.displayName,
        actorEntityOffset: giver.idOffset,
        dialogueKey: quest.id,
        field: "sampleDialogue",
      });
    }
  }

  const nativePages = new Map<
    string,
    { expression: string; questName: string; stepId: number; pageIndex: number }
  >();
  for (const event of HARTHMERE_NATIVE_QUEST_DIALOGUE_EXPRESSION_EVENTS) {
    event.pages.forEach(([text, expression], pageIndex) => {
      const normalizedText = normalizeHarthmereDialogueExpressionText(text);
      const identity = `${event.actor.entityId}:${normalizedText}`;
      const prior = nativePages.get(identity);
      if (prior) {
        if (prior.expression !== expression) {
          throw new Error(
            `Native quest page ${JSON.stringify(
              normalizedText
            )} has conflicting expressions ${prior.expression} and ${expression}`
          );
        }
        return;
      }
      nativePages.set(identity, {
        expression,
        questName: event.questName,
        stepId: event.stepId,
        pageIndex,
      });
      addRecord(records, {
        text,
        expression,
        source: "native_quest",
        actorKey: event.actor.key,
        actorDisplayName: event.actor.displayName,
        actorEntityId: event.actor.entityId,
        dialogueStepId: event.stepId,
        dialogueKey: `${event.questId}:${event.stepId}`,
        field: `page:${pageIndex}`,
      });
    });
  }

  const byTextKey = new Map<string, HarthmereDialogueExpressionRecord>();
  for (const record of records) {
    const prior = byTextKey.get(record.textKey);
    if (prior) {
      if (
        prior.textTemplate !== undefined &&
        prior.textTemplate === record.textTemplate
      ) {
        continue;
      }
      throw new Error(
        `Dialogue expression text-key collision ${record.textKey}: ${prior.dialogueKey}.${prior.field} and ${record.dialogueKey}.${record.field}`
      );
    }
    byTextKey.set(record.textKey, record);
  }
  return records;
}
