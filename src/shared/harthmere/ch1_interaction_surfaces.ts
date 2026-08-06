// CHAPTER_1_INTERACTION_SURFACES
//
// A small shared authority for Chapter 1 steps that intentionally delegate to
// an existing game surface instead of owning a normal world-space F prompt.
// Keeping this in one client/server-safe module prevents the HUD, server range
// validation, and delegated UI from disagreeing about who owns the step.

export const CH1_RECOVERED_TAB_STEP_ID = "open_the_tab" as const;
export const CH1_JOBS_BOARD_STEP_ID = "take_jobs" as const;

export const CH1_GROVE_JOB_TEMPLATE_IDS = [
  "town_gather_road_rations",
  "town_repair_fence",
  "town_cleanup_muck_patch",
] as const;

const CH1_GROVE_JOB_TEMPLATE_ID_SET = new Set<string>(
  CH1_GROVE_JOB_TEMPLATE_IDS
);

export type Ch1InteractionSurface =
  | "world"
  | "biomes_ui_recovered"
  | "jobs_board";

const CH1_NPC_INTERACTION_TRIGGERS = new Set([
  "talk_npc",
  "dialogue_choice",
]);

export function ch1InteractionSurfaceForStep(
  stepId: string | undefined
): Ch1InteractionSurface {
  if (stepId === CH1_RECOVERED_TAB_STEP_ID) return "biomes_ui_recovered";
  if (stepId === CH1_JOBS_BOARD_STEP_ID) return "jobs_board";
  return "world";
}

/**
 * One shared answer for every route into an NPC conversation.
 *
 * The global F dispatcher already gives an active Chapter 1 objective the
 * highest interaction priority. Mouse/overlay Talk enters through the stock
 * NPC modal instead, so that modal must make the same ownership decision or a
 * normal quest/default-dialog surface can leak through during the story.
 */
export function ch1ObjectiveOwnsNpcInteraction(
  objective:
    | {
        authoredStepId?: string;
        targetEntityId?: number;
        trigger?: string;
      }
    | undefined,
  npcEntityId: number
): boolean {
  return Boolean(
    objective &&
      ch1InteractionSurfaceForStep(objective.authoredStepId) === "world" &&
      objective.targetEntityId !== undefined &&
      Number(objective.targetEntityId) === Number(npcEntityId) &&
      objective.trigger &&
      CH1_NPC_INTERACTION_TRIGGERS.has(objective.trigger)
  );
}

export function isCh1GroveJobTemplateId(
  templateId: string | undefined
): boolean {
  return Boolean(templateId && CH1_GROVE_JOB_TEMPLATE_ID_SET.has(templateId));
}

export function isCh1GroveJobPosting(job: {
  templateId?: string;
  townId?: string;
  issuerKind?: string;
  issuerId?: string;
  autoPosted?: boolean;
}): boolean {
  return (
    isCh1GroveJobTemplateId(job.templateId) &&
    job.townId === "harthmere_grove" &&
    job.issuerKind === "town" &&
    job.issuerId === "harthmere_grove" &&
    job.autoPosted === true
  );
}

export function countDistinctCompletedCh1GroveJobs(
  jobs: ReadonlyArray<{
    acceptedByActorId?: string;
    townId?: string;
    issuerKind?: string;
    issuerId?: string;
    autoPosted?: boolean;
    templateId?: string;
    status?: string;
    completedAtMs?: number;
  }>,
  actorId: string,
  startedAtMs: number
): number {
  return new Set(
    jobs.flatMap((job) =>
      job.acceptedByActorId === actorId &&
      isCh1GroveJobPosting(job) &&
      job.status === "completed" &&
      Number(job.completedAtMs ?? 0) >= startedAtMs
        ? [job.templateId!]
        : []
    )
  ).size;
}
