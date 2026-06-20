// HARTHMERE_CLOUD_SAVE_RESTORE_POLICY:
// Decides, on boot, whether the latest Glitch cloud save should be imported into
// the browser compatibility cache.
//
// Policy: live-mode backend state is the gameplay source of truth. Cloud saves
// are import/export snapshots for install recovery and old local-dev state; they
// must never auto-overwrite an existing backend authority record.

export type HarthmereCloudSaveRestorePolicyInput = {
  latestCloudVersion?: number;
  hasBackendAuthorityState?: boolean;
  hasMeaningfulLocalProgress: boolean;
  // Explicit override is only allowed when no backend authority record exists
  // for this actor. Manual restore uses a separate explicit action.
  forceCloudRestore?: boolean;
};

export function shouldApplyHarthmereCloudSave({
  latestCloudVersion,
  hasBackendAuthorityState,
  hasMeaningfulLocalProgress,
  forceCloudRestore,
}: HarthmereCloudSaveRestorePolicyInput) {
  if (hasBackendAuthorityState) {
    return false;
  }
  if (forceCloudRestore) {
    return true;
  }
  if (latestCloudVersion !== undefined) {
    return true;
  }
  return !hasMeaningfulLocalProgress;
}
