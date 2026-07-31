import { TerrainEmitter } from "@/server/gaia/terrain/emitter";
import type { WorldApi } from "@/server/shared/world/api";
import type { ChangeToApply } from "@/shared/api/transaction";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

function deleteChange(id: number): ChangeToApply {
  return {
    changes: [{ kind: "delete", id: id as BiomesId }],
  };
}

describe("Gaia TerrainEmitter", () => {
  let originalDryRun: boolean;

  beforeEach(() => {
    originalDryRun = CONFIG.gaiaV2DryRun;
    CONFIG.gaiaV2DryRun = false;
  });

  afterEach(() => {
    CONFIG.gaiaV2DryRun = originalDryRun;
  });

  it("flushes queued transactions in order and reports the emitted change count", async () => {
    const applied: ChangeToApply[] = [];
    const emitter = new TerrainEmitter({
      apply: async (change: ChangeToApply) => {
        applied.push(change);
        return { outcome: "success", changes: [] };
      },
    } as unknown as WorldApi);
    const first = deleteChange(1);
    const second: ChangeToApply = {
      changes: [
        { kind: "delete", id: 2 as BiomesId },
        { kind: "delete", id: 3 as BiomesId },
      ],
    };
    emitter.pushChange(first, second);

    assert.equal(await emitter.flush(), 3);
    assert.deepEqual(applied, [first, second]);
    assert.equal(await emitter.flush(), 0, "flush clears the pending buffer");
  });

  it("returns aborted and clears the batch when the world rejects a transaction", async () => {
    const applied: ChangeToApply[] = [];
    const emitter = new TerrainEmitter({
      apply: async (change: ChangeToApply) => {
        applied.push(change);
        return { outcome: "aborted", changes: [] };
      },
    } as unknown as WorldApi);
    emitter.pushChange(deleteChange(1), deleteChange(2));

    assert.equal(await emitter.flush(), "aborted");
    assert.equal(applied.length, 1, "publishing stops at the first abort");
    assert.equal(await emitter.flush(), 0, "aborted batches are cleared");
  });

  it("converts thrown world errors into an aborted flush", async () => {
    const emitter = new TerrainEmitter({
      apply: async () => {
        throw new Error("world unavailable");
      },
    } as unknown as WorldApi);
    emitter.pushChange(deleteChange(1));

    assert.equal(await emitter.flush(), "aborted");
    assert.equal(await emitter.flush(), 0);
  });

  it("does not publish mutations in Gaia dry-run mode", async () => {
    CONFIG.gaiaV2DryRun = true;
    let applyCount = 0;
    const emitter = new TerrainEmitter({
      apply: async () => {
        applyCount += 1;
        return { outcome: "success", changes: [] };
      },
    } as unknown as WorldApi);
    emitter.pushChange(deleteChange(1));

    assert.equal(await emitter.flush(), 0);
    assert.equal(applyCount, 0);
    assert.equal(await emitter.flush(), 0);
  });
});
