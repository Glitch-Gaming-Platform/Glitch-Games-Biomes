// CHAPTER_1_ENCOUNTER_SCHEDULER_LEASE
//
// A Chapter 1 encounter tick is not idempotent: two web replicas can apply
// hazard damage, recovery warps, or boss-loop changes twice. Keep the lease
// primitive dependency-light so its ownership semantics run in the fast suite.

export const CH1_ENCOUNTER_SCHEDULER_LEASE_KEY =
  "harthmere:ch1:encounter-scheduler:leader";
export const CH1_ENCOUNTER_SCHEDULER_LEASE_MS = 5_000;

export interface Chapter1EncounterSchedulerLeaseRedis {
  primary: {
    set(...args: any[]): Promise<unknown>;
    eval?(...args: any[]): Promise<unknown>;
  };
}

const REFRESH_IF_OWNER_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
end
return 0
`;

/** Refresh the lease only when the stored owner token still matches. */
export async function refreshChapter1EncounterSchedulerLease(
  redis: Chapter1EncounterSchedulerLeaseRedis,
  ownerId: string
): Promise<boolean> {
  if (!redis.primary.eval) {
    // Never fall back to SET XX: that would replace another replica's token.
    return false;
  }
  const refreshed = await redis.primary.eval(
    REFRESH_IF_OWNER_SCRIPT,
    1,
    CH1_ENCOUNTER_SCHEDULER_LEASE_KEY,
    ownerId,
    String(CH1_ENCOUNTER_SCHEDULER_LEASE_MS)
  );
  return Number(refreshed) === 1;
}

/** Acquire an expired/free lease, or atomically refresh this owner's lease. */
export async function holdsChapter1EncounterSchedulerLease(
  redis: Chapter1EncounterSchedulerLeaseRedis,
  ownerId: string
): Promise<boolean> {
  const acquired = await redis.primary.set(
    CH1_ENCOUNTER_SCHEDULER_LEASE_KEY,
    ownerId,
    "PX",
    CH1_ENCOUNTER_SCHEDULER_LEASE_MS,
    "NX"
  );
  if (acquired) {
    return true;
  }
  return refreshChapter1EncounterSchedulerLease(redis, ownerId);
}
