export function harthmereBusinessCustomerFaceSeedV1(input: {
  npcId?: string;
  displayName?: string;
}): number {
  const identity = `${input.npcId ?? ""}:${input.displayName ?? ""}`;
  let seed = 2166136261;
  for (let i = 0; i < identity.length; i++) {
    seed ^= identity.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}
