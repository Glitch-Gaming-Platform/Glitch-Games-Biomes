// HARTHMERE_LIVE_MODE_ACTOR_RESOLUTION
//
// Server-side glue that turns the pure identity plan
// (live_mode_actor_identity) into the single player_state actorId every
// live_mode_* handler should use. It transparently heals the install/user
// split-brain described in live_mode_actor_identity.ts:
//   * install-only (pre-cookie) requests converge onto the linked user key,
//   * the install -> user link is recorded on the first authed sighting,
//   * an orphaned `install:` blob is returned as an adoption plan for the
//     live-mode write transaction (recovering a stranded save without ever
//     overwriting real data).
//
// Install-link bookkeeping is best-effort: a Redis hiccup on the link path must
// never fail the underlying read. Gameplay state adoption is not performed here;
// callers that mutate live-mode state receive an adoption plan and apply it in
// the live-mode transaction so player_state has one durable writer.

import {
  HarthmereLiveModeActorRequest,
  harthmereLiveModeInstallGameUserLinkKey,
  harthmereLiveModeInstallActorId,
  harthmereLiveModeInstallLinkKey,
  planHarthmereLiveModeActorKey,
  resolveHarthmereLiveModeActorIdentity,
} from "@/shared/harthmere/live_mode_actor_identity";
import { harthmereLiveModePlayerStateKey } from "@/shared/harthmere/live_mode_backend";

export interface HarthmereActorResolutionRedis {
  primary: {
    get: (key: string) => Promise<string | null>;
    set?: (key: string, value: string) => Promise<unknown>;
  };
}

export interface HarthmereLiveModeActorStateAdoption {
  fromActorId: string;
  fromStateKey: string;
  toActorId: string;
  toStateKey: string;
  reason: "install_orphan" | "linked_game_user";
}

export interface HarthmereLiveModeActorResolutionResult {
  actorId: string;
  stateAdoption?: HarthmereLiveModeActorStateAdoption;
}

export interface HarthmereLiveModeActorResolutionOptions {
  allowIdentityWrites?: boolean;
  allowStateAdoptionPlan?: boolean;
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

function buildStateAdoptionPlan(input: {
  fromActorId?: string;
  toActorId?: string;
  reason: HarthmereLiveModeActorStateAdoption["reason"];
}): HarthmereLiveModeActorStateAdoption | undefined {
  if (!input.fromActorId || !input.toActorId) {
    return undefined;
  }
  if (input.fromActorId === input.toActorId) {
    return undefined;
  }
  return {
    fromActorId: input.fromActorId,
    fromStateKey: harthmereLiveModePlayerStateKey(input.fromActorId),
    toActorId: input.toActorId,
    toStateKey: harthmereLiveModePlayerStateKey(input.toActorId),
    reason: input.reason,
  };
}

export async function resolveHarthmereLiveModeActorContext(
  redis: HarthmereActorResolutionRedis,
  request: HarthmereLiveModeActorRequest,
  anonymousFallback: string,
  options?: HarthmereLiveModeActorResolutionOptions
): Promise<HarthmereLiveModeActorResolutionResult> {
  const allowIdentityWrites = options?.allowIdentityWrites !== false;
  const allowStateAdoptionPlan = options?.allowStateAdoptionPlan !== false;
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

  let stateAdoption =
    allowStateAdoptionPlan && linkedGameUserId
      ? buildStateAdoptionPlan({
          fromActorId: linkedUserId ?? identity.userId,
          toActorId: linkedGameUserId,
          reason: "linked_game_user",
        })
      : undefined;

  const plan = planHarthmereLiveModeActorKey({
    userId: identity.userId,
    installId: identity.installId,
    linkedGameUserId,
    linkedUserId,
    anonymousFallback,
  });

  if (allowIdentityWrites && plan.writeInstallLink) {
    await writeInstallLink(
      redis,
      plan.writeInstallLink.installId,
      plan.writeInstallLink.userId
    );
  }
  if (allowStateAdoptionPlan && !stateAdoption && plan.considerInstallOrphan) {
    stateAdoption = buildStateAdoptionPlan({
      fromActorId: harthmereLiveModeInstallActorId(
        plan.considerInstallOrphan.installId
      ),
      toActorId: plan.considerInstallOrphan.userId,
      reason: "install_orphan",
    });
  }

  return { actorId: plan.actorId, stateAdoption };
}

// Resolve the player_state actorId for a live-mode request, healing the
// install/user split. Pass the same per-handler anonymous fallback string the
// old per-handler resolver used (e.g. "anonymous:building-reader").
export async function resolveHarthmereLiveModeActorId(
  redis: HarthmereActorResolutionRedis,
  request: HarthmereLiveModeActorRequest,
  anonymousFallback: string,
  options?: HarthmereLiveModeActorResolutionOptions
): Promise<string> {
  return (
    await resolveHarthmereLiveModeActorContext(
      redis,
      request,
      anonymousFallback,
      options
    )
  ).actorId;
}
