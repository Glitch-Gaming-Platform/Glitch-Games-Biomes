// HARTHMERE_LIVE_MODE_ACTOR_RESOLUTION_V1
//
// Server-side glue that turns the pure identity plan
// (live_mode_actor_identity_v1) into the single player_state actorId every
// live_mode_* handler should use. It transparently heals the install/user
// split-brain described in live_mode_actor_identity_v1.ts:
//   * install-only (pre-cookie) requests converge onto the linked user key,
//   * the install -> user link is recorded on the first authed sighting,
//   * an orphaned `install:` blob is adopted into an EMPTY user key (recovering
//     a stranded save without ever overwriting real data).
//
// All bookkeeping is best-effort: a Redis hiccup on the link/adoption path must
// never fail the underlying read, so every side effect is wrapped and swallowed.

import {
  HarthmereLiveModeActorRequestV1,
  harthmereLiveModeInstallGameUserLinkKeyV1,
  harthmereLiveModeInstallActorIdV1,
  harthmereLiveModeInstallLinkKeyV1,
  planHarthmereLiveModeActorKeyV1,
  resolveHarthmereLiveModeActorIdentityV1,
  shouldAdoptHarthmereInstallOrphanV1,
} from "@/shared/harthmere/live_mode_actor_identity_v1";
import { harthmereLiveModePlayerStateKeyV1 } from "@/shared/harthmere/live_mode_backend_v1";

export interface HarthmereActorResolutionRedisV1 {
  primary: {
    get: (key: string) => Promise<string | null>;
    set?: (key: string, value: string) => Promise<unknown>;
  };
}

function actorResolutionSetterV1(redis: HarthmereActorResolutionRedisV1) {
  return typeof redis.primary.set === "function"
    ? redis.primary.set.bind(redis.primary)
    : undefined;
}

async function readInstallLinkV1(
  redis: HarthmereActorResolutionRedisV1,
  key: string
): Promise<string | undefined> {
  try {
    const raw = await redis.primary.get(key);
    return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function writeInstallLinkV1(
  redis: HarthmereActorResolutionRedisV1,
  installId: string,
  userId: string
): Promise<void> {
  const set = actorResolutionSetterV1(redis);
  if (!set) {
    return;
  }
  try {
    await set(harthmereLiveModeInstallLinkKeyV1(installId), userId);
  } catch {
    // best effort — never fail the request because the link could not be saved.
  }
}

async function maybeAdoptInstallOrphanV1(
  redis: HarthmereActorResolutionRedisV1,
  installId: string,
  userId: string
): Promise<void> {
  const set = actorResolutionSetterV1(redis);
  if (!set) {
    return;
  }
  try {
    const userKey = harthmereLiveModePlayerStateKeyV1(userId);
    const installKey = harthmereLiveModePlayerStateKeyV1(
      harthmereLiveModeInstallActorIdV1(installId)
    );
    const [userStateRaw, installStateRaw] = await Promise.all([
      redis.primary.get(userKey),
      redis.primary.get(installKey),
    ]);
    if (
      shouldAdoptHarthmereInstallOrphanV1({ userStateRaw, installStateRaw }) &&
      typeof installStateRaw === "string"
    ) {
      // Copy the stranded blob verbatim; parseHarthmereLiveModeBackendStateV1
      // re-stamps the embedded actorId on read, so the user key surfaces under
      // the correct identity.
      await set(userKey, installStateRaw);
    }
  } catch {
    // best effort — adoption is opportunistic recovery, not a hard dependency.
  }
}

async function maybeAdoptLinkedActorBlobV1(
  redis: HarthmereActorResolutionRedisV1,
  fromActorId: string | undefined,
  toActorId: string | undefined
): Promise<void> {
  const set = actorResolutionSetterV1(redis);
  if (!set || !fromActorId || !toActorId || fromActorId === toActorId) {
    return;
  }
  try {
    const fromKey = harthmereLiveModePlayerStateKeyV1(fromActorId);
    const toKey = harthmereLiveModePlayerStateKeyV1(toActorId);
    const [toStateRaw, fromStateRaw] = await Promise.all([
      redis.primary.get(toKey),
      redis.primary.get(fromKey),
    ]);
    if (
      shouldAdoptHarthmereInstallOrphanV1({
        userStateRaw: toStateRaw,
        installStateRaw: fromStateRaw,
      }) &&
      typeof fromStateRaw === "string"
    ) {
      await set(toKey, fromStateRaw);
    }
  } catch {
    // best effort — link convergence must not make the read/write fail.
  }
}

// Resolve the player_state actorId for a live-mode request, healing the
// install/user split. Pass the same per-handler anonymous fallback string the
// old per-handler resolver used (e.g. "anonymous:building-reader").
export async function resolveHarthmereLiveModeActorIdV1(
  redis: HarthmereActorResolutionRedisV1,
  request: HarthmereLiveModeActorRequestV1,
  anonymousFallback: string
): Promise<string> {
  const identity = resolveHarthmereLiveModeActorIdentityV1(request);

  // Look up the existing install -> user link whenever an install id is present.
  // For install-only requests this lets them converge onto the user key; for
  // authed requests it lets an already-linked install short-circuit straight to
  // the fast path (no redundant link write, no orphan probe) on every poll.
  let linkedUserId: string | undefined;
  if (identity.installId) {
    linkedUserId = await readInstallLinkV1(
      redis,
      harthmereLiveModeInstallLinkKeyV1(identity.installId)
    );
  }
  let linkedGameUserId: string | undefined;
  if (identity.installId) {
    linkedGameUserId = await readInstallLinkV1(
      redis,
      harthmereLiveModeInstallGameUserLinkKeyV1(identity.installId)
    );
  }
  if (linkedGameUserId) {
    await maybeAdoptLinkedActorBlobV1(
      redis,
      linkedUserId ?? identity.userId,
      linkedGameUserId
    );
  }

  const plan = planHarthmereLiveModeActorKeyV1({
    userId: identity.userId,
    installId: identity.installId,
    linkedGameUserId,
    linkedUserId,
    anonymousFallback,
  });

  if (plan.writeInstallLink) {
    await writeInstallLinkV1(
      redis,
      plan.writeInstallLink.installId,
      plan.writeInstallLink.userId
    );
  }
  if (plan.considerInstallOrphan) {
    await maybeAdoptInstallOrphanV1(
      redis,
      plan.considerInstallOrphan.installId,
      plan.considerInstallOrphan.userId
    );
  }

  return plan.actorId;
}
