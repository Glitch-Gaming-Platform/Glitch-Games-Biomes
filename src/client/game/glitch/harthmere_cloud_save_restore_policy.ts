// HARTHMERE_CLOUD_SAVE_RESTORE_POLICY:
// Decides, on boot, whether the latest Glitch cloud save should be imported into
// the browser compatibility cache.
//
// Policy: Glitch Cloud Save is the durable source of truth for player-owned
// information. Live-mode Redis can reset or be rebuilt, so backend runtime state
// must not block importing the latest valid cloud save on boot.

export type HarthmereCloudSaveRestorePolicyInput = {
  latestCloudVersion?: number;
  hasMeaningfulLocalProgress: boolean;
  forceCloudRestore?: boolean;
};

export function shouldApplyHarthmereCloudSave({
  latestCloudVersion,
  hasMeaningfulLocalProgress,
  forceCloudRestore,
}: HarthmereCloudSaveRestorePolicyInput) {
  if (forceCloudRestore) {
    return true;
  }
  if (latestCloudVersion !== undefined) {
    return true;
  }
  return !hasMeaningfulLocalProgress;
}
