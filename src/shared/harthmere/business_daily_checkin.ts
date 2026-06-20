// BUSINESS_DAILY_CHECKIN
//
// Daily check-in economy for a business a player owns. Checking in once a day
// grants a flat gold bonus and keeps the business at full revenue. Every full
// day skipped cuts the business's revenue, and the cut ACCELERATES the longer it
// is neglected (base 20% per missed day, plus an extra 5% per consecutive missed
// day), eventually pushing the business into outright losses. Players are shown
// how much they've MADE by checking in vs how much they've LOST to neglect, to
// reward the daily habit.
//
// Pure + node-safe so it can be unit-tested and shared by client and server. The
// caller supplies an integer day index (see harthmereDayIndex on the client);
// time is never read here.

export const BUSINESS_CHECKIN_REWARD_GOLD = 500;
// Revenue cut for the first missed day.
export const BUSINESS_NEGLECT_BASE_PENALTY = 0.2;
// Extra cut added for each additional consecutive missed day (the acceleration).
export const BUSINESS_NEGLECT_ACCELERATION = 0.05;
// Worst-case revenue factor: a fully-neglected business can lose up to 2x its
// base daily revenue before the loss stops accelerating.
export const BUSINESS_NEGLECT_FACTOR_FLOOR = -2.0;

export interface BusinessDailyCheckInState {
  // Integer day index of the last check-in (undefined = never checked in).
  lastCheckInDay?: number;
  // Consecutive days checked in.
  currentStreak: number;
  longestStreak: number;
  // Cumulative gold earned from check-in bonuses ("made by checking in").
  totalGoldFromCheckIns: number;
  // Cumulative revenue lost to neglected days ("lost by not checking in").
  totalRevenueLostToNeglect: number;
}

export function initBusinessDailyCheckInState(): BusinessDailyCheckInState {
  return {
    lastCheckInDay: undefined,
    currentStreak: 0,
    longestStreak: 0,
    totalGoldFromCheckIns: 0,
    totalRevenueLostToNeglect: 0,
  };
}

// Number of FULL days skipped without a check-in (the days strictly between the
// last check-in and today). Checking in the very next day = 0 (no penalty); the
// player always has the current day to check in before it counts as missed.
export function businessMissedDays(
  state: Pick<BusinessDailyCheckInState, "lastCheckInDay">,
  todayDay: number
): number {
  if (
    state.lastCheckInDay === undefined ||
    !Number.isFinite(state.lastCheckInDay) ||
    !Number.isFinite(todayDay)
  ) {
    return 0;
  }
  return Math.max(0, Math.floor(todayDay) - Math.floor(state.lastCheckInDay) - 1);
}

// Cumulative penalty fraction after `d` missed days (base*d + accel*triangular).
function cumulativeNeglectPenalty(d: number): number {
  if (d <= 0) {
    return 0;
  }
  return (
    BUSINESS_NEGLECT_BASE_PENALTY * d +
    (BUSINESS_NEGLECT_ACCELERATION * (d * (d - 1))) / 2
  );
}

// Revenue multiplier given the number of missed days. 1.0 when not neglected;
// drops by an accelerating amount each missed day; goes negative (losses) once
// the cumulative penalty exceeds 1, floored at BUSINESS_NEGLECT_FACTOR_FLOOR.
//   missed 0 -> 1.00, 1 -> 0.80, 2 -> 0.55, 3 -> 0.25, 4 -> -0.10, 5 -> -0.50, ...
export function businessNeglectRevenueFactor(missedDays: number): number {
  if (!Number.isFinite(missedDays) || missedDays <= 0) {
    return 1;
  }
  const factor = 1 - cumulativeNeglectPenalty(Math.floor(missedDays));
  return Math.max(BUSINESS_NEGLECT_FACTOR_FLOOR, factor);
}

