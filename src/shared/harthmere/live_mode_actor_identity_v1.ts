// HARTHMERE_LIVE_MODE_ACTOR_IDENTITY_V1
//
// Single source of truth for resolving "who is this Harthmere live-mode request
// for?" across every live_mode_* endpoint (player status, inventory/loot, quest,
// building, jobs board, farming, and the live_mode action writer).
//
// THE BUG THIS FIXES
// ------------------
// Each handler used to carry its own copy of the same resolver:
//   auth.userId present  -> key on String(userId)            (the biomes user)
//   else install_id      -> key on `install:${installId}`    (a per-install bucket)
//   else                 -> an anonymous bucket
// Because a Harthmere player's requests do NOT always carry the biomes auth
// cookie (it lands a beat after `op:autoLogin` finishes and the page reloads),
// the SAME physical player could read/write TWO different Redis blobs:
//   harthmere:live_mode:v1:player_state:<biomesUserId>     (authed requests)
//   harthmere:live_mode:v1:player_state:install:<id>       (pre-cookie requests)
// Progress saved under one key is invisible under the other, so a returning
// player can load Warrior / level 1 / 0 gold defaults even though they have a
// saved game -- it is just stranded under the other key.
//
// THE FIX
// -------
// 1. One resolver that ALSO captures the install id even when authed, so an
//    install can be linked to its biomes user.
// 2. A durable `install -> biomesUser` link. Once any authed request for an
//    install is seen, later install-only (pre-cookie) requests converge onto the
//    SAME user key instead of forking a new `install:` bucket.
// 3. A conservative one-time adoption: when an authed user has NO blob yet but an
//    orphaned `install:` blob exists, the install blob is adopted into the user
//    key. This recovers already-stranded saves. It NEVER overwrites a non-empty
//    user blob, so it cannot lose data.

export interface HarthmereLiveModeActorRequestV1 {
  auth?: { userId?: unknown };
  unsafeRequest: {
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
  };
}

function firstHarthmereActorRequestStringV1(
  value: unknown
): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : undefined;
}

export function harthmereLiveModeInstallIdFromRequestV1(unsafeRequest: {
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}): string | undefined {
  return (
    firstHarthmereActorRequestStringV1(unsafeRequest.query?.install_id) ??
    firstHarthmereActorRequestStringV1(unsafeRequest.query?.installId) ??
    firstHarthmereActorRequestStringV1(
      unsafeRequest.headers?.["x-glitch-install-id"]
    )
  );
}

export interface HarthmereLiveModeActorIdentityV1 {
  // The biomes user id (as a string) when the request is authenticated.
  userId?: string;
  // The Glitch install id when present (captured even when authed, so the
  // install can be linked to the biomes user).
  installId?: string;
}

// Resolve the raw identity signals from a request. Note: unlike the old
// per-handler resolvers, this keeps the install id around even when authed.
export function resolveHarthmereLiveModeActorIdentityV1(
  input: HarthmereLiveModeActorRequestV1
): HarthmereLiveModeActorIdentityV1 {
  const userId =
    input.auth?.userId !== undefined ? String(input.auth.userId) : undefined;
  const installId = harthmereLiveModeInstallIdFromRequestV1(
    input.unsafeRequest
  );
  return {
    userId: userId && userId.trim() ? userId : undefined,
    installId,
  };
}

export function harthmereLiveModeInstallLinkKeyV1(installId: string) {
  return `harthmere:live_mode:v1:install_user_link:${installId}`;
}

export function harthmereLiveModeInstallGameUserLinkKeyV1(installId: string) {
  return `harthmere:live_mode:v1:install_game_user_link:${installId}`;
}

export function harthmereLiveModeInstallActorIdV1(installId: string) {
  return `install:${installId}`;
}

export interface HarthmereLiveModeActorKeyPlanV1 {
  // The actorId to use for the player_state Redis key.
  actorId: string;
  // When set, persist this install -> user link so future install-only requests
  // converge onto the user key.
  writeInstallLink?: { installId: string; userId: string };
  // When set, the caller should check for an orphaned `install:` blob and adopt
  // it into the user key if (and only if) the user blob is still empty.
  considerInstallOrphan?: { installId: string; userId: string };
}

// Pure decision: given the resolved identity and any KNOWN existing install
// links, decide which player_state key to use and what bookkeeping to perform.
// No I/O.
export function planHarthmereLiveModeActorKeyV1(input: {
  userId?: string;
  installId?: string;
  linkedGameUserId?: string;
  // The user id currently linked to this install, if the caller already looked
  // it up. Undefined when unknown / no link exists.
  linkedUserId?: string;
  anonymousFallback: string;
}): HarthmereLiveModeActorKeyPlanV1 {
  const userId = input.userId && input.userId.trim() ? input.userId : undefined;
  const installId =
    input.installId && input.installId.trim() ? input.installId : undefined;
  const linkedUserId =
    input.linkedUserId && input.linkedUserId.trim()
      ? input.linkedUserId
      : undefined;
  const linkedGameUserId =
    input.linkedGameUserId && input.linkedGameUserId.trim()
      ? input.linkedGameUserId
      : undefined;

  if (installId && linkedGameUserId) {
    return { actorId: linkedGameUserId };
  }

  if (userId) {
    const plan: HarthmereLiveModeActorKeyPlanV1 = { actorId: userId };
    // (Re)write the link whenever it does not already point at this user. After
    // that the link matches and the authed read path stays exactly as fast as
    // before (no writes, no orphan probe).
    if (installId && linkedUserId !== userId) {
      plan.writeInstallLink = { installId, userId };
      // Only adopt a stranded `install:` blob on the GENUINE first sighting of
      // this install (no prior link). If a link already pointed at a different
      // user, that blob belongs to the previously-linked user, so adopting it
      // here would bleed one player's save into another. Re-point the link but
      // never copy the blob in that case.
      if (!linkedUserId) {
        plan.considerInstallOrphan = { installId, userId };
      }
    }
    return plan;
  }

  if (installId) {
    // Pre-cookie / install-only request: converge onto the linked user key when
    // we know it, otherwise fall back to the per-install bucket.
    return {
      actorId: linkedUserId ?? harthmereLiveModeInstallActorIdV1(installId),
    };
  }

  return { actorId: input.anonymousFallback };
}

// Pure decision: should an orphaned `install:` blob be adopted into the user
// key? Only when the user has NOTHING yet (so there is nothing to lose) and the
// install actually carries saved data.
export function shouldAdoptHarthmereInstallOrphanV1(input: {
  userStateRaw: string | null | undefined;
  installStateRaw: string | null | undefined;
}): boolean {
  const installRaw =
    typeof input.installStateRaw === "string"
      ? input.installStateRaw.trim()
      : "";
  if (!installRaw) {
    return false;
  }
  const userRaw =
    typeof input.userStateRaw === "string" ? input.userStateRaw.trim() : "";
  // Never overwrite an existing user blob.
  return userRaw === "";
}
