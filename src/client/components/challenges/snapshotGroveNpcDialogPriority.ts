export function shouldSnapshotGroveDialogPreemptNativeQuestStepsForTest(input: {
  hasSnapshotGroveDialog: boolean;
  nativeRelevantStepCount: number;
  chapter1OwnsThisNpc?: boolean;
  chapter1SupplierTrade?: boolean;
}) {
  return (
    !input.chapter1OwnsThisNpc &&
    !input.chapter1SupplierTrade &&
    input.hasSnapshotGroveDialog &&
    input.nativeRelevantStepCount > 0
  );
}
