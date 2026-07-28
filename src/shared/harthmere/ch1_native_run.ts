import type {
  ReadonlyTriggerState,
  TriggerState,
} from "@/shared/ecs/gen/components";
import type { BiomesId } from "@/shared/ids";
import { ch1ElsewhenSlotAt } from "@/shared/harthmere/ch1_elsewhen_region";
import type { ReadonlyVec3 } from "@/shared/math/types";

export const CH1_NATIVE_RUN_TRIGGER_ROOT = 8_740_000_000_000_201 as BiomesId;
const DUNGEON_ID_KEY = 8_740_000_000_000_202 as BiomesId;
const RUN_ID_KEY = 8_740_000_000_000_203 as BiomesId;
const PARTY_ID_KEY = 8_740_000_000_000_204 as BiomesId;

export interface Ch1NativeRunAdmission {
  dungeonId: string;
  runId: string;
  partyId: string;
}

export function readCh1NativeRunAdmission(
  state: ReadonlyTriggerState | TriggerState | undefined
): Ch1NativeRunAdmission | undefined {
  const values = state?.by_root.get(CH1_NATIVE_RUN_TRIGGER_ROOT);
  const dungeonId = String(values?.get(DUNGEON_ID_KEY) ?? "");
  const runId = String(values?.get(RUN_ID_KEY) ?? "");
  const partyId = String(values?.get(PARTY_ID_KEY) ?? "");
  if (!dungeonId || !runId || !partyId) return undefined;
  return { dungeonId, runId, partyId };
}

export function writeCh1NativeRunAdmission(
  state: TriggerState,
  admission: Ch1NativeRunAdmission
) {
  let values = state.by_root.get(CH1_NATIVE_RUN_TRIGGER_ROOT);
  if (!values) {
    values = new Map();
    state.by_root.set(CH1_NATIVE_RUN_TRIGGER_ROOT, values);
  }
  values.set(DUNGEON_ID_KEY, admission.dungeonId);
  values.set(RUN_ID_KEY, admission.runId);
  values.set(PARTY_ID_KEY, admission.partyId);
}

export function clearCh1NativeRunAdmission(state: TriggerState) {
  state.by_root.delete(CH1_NATIVE_RUN_TRIGGER_ROOT);
}

export function ch1NativeRunAdmitsPosition(
  state: ReadonlyTriggerState | TriggerState | undefined,
  position: ReadonlyVec3
): boolean {
  const slot = ch1ElsewhenSlotAt(position);
  const admission = readCh1NativeRunAdmission(state);
  return !!slot && admission?.dungeonId === slot.dungeonId;
}
