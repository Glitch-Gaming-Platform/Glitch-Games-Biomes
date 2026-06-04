// HARTHMERE_CLOUD_SAVE_RESTORE_POLICY:
// Decides, on boot, whether the latest Glitch cloud save should be applied over
// whatever Harthmere progress currently sits in this browser's localStorage.
//
// Policy: the Glitch cloud save is the SOURCE OF TRUTH on boot. Whenever a cloud
// save exists we restore it, so a player's progress (items, collectables,
// quests, avatar design) always survives a redeploy / new device and is actually
// applied. The only time we skip restoring is when there is NO cloud save AND
// local already has meaningful progress — restoring "nothing" must never wipe
// real local progress. An explicit force also always restores (e.g. a different
// Glitch account just signed in on this browser).
//
// (A previous revision tried a heuristic "progress score" comparison so a stale
// cloud slot could not overwrite newer local progress. That made restore too
// conservative: it could SUPPRESS the cloud restore players actually want after
// a deploy — the opposite of the reported bug. The cloud-as-source-of-truth rule
// below is intentionally simple and matches the documented Glitch cloud-save
// lifecycle, where the server slot is authoritative on load.)

export type HarthmereCloudSaveRestorePolicyInputV153 = {
  latestCloudVersion?: number;
  hasMeaningfulLocalProgress: boolean;
  // Explicit override: always take the cloud save (e.g. a different Glitch
  // account just claimed this browser, so the previous account's local progress
  // must not leak into the new account).
  forceCloudRestore?: boolean;
};

export function shouldApplyHarthmereCloudSaveV153({
  latestCloudVersion,
  hasMeaningfulLocalProgress,
  forceCloudRestore,
}: HarthmereCloudSaveRestorePolicyInputV153) {
  // Explicit override always wins (account switch on this browser).
  if (forceCloudRestore) {
    return true;
  }
  // A cloud save exists -> it is the source of truth on boot. Always restore it
  // so the player's previous progress is applied (the core "my stuff persists
  // across updates" requirement).
  if (latestCloudVersion !== undefined) {
    return true;
  }
  // No cloud save to apply. Restoring is only a harmless no-op when local is
  // empty; never blow away meaningful local progress with "nothing".
  return !hasMeaningfulLocalProgress;
}
