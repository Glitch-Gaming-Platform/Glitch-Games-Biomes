// HARTHMERE_CLOUD_SAVE_IDENTITY
//
// Why this module exists
// ----------------------
// Glitch cloud saves must attach to a STABLE per-player scope. The bug we are
// fixing: the biomes user that backs the save scope (`biomes:${user.id}`) is
// resolved through a foreign-auth link whose key (`profile.id`) used to depend
// on `identity.gameUserId`, which itself was `glitch:${glitchUserId}` only when
// the Glitch validate/claim response happened to include a user id, and
// `install:${installId}` otherwise.
//
// In production the Glitch validate/claim response frequently returns ONLY a
// stable `user_name` (e.g. "blackmage") and NO stable user id — and even when it
// does, it is inconsistent between calls. That made `profile.id` flip between two
// forms across sessions, so the same human got a brand-new biomes user id every
// reload/redeploy (observed: 1786141876542625 -> 103364691929551), orphaning all
// previously-scoped progress even though the Glitch cloud slot itself persisted.
//
// The fix: derive the foreign-auth link key from the MOST STABLE identifier the
// Glitch response actually provides, in a way that does NOT flip when the
// volatile glitch user id appears/disappears. We also return an ordered list of
// CANDIDATE keys (including legacy forms) so existing links keep resolving, and a
// single deterministic PRIMARY key under which new/back-filled links are created.
//
// This module is intentionally free of any server/runtime imports so it can be
// unit-tested directly (the server module graph pulls in native deps that do not
// load in every environment).

export const HARTHMERE_CLOUD_SAVE_IDENTITY_VERSION =
  "harthmere-cloud-save-identity" as const;

export interface HarthmereCloudSaveIdentityInput {
  titleId: string;
  installId: string;
  // Stable Glitch user id when present (often absent in the validate response).
  glitchUserId?: string | null;
  // Human-facing Glitch account name. Stable per account; "blackmage" etc.
  userName?: string | null;
}

export function harthmereGuestInstallBiomesUserId(input: {
  titleId: string;
  installId: string;
}): number {
  const mask52 = (1n << 52n) - 1n;
  let hash = 1469598103934665603n;
  for (const character of `${input.titleId}:${input.installId}`) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return Number((1n << 52n) | (hash & mask52));
}

const GUEST_NAME_RE = /^(guest|guest user|anonymous|unknown|player|null)$/i;

// Install-derived usernames (e.g. "Glitchinstall25fe66b" / "Local1a2b3c") are NOT
// stable account identities — they are minted from the install id, so they must
// not be treated as a stable cross-session/cross-device scope key.
const INSTALL_DERIVED_NAME_RE = /^(glitchinstall|local|install|glitchplayer)/i;

export function isStableHarthmereUserName(
  userName?: string | null
): userName is string {
  const trimmed = (userName ?? "").trim();
  if (!trimmed) {
    return false;
  }
  if (GUEST_NAME_RE.test(trimmed)) {
    return false;
  }
  if (INSTALL_DERIVED_NAME_RE.test(trimmed)) {
    return false;
  }
  return true;
}

export function isStableHarthmereGlitchUserId(
  glitchUserId?: string | null
): glitchUserId is string {
  const trimmed = (glitchUserId ?? "").trim();
  if (!trimmed) {
    return false;
  }
  if (GUEST_NAME_RE.test(trimmed)) {
    return false;
  }
  return true;
}

export function normalizeHarthmereUserNameSlug(userName: string): string {
  return userName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function glitchCandidateId(titleId: string, glitchUserId: string) {
  return `glitch:${titleId}:glitch:${glitchUserId.trim()}`;
}

function userNameCandidateId(titleId: string, userName: string) {
  return `glitch:${titleId}:user:${normalizeHarthmereUserNameSlug(userName)}`;
}

// True when this Glitch response carries a STABLE account identity (a real
// glitch user id, or a stable account name). When false the player is a GUEST:
// there is no durable identity to anchor a biomes user or a cloud save to, so
// callers must give them an ephemeral, non-persisted session and never save.
// The install id is intentionally NOT an account identity — it is per-device and
// an install with no resolved user is exactly the guest case Glitch returns
// GUEST_NOT_ALLOWED for.
export function harthmereHasStableGlitchAccount(
  input: HarthmereCloudSaveIdentityInput
): boolean {
  return (
    isStableHarthmereGlitchUserId(input.glitchUserId) ||
    isStableHarthmereUserName(input.userName)
  );
}

// The deterministic key under which a NEW (or back-filled) link is created. This
// is the stable scope going forward, anchored ONLY to the Glitch account.
// Preference order:
//   1. real Glitch user id (most authoritative, cross-device)
//   2. stable Glitch account name (cross-device, survives biomes-user re-mint)
// Returns `undefined` for a guest (no stable Glitch account). The install id is
// deliberately NOT used as a fallback: it is per-device, and a keyless identity
// must remain a guest rather than silently accruing a durable, install-scoped
// biomes user.
export function harthmereCloudSaveForeignAuthPrimaryId(
  input: HarthmereCloudSaveIdentityInput
): string | undefined {
  if (isStableHarthmereGlitchUserId(input.glitchUserId)) {
    return glitchCandidateId(input.titleId, input.glitchUserId);
  }
  if (isStableHarthmereUserName(input.userName)) {
    return userNameCandidateId(input.titleId, input.userName);
  }
  return undefined;
}

// All keys an existing link MIGHT live under, newest-preference first. Lookups
// try these in order and reuse the first existing link, so a player linked under
// any legacy account form is still recognized. CRUCIALLY this always includes
// the userName form (when stable) regardless of whether the (formerly volatile)
// glitch user id is present this call — that is what lets a glitch-id session and
// a userName session converge on the same biomes user. The install form is NOT a
// candidate: a guest is never resolved to a durable user, and a real account is
// always found via its glitch-id/userName form.
export function harthmereCloudSaveForeignAuthCandidateIds(
  input: HarthmereCloudSaveIdentityInput
): string[] {
  const ids: string[] = [];
  if (isStableHarthmereGlitchUserId(input.glitchUserId)) {
    ids.push(glitchCandidateId(input.titleId, input.glitchUserId));
  }
  if (isStableHarthmereUserName(input.userName)) {
    ids.push(userNameCandidateId(input.titleId, input.userName));
  }
  return Array.from(new Set(ids));
}
