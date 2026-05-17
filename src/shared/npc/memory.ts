import type { BiomesId } from "@/shared/ids";
import { z } from "zod";

export const HARTHMERE_NPC_MEMORY_VERSION_V37 = "harthmere-npc-memory-v37";
const MAX_MEMORY_ENTRIES_PER_NPC = 50;

export const zNpcMemoryComponent = z.object({
  memory: z
    .object({
      perPlayer: z
        .record(
          z.string(),
          z.object({
            lastEventId: z.string().optional(),
            lastSpokenAt: z.number().optional(),
            sentiment: z.number().default(0),
            witnessedCrime: z.boolean().default(false),
          })
        )
        .default({}),
    })
    .default({ perPlayer: {} }),
});

export function recordNpcMemoryEvent(
  npcState: any,
  playerId: BiomesId,
  eventId: string,
  sentimentDelta: number,
  nowSeconds = Date.now() / 1000
) {
  npcState.memory ??= { perPlayer: {} };
  const perPlayer = npcState.memory.perPlayer;
  const key = String(playerId);
  const entry = perPlayer[key] ?? { sentiment: 0, witnessedCrime: false };
  entry.lastEventId = eventId;
  entry.lastSpokenAt = nowSeconds;
  entry.sentiment = Math.max(-100, Math.min(100, entry.sentiment + sentimentDelta));
  perPlayer[key] = entry;

  const entries = Object.entries(perPlayer);
  if (entries.length > MAX_MEMORY_ENTRIES_PER_NPC) {
    entries
      .sort(([, a]: any, [, b]: any) => (a.lastSpokenAt ?? 0) - (b.lastSpokenAt ?? 0))
      .slice(0, entries.length - MAX_MEMORY_ENTRIES_PER_NPC)
      .forEach(([oldKey]) => delete perPlayer[oldKey]);
  }
}
