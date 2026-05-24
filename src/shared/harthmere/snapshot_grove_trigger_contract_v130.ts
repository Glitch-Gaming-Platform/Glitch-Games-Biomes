// SNAPSHOT_GROVE_TRIGGER_CONTRACT_V130
// Compatibility alias for the v112 Snapshot Grove trigger contract. The event
// string is intentionally shared across versions so partial local patch states
// do not break browser CustomEvent dispatch/listen wiring.

import {
  HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT_V112,
  SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGER_KIND_SET_V112,
  SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS_V112,
  snapshotGroveItemUseEventMatchesObjectiveV112,
  snapshotGroveItemUseObjectiveKindV112,
  snapshotGroveObjectiveCompletionFixtureV112,
  validateSnapshotGroveTriggerContractsV112,
} from "@/shared/harthmere/snapshot_grove_trigger_contract_v112";
import type {
  SnapshotGroveCompletionEventKindV112,
  SnapshotGroveItemUseObjectiveKindV112,
  SnapshotGroveObjectiveFixtureV112,
  SnapshotGroveTriggerContractReportV112,
} from "@/shared/harthmere/snapshot_grove_trigger_contract_v112";

export const HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT_V130 =
  HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT_V112;
export const SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGER_KIND_SET_V130 =
  SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGER_KIND_SET_V112;
export const SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS_V130 =
  SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS_V112;

export const snapshotGroveItemUseEventMatchesObjectiveV130 =
  snapshotGroveItemUseEventMatchesObjectiveV112;
export const snapshotGroveItemUseObjectiveKindV130 =
  snapshotGroveItemUseObjectiveKindV112;
export const snapshotGroveObjectiveCompletionFixtureV130 =
  snapshotGroveObjectiveCompletionFixtureV112;
export const validateSnapshotGroveTriggerContractsV130 =
  validateSnapshotGroveTriggerContractsV112;

export type SnapshotGroveCompletionEventKindV130 = SnapshotGroveCompletionEventKindV112;
export type SnapshotGroveItemUseObjectiveKindV130 = SnapshotGroveItemUseObjectiveKindV112;
export type SnapshotGroveObjectiveFixtureV130 = SnapshotGroveObjectiveFixtureV112;
export type SnapshotGroveTriggerContractReportV130 = SnapshotGroveTriggerContractReportV112;
