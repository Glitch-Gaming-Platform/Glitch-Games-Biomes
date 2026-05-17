import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";

export type StandingTier = "liked" | "neutral" | "outlaw" | "hated";

export function standingTier(
  likeability: number,
  legalScore: number,
  notoriety: number
): StandingTier {
  if (legalScore >= 50 || notoriety >= 75) {
    return "hated";
  }
  if (legalScore >= 10) {
    return "outlaw";
  }
  if (likeability >= 25) {
    return "liked";
  }
  return "neutral";
}

export function reactionFor(
  npc: ReadonlyEntity,
  tier: StandingTier
): "greet" | "trade" | "ignore" | "watch" | "warn" | "arrest" | "attack" {
  const role = (npc as any).role as string | undefined;
  const personality = ((npc as any).personality ?? []) as string[];
  if (role === "guard") {
    if (tier === "hated") return "attack";
    if (tier === "outlaw") return "arrest";
    if (tier === "neutral") return "watch";
    return "greet";
  }
  if (role === "merchant") {
    if (tier === "hated") return "warn";
    if (tier === "outlaw") return "watch";
    return "trade";
  }
  if (role === "noble") {
    if (personality.includes("haughty") && tier !== "liked") return "ignore";
    if (tier === "hated") return "warn";
    return tier === "liked" ? "greet" : "ignore";
  }
  if (tier === "hated") return "warn";
  if (tier === "outlaw") return "ignore";
  return "greet";
}

export function shouldDefendAlly(
  defender: ReadonlyEntity,
  victim: ReadonlyEntity,
  factionRelations: (a: BiomesId, b: BiomesId) => number
): boolean {
  const a = (defender as any).factionId as BiomesId | undefined;
  const b = (victim as any).factionId as BiomesId | undefined;
  if (!a || !b) return false;
  if (a === b) return true;
  return factionRelations(a, b) >= 25;
}
