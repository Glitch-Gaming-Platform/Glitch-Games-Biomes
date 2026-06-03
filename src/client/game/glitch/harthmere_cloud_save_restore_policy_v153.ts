export type HarthmereCloudSaveRestorePolicyInputV153 = {
  latestCloudVersion?: number;
  hasMeaningfulLocalProgress: boolean;
};

export function shouldApplyHarthmereCloudSaveV153({
  latestCloudVersion,
  hasMeaningfulLocalProgress,
}: HarthmereCloudSaveRestorePolicyInputV153) {
  if (latestCloudVersion !== undefined) return true;
  if (!hasMeaningfulLocalProgress) return true;
  return false;
}
