import { generatedIdsCollidingWithAuthoritativeState } from "@/server/logic/id_contention";
import type { FinalizedChangeSet } from "@/server/logic/events/context/change_set";
import type { ApplyStatus } from "@/shared/api/transaction";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

function proposalWithGeneratedIds(
  ...ids: BiomesId[]
): Pick<FinalizedChangeSet<unknown>, "usedIds"> {
  return { usedIds: new Set(ids) };
}

describe("logic generated-ID contention", () => {
  const generated = 201 as BiomesId;
  const unrelated = 202 as BiomesId;

  it("discards a generated ID proven occupied by an aborted ECS apply", () => {
    assert.deepEqual(
      generatedIdsCollidingWithAuthoritativeState(
        [proposalWithGeneratedIds(generated)],
        ["aborted"],
        [generated]
      ),
      [generated]
    );
  });

  it("retains generated IDs after ordinary entity-version contention", () => {
    assert.deepEqual(
      generatedIdsCollidingWithAuthoritativeState(
        [proposalWithGeneratedIds(generated)],
        ["aborted"],
        [unrelated]
      ),
      []
    );
  });

  it("does not discard IDs from successful proposals", () => {
    const outcomes: ApplyStatus[] = ["success"];
    assert.deepEqual(
      generatedIdsCollidingWithAuthoritativeState(
        [proposalWithGeneratedIds(generated)],
        outcomes,
        [generated]
      ),
      []
    );
  });
});
