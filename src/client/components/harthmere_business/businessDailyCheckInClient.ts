// Client glue for the business daily check-in: turns a timestamp into the day
// index the shared mechanic expects, and builds the human-facing display model
// (streak + "made by checking in" vs "lost by not checking in"). Pure so it is
// unit-testable without the React panel.

import {
  BUSINESS_CHECKIN_REWARD_GOLD,
  type BusinessCheckInStatus,
} from "@/shared/harthmere/business_daily_checkin";

const MS_PER_DAY = 86_400_000;

// Integer day index (UTC) for a timestamp. The check-in resets each UTC day.
export function harthmereDayIndex(epochMs: number): number {
  if (!Number.isFinite(epochMs)) {
    return 0;
  }
  return Math.floor(epochMs / MS_PER_DAY);
}

export interface BusinessCheckInDisplay {
  checkedInToday: boolean;
  inLosses: boolean;
  streakLabel: string;
  revenueLabel: string;
  madeLabel: string;
  lostLabel: string;
  callToAction: string;
}

function roundGold(n: number): number {
  return Math.round(n);
}

export function businessCheckInDisplayModel(
  status: BusinessCheckInStatus
): BusinessCheckInDisplay {
  const pct = Math.round(status.currentRevenueFactor * 100);
  const inLosses = status.currentRevenueFactor < 0;
  const streakLabel =
    status.currentStreak > 0
      ? `${status.currentStreak}-day check-in streak (best ${Math.max(
          status.currentStreak,
          status.longestStreak
        )})`
      : "No active streak";
  const revenueLabel = inLosses
    ? `Neglected: revenue at ${pct}% — the business is losing money`
    : `Revenue at ${pct}%`;
  const madeLabel = `Made by checking in: ${roundGold(
    status.totalGoldFromCheckIns
  )} gold`;
  const lostLabel = `Lost by not checking in: ${roundGold(
    status.totalRevenueLostToNeglect
  )} gold`;
  let callToAction: string;
  if (status.checkedInToday) {
    callToAction = "Checked in today — come back tomorrow to keep the streak.";
  } else {
    const skipCost = roundGold(status.revenueLostIfSkipToday);
    callToAction =
      `Check in for ${BUSINESS_CHECKIN_REWARD_GOLD} gold.` +
      (skipCost > 0
        ? ` Skipping today costs about ${skipCost} more gold.`
        : "");
  }
  return {
    checkedInToday: status.checkedInToday,
    inLosses,
    streakLabel,
    revenueLabel,
    madeLabel,
    lostLabel,
    callToAction,
  };
}
