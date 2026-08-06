// CHAPTER_1_INTERACTION_SURFACES
//
// A small shared authority for Chapter 1 steps that intentionally delegate to
// an existing game surface instead of owning a normal world-space F prompt.
// Keeping this in one client/server-safe module prevents the HUD, server range
// validation, and delegated UI from disagreeing about who owns the step.

export const CH1_RECOVERED_TAB_STEP_ID = "open_the_tab" as const;
export const CH1_JOBS_BOARD_STEP_ID = "take_jobs" as const;
export const CH1_GROVE_SUPPLIERS_STEP_ID = "meet_the_suppliers" as const;

const CH1_DYNAMIC_ROUTE_DESTINATION_STEP_IDS = new Set<string>([
  "collect_testimonies",
  "the_three_answers",
  CH1_GROVE_SUPPLIERS_STEP_ID,
]);

export const CH1_GROVE_JOB_TEMPLATE_IDS = [
  "town_gather_road_rations",
  "town_repair_fence",
  "town_cleanup_muck_patch",
] as const;

const CH1_GROVE_JOB_TEMPLATE_ID_SET = new Set<string>(
  CH1_GROVE_JOB_TEMPLATE_IDS
);

export type Ch1InteractionSurface =
  "world" | "biomes_ui_recovered" | "jobs_board";

const CH1_NPC_INTERACTION_TRIGGERS = new Set(["talk_npc", "dialogue_choice"]);

export function ch1InteractionSurfaceForStep(
  stepId: string | undefined
): Ch1InteractionSurface {
  if (stepId === CH1_RECOVERED_TAB_STEP_ID) return "biomes_ui_recovered";
  if (stepId === CH1_JOBS_BOARD_STEP_ID) return "jobs_board";
  return "world";
}

/**
 * These objectives keep one native trigger leaf active while their exact
 * destination advances through several people. The ordinary native quest
 * marker is therefore only a generic step anchor; map, minimap and HUD
 * guidance must consume the authenticated Chapter 1 target instead.
 */
export function ch1ObjectiveUsesDynamicRouteDestination(
  stepId: string | undefined
) {
  return Boolean(stepId && CH1_DYNAMIC_ROUTE_DESTINATION_STEP_IDS.has(stepId));
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

/**
 * Supplier visits deliberately leave the vendor transaction in control of F,
 * but opening the stock NPC talk modal must still show the Chapter 1 trade
 * instruction instead of tutorials, helper quests, or ambient chatter.
 */
export function ch1ObjectiveDelegatesToNpcTrade(
  objective:
    | {
        authoredStepId?: string;
        targetEntityId?: number;
      }
    | undefined,
  npcEntityId: number
): boolean {
  return Boolean(
    objective?.authoredStepId === CH1_GROVE_SUPPLIERS_STEP_ID &&
    objective.targetEntityId !== undefined &&
    Number(objective.targetEntityId) === Number(npcEntityId)
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
