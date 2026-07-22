export type GaiaMissingShardAllowance = {
  expectedShards: number;
  absoluteThreshold: number;
  thresholdRatio: number;
  ratioThreshold: number;
  effectiveThreshold: number;
};

// Sparse worlds need a bounded allowance because Gaia densifies the rectangular
// AABB enclosing all terrain shards. The absolute threshold supports known
// layouts, while the ratio scales with intentional world expansion. Inputs are
// normalized so a malformed runtime config cannot create a negative allowance
// or silently permit more holes than the entire AABB.
export function gaiaMissingShardAllowance(
  expectedShards: number,
  configuredAbsoluteThreshold: number,
  configuredThresholdRatio: number
): GaiaMissingShardAllowance {
  const normalizedExpectedShards = Number.isFinite(expectedShards)
    ? Math.max(0, Math.floor(expectedShards))
    : 0;
  const absoluteThreshold = Number.isFinite(configuredAbsoluteThreshold)
    ? Math.max(0, Math.floor(configuredAbsoluteThreshold))
    : 0;
  const thresholdRatio = Number.isFinite(configuredThresholdRatio)
    ? Math.min(1, Math.max(0, configuredThresholdRatio))
    : 0;
  const ratioThreshold = Math.floor(normalizedExpectedShards * thresholdRatio);

  return {
    expectedShards: normalizedExpectedShards,
    absoluteThreshold,
    thresholdRatio,
    ratioThreshold,
    effectiveThreshold: Math.max(absoluteThreshold, ratioThreshold),
  };
}