// Revenue lost across `missedDays` neglected days for a given base daily revenue
// (sum of the per-day shortfall, including days that ran at a loss).
export function businessNeglectRevenueLost(
  missedDays: number,
  baseDailyRevenue: number
): number {
  if (
    !Number.isFinite(missedDays) ||
    missedDays <= 0 ||
    !Number.isFinite(baseDailyRevenue) ||
    baseDailyRevenue <= 0
  ) {
    return 0;
  }
  let lost = 0;
  const days = Math.floor(missedDays);
  for (let k = 1; k <= days; k += 1) {
    lost += (1 - businessNeglectRevenueFactor(k)) * baseDailyRevenue;
  }
  return lost;
}

export interface BusinessCheckInResult {
  state: BusinessDailyCheckInState;
  // True when this call actually recorded a check-in (false if already done today).
  checkedIn: boolean;
  goldGranted: number;
  // Revenue lost during the gap that just ended (added to the running total).
  revenueLostThisGap: number;
  missedDays: number;
  streak: number;
}

// Record a check-in for `todayDay`. Grants the gold bonus, banks the revenue lost
// over any skipped days, and updates the streak (continues if the previous
// check-in was within the daily window, otherwise resets to 1). A second check-in
// on the same day is a no-op.
export function processBusinessCheckIn(
  state: BusinessDailyCheckInState,
  todayDay: number,
  baseDailyRevenue: number
): BusinessCheckInResult {
  const day = Math.floor(todayDay);
  if (state.lastCheckInDay !== undefined && day === Math.floor(state.lastCheckInDay)) {
    return {
      state,
      checkedIn: false,
      goldGranted: 0,
      revenueLostThisGap: 0,
      missedDays: 0,
      streak: state.currentStreak,
    };
  }
  const missedDays = businessMissedDays(state, day);
  const revenueLostThisGap = businessNeglectRevenueLost(
    missedDays,
    baseDailyRevenue
  );
  const continued = state.lastCheckInDay !== undefined && missedDays === 0;
  const streak = continued ? state.currentStreak + 1 : 1;
  const next: BusinessDailyCheckInState = {
    lastCheckInDay: day,
    currentStreak: streak,
    longestStreak: Math.max(state.longestStreak, streak),
    totalGoldFromCheckIns:
      state.totalGoldFromCheckIns + BUSINESS_CHECKIN_REWARD_GOLD,
    totalRevenueLostToNeglect:
      state.totalRevenueLostToNeglect + revenueLostThisGap,
  };
  return {
    state: next,
    checkedIn: true,
    goldGranted: BUSINESS_CHECKIN_REWARD_GOLD,
    revenueLostThisGap,
    missedDays,
    streak,
  };
}

export interface BusinessCheckInStatus {
  checkedInToday: boolean;
  missedDays: number;
  currentRevenueFactor: number;
  // Extra revenue that would be lost if the player skips today as well.
  revenueLostIfSkipToday: number;
  currentStreak: number;
  longestStreak: number;
  // "Made by checking in" vs "lost by not checking in", for the streak display.
  totalGoldFromCheckIns: number;
  totalRevenueLostToNeglect: number;
}

// Snapshot of the check-in state for display, given today and the base revenue.
export function businessCheckInStatus(
  state: BusinessDailyCheckInState,
  todayDay: number,
  baseDailyRevenue: number
): BusinessCheckInStatus {
  const day = Math.floor(todayDay);
  const checkedInToday =
    state.lastCheckInDay !== undefined && day === Math.floor(state.lastCheckInDay);
  const missedDays = businessMissedDays(state, day);
  // If they skip today, today becomes another missed day.
  const revenueLostIfSkipToday =
    businessNeglectRevenueLost(missedDays + 1, baseDailyRevenue) -
    businessNeglectRevenueLost(missedDays, baseDailyRevenue);
  return {
    checkedInToday,
    missedDays,
    currentRevenueFactor: businessNeglectRevenueFactor(missedDays),
    revenueLostIfSkipToday,
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    totalGoldFromCheckIns: state.totalGoldFromCheckIns,
    totalRevenueLostToNeglect: state.totalRevenueLostToNeglect,
  };
}
