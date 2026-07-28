import type {
  ReadonlyTriggerState,
  TriggerState,
} from "@/shared/ecs/gen/components";
import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_JOBS_BOARD_KILL_LEDGER_ROOT =
  8_740_000_000_000_007 as BiomesId;
export const HARTHMERE_JOBS_BOARD_KILL_LEDGER_MAX_ENTRIES = 64;

export function readHarthmereJobsBoardNativeKillLedger(
  state: ReadonlyTriggerState | TriggerState | undefined
): Record<string, number> {
  const values = state?.by_root.get(HARTHMERE_JOBS_BOARD_KILL_LEDGER_ROOT);
  if (!values) return {};
  return Object.fromEntries(
    [...values.entries()].flatMap(([entityId, killedAtMs]) => {
      const timestamp = Math.max(0, Number(killedAtMs) || 0);
      return timestamp > 0 ? [[String(entityId), timestamp]] : [];
    })
  );
}

export function recordHarthmereJobsBoardNativeKill(
  state: TriggerState,
  entityId: BiomesId,
  killedAtMs: number
) {
  let values = state.by_root.get(HARTHMERE_JOBS_BOARD_KILL_LEDGER_ROOT);
  if (!values) {
    values = new Map();
    state.by_root.set(HARTHMERE_JOBS_BOARD_KILL_LEDGER_ROOT, values);
  }
  values.set(entityId, Math.max(1, Math.trunc(killedAtMs)));
  if (values.size > HARTHMERE_JOBS_BOARD_KILL_LEDGER_MAX_ENTRIES) {
    const oldest = [...values.entries()]
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .slice(0, values.size - HARTHMERE_JOBS_BOARD_KILL_LEDGER_MAX_ENTRIES);
    for (const [oldEntityId] of oldest) values.delete(oldEntityId);
  }
  return readHarthmereJobsBoardNativeKillLedger(state);
}
