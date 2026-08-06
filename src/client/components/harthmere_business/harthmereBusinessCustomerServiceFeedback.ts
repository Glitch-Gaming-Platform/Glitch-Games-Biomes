import type {
  HarthmereBusinessCustomerSession,
  HarthmereBusinessCustomerStats,
} from "@/shared/harthmere/business_customer_simulator";

export interface HarthmereBusinessCustomerServiceFeedback {
  correct: boolean;
  goldEarned: number;
  progressPointsEarned: number;
  serviceXpEarned: number;
  likeabilityDelta: number;
  satisfactionDelta: number;
  collectiblesEarned: string[];
  decorationUnlocks: string[];
  badgesEarned: string[];
  message: string;
}

function positiveDelta(after: number | undefined, before: number | undefined) {
  return Math.max(0, (after ?? 0) - (before ?? 0));
}

function newValues(
  after: readonly string[] = [],
  before: readonly string[] = []
) {
  const previous = new Set(before);
  return after.filter((value) => !previous.has(value));
}

function playerLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function createHarthmereBusinessCustomerServiceFeedback(input: {
  customerName: string;
  ticketId: string;
  selectedOfferLabel: string;
  expectedOfferLabel: string;
  beforeSession: HarthmereBusinessCustomerSession;
  afterSession: HarthmereBusinessCustomerSession;
  beforeStats?: HarthmereBusinessCustomerStats;
  afterStats?: HarthmereBusinessCustomerStats;
}): HarthmereBusinessCustomerServiceFeedback {
  const ticket = input.afterSession.queue.find(
    (candidate) => candidate.ticketId === input.ticketId
  );
  const correct = ticket?.status === "served";
  const goldEarned = positiveDelta(
    input.afterSession.earnedGold,
    input.beforeSession.earnedGold
  );
  const progressPointsEarned = positiveDelta(
    input.afterSession.progressPoints,
    input.beforeSession.progressPoints
  );
  const serviceXpEarned = positiveDelta(
    input.afterStats?.serviceXp,
    input.beforeStats?.serviceXp
  );
  const likeabilityDelta =
    (input.afterStats?.likeability ?? 0) -
    (input.beforeStats?.likeability ?? 0);
  const satisfactionDelta =
    input.afterSession.satisfaction - input.beforeSession.satisfaction;
  const collectiblesEarned = newValues(
    input.afterStats?.collectiblesEarned,
    input.beforeStats?.collectiblesEarned
  );
  const decorationUnlocks = newValues(
    input.afterStats?.decorationUnlocks,
    input.beforeStats?.decorationUnlocks
  );
  const badgesEarned = newValues(
    input.afterStats?.badges,
    input.beforeStats?.badges
  );

  const rewards = [
    `${goldEarned} gold`,
    `${progressPointsEarned} business ${progressPointsEarned === 1 ? "point" : "points"}`,
    `${serviceXpEarned} service XP`,
    ...(likeabilityDelta
      ? [`${likeabilityDelta > 0 ? "+" : ""}${likeabilityDelta} likeability`]
      : []),
    ...collectiblesEarned.map((value) => `collectible: ${playerLabel(value)}`),
    ...decorationUnlocks.map((value) => `decor: ${playerLabel(value)}`),
    ...badgesEarned.map((value) => `badge: ${playerLabel(value)}`),
  ];

  return {
    correct,
    goldEarned,
    progressPointsEarned,
    serviceXpEarned,
    likeabilityDelta,
    satisfactionDelta,
    collectiblesEarned,
    decorationUnlocks,
    badgesEarned,
    message: correct
      ? `Correct! ${input.customerName} received ${input.expectedOfferLabel}. You earned ${rewards.join(", ")}.`
      : `Incorrect. ${input.customerName} needed ${input.expectedOfferLabel}, but you chose ${input.selectedOfferLabel}. You earned 0 gold and 0 business points. Customer satisfaction ${satisfactionDelta >= 0 ? "+" : ""}${satisfactionDelta}.`,
  };
}
