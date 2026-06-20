// HARTHMERE_LIVE_MODE_ACTOR_RESOLUTION
//
// Server-side glue that turns the pure identity plan
// (live_mode_actor_identity) into the single player_state actorId every
// live_mode_* handler should use. It transparently heals the install/user
// split-brain described in live_mode_actor_identity.ts:
//   * install-only (pre-cookie) requests converge onto the linked user key,
//   * the install -> user link is recorded on the first authed sighting,
//   * an orphaned `install:` blob is adopted into an EMPTY user key (recovering
//     a stranded save without ever overwriting real data).
//
// All bookkeeping is best-effort: a Redis hiccup on the link/adoption path must
// never fail the underlying read, so every side effect is wrapped and swallowed.

import {
  HarthmereLiveModeActorRequest,
  harthmereLiveModeInstallGameUserLinkKey,
  harthmereLiveModeInstallActorId,
  harthmereLiveModeInstallLinkKey,
  planHarthmereLiveModeActorKey,
  resolveHarthmereLiveModeActorIdentity,
  shouldAdoptHarthmereInstallOrphan,
} from "@/shared/harthmere/live_mode_actor_identity";
import { harthmereLiveModePlayerStateKey } from "@/shared/harthmere/live_mode_backend";

export interface HarthmereActorResolutionRedis {
  primary: {
    get: (key: string) => Promise<string | null>;
    set?: (key: string, value: string) => Promise<unknown>;
  };
}

function actorResolutionSetter(redis: HarthmereActorResolutionRedis) {
  return typeof redis.primary.set === "function"
    ? redis.primary.set.bind(redis.primary)
    : undefined;
}

async function readInstallLink(
  redis: HarthmereActorResolutionRedis,
  key: string
): Promise<string | undefined> {
  try {
    const raw = await redis.primary.get(key);
    return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function writeInstallLink(
  redis: HarthmereActorResolutionRedis,
  installId: string,
  userId: string
): Promise<void> {
  const set = actorResolutionSetter(redis);
  if (!set) {
    return;
  }
  try {
    await set(harthmereLiveModeInstallLinkKey(installId), userId);
  } catch {
    // best effort — never fail the request because the link could not be saved.
  }
}

async function maybeAdoptInstallOrphan(
  redis: HarthmereActorResolutionRedis,
  installId: string,
  userId: string
): Promise<void> {
  const set = actorResolutionSetter(redis);
  if (!set) {
    return;
  }
  try {
    const userKey = harthmereLiveModePlayerStateKey(userId);
    const installKey = harthmereLiveModePlayerStateKey(
      harthmereLiveModeInstallActorId(installId)
    );
    const [userStateRaw, installStateRaw] = await Promise.all([
      redis.primary.get(userKey),
      redis.primary.get(installKey),
    ]);
    if (
      shouldAdoptHarthmereInstallOrphan({ userStateRaw, installStateRaw }) &&
      typeof installStateRaw === "string"
    ) {
      // Copy the stranded blob verbatim; parseHarthmereLiveModeBackendState
      // re-stamps the embedded actorId on read, so the user key surfaces under
      // the correct identity.
      await set(userKey, installStateRaw);
    }
  } catch {
    // best effort — adoption is opportunistic recovery, not a hard dependency.
  }
}

async function maybeAdoptLinkedActorBlob(
  redis: HarthmereActorResolutionRedis,
  fromActorId: string | undefined,
  toActorId: string | undefined
): Promise<void> {
  const set = actorResolutionSetter(redis);
  if (!set || !fromActorId || !toActorId || fromActorId === toActorId) {
    return;
  }
  try {
    const fromKey = harthmereLiveModePlayerStateKey(fromActorId);
    const toKey = harthmereLiveModePlayerStateKey(toActorId);
    const [toStateRaw, fromStateRaw] = await Promise.all([
      redis.primary.get(toKey),
      redis.primary.get(fromKey),
    ]);
    if (
      shouldAdoptHarthmereInstallOrphan({
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
export async function resolveHarthmereLiveModeActorId(
  redis: HarthmereActorResolutionRedis,
  request: HarthmereLiveModeActorRequest,
  anonymousFallback: string
): Promise<string> {
  const identity = resolveHarthmereLiveModeActorIdentity(request);

  // Look up the existing install -> user link whenever an install id is present.
  // For install-only requests this lets them converge onto the user key; for
  // authed requests it lets an already-linked install short-circuit straight to
  // the fast path (no redundant link write, no orphan probe) on every poll.
  let linkedUserId: string | undefined;
  if (identity.installId) {
    linkedUserId = await readInstallLink(
      redis,
      harthmereLiveModeInstallLinkKey(identity.installId)
    );
  }
  let linkedGameUserId: string | undefined;
  if (identity.installId) {
    linkedGameUserId = await readInstallLink(
      redis,
      harthmereLiveModeInstallGameUserLinkKey(identity.installId)
    );
  }
  if (linkedGameUserId) {
    await maybeAdoptLinkedActorBlob(
      redis,
      linkedUserId ?? identity.userId,
      linkedGameUserId
    );
  }

  const plan = planHarthmereLiveModeActorKey({
    userId: identity.userId,
    installId: identity.installId,
    linkedGameUserId,
    linkedUserId,
    anonymousFallback,
  });

  if (plan.writeInstallLink) {
    await writeInstallLink(
      redis,
      plan.writeInstallLink.installId,
      plan.writeInstallLink.userId
    );
  }
  if (plan.considerInstallOrphan) {
    await maybeAdoptInstallOrphan(
      redis,
      plan.considerInstallOrphan.installId,
      plan.considerInstallOrphan.userId
    );
  }

  return plan.actorId;
}
