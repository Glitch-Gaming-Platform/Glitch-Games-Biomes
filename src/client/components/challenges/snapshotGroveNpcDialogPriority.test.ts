import assert from "assert";
import { shouldSnapshotGroveDialogPreemptNativeQuestStepsForTest } from "./snapshotGroveNpcDialogPriority";

describe("Snapshot Grove NPC dialogue priority", () => {
  it("keeps Grove offers visible when Jackie also has a native Road Ahead step", () => {
    assert.equal(
      shouldSnapshotGroveDialogPreemptNativeQuestStepsForTest({
        hasSnapshotGroveDialog: true,
        nativeRelevantStepCount: 1,
      }),
      true
    );
  });

  it("does not intercept NPCs with no Grove dialogue", () => {
    assert.equal(
      shouldSnapshotGroveDialogPreemptNativeQuestStepsForTest({
        hasSnapshotGroveDialog: false,
        nativeRelevantStepCount: 2,
      }),
      false
    );
  });

  it("yields the same NPC to active Chapter 1 story dialogue", () => {
    assert.equal(
      shouldSnapshotGroveDialogPreemptNativeQuestStepsForTest({
        hasSnapshotGroveDialog: true,
        nativeRelevantStepCount: 2,
        chapter1OwnsThisNpc: true,
      }),
      false
    );
    assert.equal(
      shouldSnapshotGroveDialogPreemptNativeQuestStepsForTest({
        hasSnapshotGroveDialog: true,
        nativeRelevantStepCount: 2,
        chapter1OwnsThisNpc: false,
      }),
      true,
      "normal Grove dialogue returns when Chapter 1 no longer owns this NPC"
    );
  });

  it("yields Grove chatter during the active Chapter 1 supplier visit", () => {
    assert.equal(
      shouldSnapshotGroveDialogPreemptNativeQuestStepsForTest({
        hasSnapshotGroveDialog: true,
        nativeRelevantStepCount: 1,
        chapter1SupplierTrade: true,
      }),
      false
    );
  });
});
