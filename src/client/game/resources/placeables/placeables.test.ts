/// <reference types="mocha" />
import assert from "assert";
import { runPlaceableMeshOptionalUpdates } from "@/client/game/resources/placeables/optional_updates";
import type { BiomesId } from "@/shared/ids";

describe("placeable mesh optional updates", () => {
  it("keeps the mesh usable and continues later updates after a transient fetch failure", async () => {
    const calls: string[] = [];
    const failures: string[] = [];

    await runPlaceableMeshOptionalUpdates(
      123 as BiomesId,
      [
        {
          name: "picture_frame",
          run: async () => {
            calls.push("picture_frame");
            throw new TypeError("Failed to fetch");
          },
        },
        {
          name: "mount_contents",
          run: async () => {
            calls.push("mount_contents");
          },
        },
      ],
      (name) => failures.push(name)
    );

    assert.deepEqual(calls, ["picture_frame", "mount_contents"]);
    assert.deepEqual(failures, ["picture_frame"]);
  });
});
