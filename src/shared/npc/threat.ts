import type { BiomesId } from "@/shared/ids";
import { z } from "zod";

export const HARTHMERE_NPC_THREAT_TABLE_VERSION_V37 =
  "harthmere-npc-threat-table-v37";

export const zThreatTableComponent = z.object({
  threat: z
    .object({
      table: z.record(z.string(), z.number()).default({}),
      lastDecayAt: z.number().optional(),
    })
    .default({ table: {} }),
});

export type ThreatTable = Record<string, number>;

export const THREAT_DECAY_PER_SEC = 5;
export const THREAT_DECAY_INTERVAL = 1;
export const THREAT_PER_DAMAGE_DEALT = 1;
export const THREAT_PER_HP_HEALED_TO_ALLY = 0.5;
export const THREAT_PER_TAUNT = 10_000;
export const THREAT_PER_HARD_CC = 200;
export const THREAT_PER_SOFT_CC = 50;
export const THREAT_PER_DEBUFF = 100;
export const THREAT_PER_BUFF_ALLY = 30;

export function addThreat(table: ThreatTable, playerId: BiomesId, amount: number) {
  const key = String(playerId);
  table[key] = (table[key] ?? 0) + amount;
  if (table[key] <= 0) {
    delete table[key];
  }
}

export function topThreat(table: ThreatTable): BiomesId | undefined {
  let bestKey: string | undefined;
  let bestValue = 0;
  for (const [key, value] of Object.entries(table)) {
    if (value > bestValue) {
      bestValue = value;
      bestKey = key;
    }
  }
  return bestKey ? (Number(bestKey) as BiomesId) : undefined;
}

export function decayThreat(
  table: ThreatTable,
  now: number,
  lastDecayAt: number | undefined
): number {
  const dt = lastDecayAt === undefined ? 0 : now - lastDecayAt;
  if (dt < THREAT_DECAY_INTERVAL) {
    return lastDecayAt ?? now;
  }
  const amount = dt * THREAT_DECAY_PER_SEC;
  for (const key of Object.keys(table)) {
    table[key] = Math.max(0, table[key] - amount);
    if (table[key] === 0) {
      delete table[key];
    }
  }
  return now;
}
