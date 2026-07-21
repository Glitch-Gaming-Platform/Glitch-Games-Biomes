import {
  editWorldWithRetry,
  isWorldEditConflict,
} from "@/server/shared/world/edit_retry";
import {
  WorldEditConflictError,
  type WorldEditor,
} from "@/server/shared/world/editor";
import assert from "assert";

function fakeWorldApi(commit: () => Promise<void>) {
  return {
    edit: () => ({ commit } as WorldEditor),
  };
}

describe("optimistic ECS edit retry", () => {
  it("rebuilds the edit from fresh state until the commit succeeds", async () => {
    let operations = 0;
    let commits = 0;
    const result = await editWorldWithRetry(
      fakeWorldApi(async () => {
        commits += 1;
        if (commits < 3) throw new WorldEditConflictError();
      }),
      async (_editor, attempt) => {
        operations += 1;
        return `attempt-${attempt}`;
      },
      { minDelayMs: 0, maxDelayMs: 0 }
    );

    assert.equal(result, "attempt-3");
    assert.equal(operations, 3);
    assert.equal(commits, 3);
  });

  it("does not retry unrelated errors", async () => {
    let operations = 0;
    await assert.rejects(
      editWorldWithRetry(
        fakeWorldApi(async () => undefined),
        async () => {
          operations += 1;
          throw new Error("mutation rejected");
        },
        { minDelayMs: 0, maxDelayMs: 0 }
      ),
      /mutation rejected/
    );
    assert.equal(operations, 1);
  });

  it("recognizes both typed and rolling-deploy legacy conflicts", () => {
    assert.equal(isWorldEditConflict(new WorldEditConflictError()), true);
    assert.equal(
      isWorldEditConflict(new Error("Failed to apply change to world!")),
      true
    );
    assert.equal(isWorldEditConflict(new Error("different failure")), false);
  });

  it("drains a burst of concurrent edits without leaking conflict failures", async () => {
    let version = 0;
    const worldApi = {
      edit: () => {
        const readVersion = version;
        return {
          commit: async () => {
            await Promise.resolve();
            if (readVersion !== version) throw new WorldEditConflictError();
            version += 1;
          },
        } as WorldEditor;
      },
    };

    const results = await Promise.all(
      Array.from({ length: 16 }, (_, index) =>
        editWorldWithRetry(
          worldApi,
          async () => {
            await Promise.resolve();
            return index;
          },
          { maxAttempts: 24, minDelayMs: 0, maxDelayMs: 0 }
        )
      )
    );

    assert.deepEqual(
      results,
      Array.from({ length: 16 }, (_, index) => index)
    );
    assert.equal(version, 16);
  });
});
