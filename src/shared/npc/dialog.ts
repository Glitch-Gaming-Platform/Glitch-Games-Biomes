import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import { standingTier } from "@/shared/npc/npc_reaction";

export function pickGreeting(
  npc: ReadonlyEntity,
  player: ReadonlyEntity,
  reputation: { likeability: number; legal: number; notoriety: number }
): string {
  const conv = (npc as any).conversation as
    | undefined
    | {
        greetings: { neutral: string; liked?: string; outlaw?: string; hated?: string };
        post_event_overrides?: Map<string, string> | Record<string, string>;
      };
  if (!conv) {
    return (npc as any).default_dialog?.text ?? "...";
  }
  const memory = (((npc as any).npc_state as any)?.memory?.perPlayer ?? {})[
    String(player.id)
  ];
  if (memory?.lastEventId && conv.post_event_overrides) {
    const overrides: any = conv.post_event_overrides;
    const override = typeof overrides.get === "function"
      ? overrides.get(memory.lastEventId)
      : overrides[memory.lastEventId];
    if (override) {
      return override;
    }
  }
  const tier = standingTier(
    reputation.likeability,
    reputation.legal,
    reputation.notoriety
  );
  return conv.greetings[tier as keyof typeof conv.greetings] ?? conv.greetings.neutral;
}

export function recordConversationEvent(
  npcState: any,
  playerId: BiomesId,
  eventId: string,
  sentimentDelta: number
) {
  npcState.memory ??= { perPlayer: {} };
  const entry = npcState.memory.perPlayer[String(playerId)] ?? { sentiment: 0 };
  entry.lastEventId = eventId;
  entry.lastSpokenAt = Date.now() / 1000;
  entry.sentiment = Math.max(-100, Math.min(100, entry.sentiment + sentimentDelta));
  npcState.memory.perPlayer[String(playerId)] = entry;
}
