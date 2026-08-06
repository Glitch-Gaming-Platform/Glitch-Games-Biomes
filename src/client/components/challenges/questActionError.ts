export type HarthmereQuestAction = "accept" | "update" | "invite";

export interface HarthmereQuestActionErrorContext {
  action?: HarthmereQuestAction;
  questTitle?: string;
  minimumLevel?: number;
}

const QUEST_REJECTION_PREFIXES = [
  "bible_quest_rejected:",
  "thaedryn_rejected:",
  "live_entity_helper_rejected:",
  "quest_rejected:",
  "snapshot_grove_quest_rejected:",
  "jobs_board_rejected:",
  "quest_invite_rejected:",
  "quest_invite_response_rejected:",
] as const;

export function isHarthmereQuestRejectionWarning(value: unknown): boolean {
  const warning = String(value ?? "");
  return QUEST_REJECTION_PREFIXES.some((prefix) => warning.startsWith(prefix));
}

export function harthmereQuestRejectionWarningsFromResponse(body: any) {
  const warnings = [
    ...(Array.isArray(body?.validation?.errors) ? body.validation.errors : []),
    ...(Array.isArray(body?.validation?.warnings)
      ? body.validation.warnings
      : []),
    ...(Array.isArray(body?.backendMutation?.warnings)
      ? body.backendMutation.warnings
      : []),
    ...(Array.isArray(body?.warnings) ? body.warnings : []),
    body?.error,
  ].map(String);
  return [...new Set(warnings.filter(isHarthmereQuestRejectionWarning))];
}

function rejectionReason(warning: string) {
  const prefix = QUEST_REJECTION_PREFIXES.find((candidate) =>
    warning.startsWith(candidate)
  );
  return prefix ? warning.slice(prefix.length).split(":")[0] : warning;
}

function questName(context: HarthmereQuestActionErrorContext) {
  return context.questTitle ? ` “${context.questTitle}”` : "";
}

function defaultMessage(context: HarthmereQuestActionErrorContext) {
  switch (context.action) {
    case "invite":
      return "That quest invite is not available right now.";
    case "update":
      return `That quest${questName(context)} could not be updated. Please try again.`;
    default:
      return `That quest${questName(context)} cannot be accepted right now.`;
  }
}

function playerMessageForReason(
  reason: string,
  context: HarthmereQuestActionErrorContext
) {
  const namedQuest = questName(context);
  switch (reason) {
    case "player_level_below_minimum":
      return context.minimumLevel
        ? `Reach level ${context.minimumLevel} before accepting${namedQuest}.`
        : `You need a higher level before accepting${namedQuest}.`;
    case "player_far_above_soft_maximum":
      return `That quest${namedQuest} is intended for lower-level players and is no longer available.`;
    case "missing_prerequisite":
      return `Finish the required earlier quest before accepting${namedQuest}.`;
    case "missing_flag":
      return `You have not unlocked that quest${namedQuest} yet.`;
    case "wrong_time_of_day":
    case "wrong_hour":
      return `That quest${namedQuest} is not available at this time of day.`;
    case "wrong_weather":
      return `That quest${namedQuest} is not available in the current weather.`;
    case "already_completed_once":
    case "already_completed":
    case "quest_completed":
    case "quest_already_completed":
      return `You have already completed that quest${namedQuest}.`;
    case "cadence_cooldown":
      return `That quest${namedQuest} is not available again yet.`;
    case "accept_cooldown":
      return "You can accept another job in a moment.";
    case "post_cooldown":
      return "You can post another job in a moment.";
    case "already_in_progress":
      return `That quest${namedQuest} is already active.`;
    case "seeker_active_job_limit":
      return "Finish or cancel an active job before accepting another one.";
    case "chapter1_active_job_limit":
      return "You already have all three Chapter 1 Grove jobs. Complete them, then return to this board.";
    case "cannot_accept_own_job":
      return "You cannot accept a job that you posted yourself.";
    case "job_expired":
    case "job_not_open":
    case "job_not_found":
    case "not_found":
      return context.action === "invite"
        ? "That quest invite is no longer available."
        : `That quest${namedQuest} is no longer available.`;
    case "wrong_board":
    case "must_be_at_jobs_board":
      return "Go to the correct Jobs Board before accepting that job.";
    case "native_actor_position_required":
      return "Move closer to the Jobs Board and try again.";
    case "player_too_far":
    case "not_nearby":
    case "proximity_unverified":
    case "server_entity_context_required":
      return context.action === "invite"
        ? "Move closer to that player and try again."
        : "Move closer to the quest giver or objective and try again.";
    case "ineligible_entity":
      return "This character cannot offer that quest.";
    case "active_quest_required":
      return "Accept the quest before trying to complete it.";
    case "boss_defeat_required":
      return "Defeat the quest target before turning this quest in.";
    case "quest_required":
    case "missing_quest":
    case "unknown_quest":
      return "That quest is no longer available.";
    case "required_item":
      return "You do not have the item required for that quest action.";
    case "inventory_full":
      return "Your backpack is full. Free a slot and try again.";
    case "invitee_required":
      return "Choose a nearby player to invite.";
    case "self_invite":
      return "You cannot invite yourself to a quest.";
    case "already_shared":
      return "You are already sharing that quest with this player.";
    case "duplicate_pending":
      return "That player already has a pending invite for this quest.";
    case "not_invitee":
      return "That quest invite belongs to another player.";
    case "invite_required":
    case "response_required":
      return "That quest invite is no longer available.";
    case "network_error":
    case "request_failed":
      return "The quest service could not be reached. Please try again.";
    default:
      return defaultMessage(context);
  }
}

export function formatHarthmereQuestActionError(
  warnings: readonly string[],
  context: HarthmereQuestActionErrorContext = {}
) {
  const reasons = [...new Set(warnings.map(rejectionReason))];
  const messages = [
    ...new Set(
      reasons.map((reason) => playerMessageForReason(reason, context))
    ),
  ];
  return messages.length ? messages.join(" ") : defaultMessage(context);
}

export class HarthmereQuestActionError extends Error {
  readonly playerMessage: string;

  constructor(
    readonly warnings: string[],
    readonly context: HarthmereQuestActionErrorContext = {}
  ) {
    const playerMessage = formatHarthmereQuestActionError(warnings, context);
    super(playerMessage);
    this.name = "HarthmereQuestActionError";
    this.playerMessage = playerMessage;
  }
}

export function playerFacingQuestActionErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const playerMessage = (error as { playerMessage?: unknown }).playerMessage;
  return typeof playerMessage === "string" && playerMessage.trim()
    ? playerMessage.trim()
    : undefined;
}
