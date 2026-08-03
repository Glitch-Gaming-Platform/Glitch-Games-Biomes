import type { HarthmereCinematicExpression } from "@/shared/cutscene/cinematic_expressions";

export type HarthmereDialogueExpressionSource =
  | "compendium"
  | "additive_town"
  | "grove_ambient"
  | "grove_quest"
  | "native_quest";

export interface HarthmereDialogueExpressionRecord {
  textKey: string;
  expression: HarthmereCinematicExpression;
  source: HarthmereDialogueExpressionSource;
  actorKey: string;
  actorDisplayName: string;
  actorEntityOffset?: number;
  actorEntityId?: number;
  textTemplate?: string;
  dialogueStepId?: number;
  dialogueKey: string;
  field: string;
}
