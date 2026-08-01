import type { HarthmereCinematicExpression } from "@/shared/cutscene/cinematic_expressions";

export type HarthmereDialogueExpressionSource =
  | "compendium"
  | "additive_town"
  | "grove_ambient"
  | "grove_quest";

export interface HarthmereDialogueExpressionRecord {
  textKey: string;
  expression: HarthmereCinematicExpression;
  source: HarthmereDialogueExpressionSource;
  actorKey: string;
  actorDisplayName: string;
  actorEntityOffset: number;
  dialogueKey: string;
  field: string;
}
