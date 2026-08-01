import {
  snapshotNpcGroundingRepairSatisfied,
  snapshotNpcGroundingRepairTarget,
} from "@/server/shim/snapshot_npc_grounding_repair";
import assert from "assert";

describe("snapshot NPC grounding repair", () => {
  it("keeps X/Z for ordinary Y-only grounding repairs", () => {
    assert.deepEqual(
      snapshotNpcGroundingRepairTarget([488.7, 76.5, -114.3], 71),
      [488.7, 71, -114.3]
    );
  });

  it("uses the complete authored position for a water rescue", () => {
    assert.deepEqual(
      snapshotNpcGroundingRepairTarget([488.7, 76.5, -114.3], [492, 70, -141]),
      [492, 70, -141]
    );
  });

  it("requires both live and spawn positions to match a complete repair", () => {
    assert.equal(
      snapshotNpcGroundingRepairSatisfied({
        currentPosition: [492, 70, -141],
        spawnPosition: [488.7, 76.5, -114.3],
        repair: [492, 70, -141],
      }),
      false
    );
    assert.equal(
      snapshotNpcGroundingRepairSatisfied({
        currentPosition: [492, 70, -141],
        spawnPosition: [492, 70, -141],
        repair: [492, 70, -141],
      }),
      true
    );
  });
});
