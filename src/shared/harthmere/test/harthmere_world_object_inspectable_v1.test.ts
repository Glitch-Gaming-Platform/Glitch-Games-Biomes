import {
  harthmereWorldObjectCandidateScoreV1,
  isHarthmereInspectableWorldObjectV1,
  selectNearestHarthmereWorldObjectInspectableV1,
  type HarthmereWorldObjectCandidateV1,
} from "@/shared/harthmere/harthmere_world_object_inspectable_v1";
import assert from "assert";

describe("harthmere world object inspectable selection", () => {
  const facingPlusX: readonly [number, number, number] = [1, 0, 0];

  it("recognizes authored non-living props and rejects living NPCs", () => {
    assert.ok(isHarthmereInspectableWorldObjectV1({ label: "Road Kit Crate" }));
    assert.ok(
      isHarthmereInspectableWorldObjectV1({ label: "Fountain Lesson Board" })
    );
    assert.ok(
      isHarthmereInspectableWorldObjectV1({ label: "Lost-and-Found Stone" })
    );
    assert.ok(!isHarthmereInspectableWorldObjectV1({ label: "Jackie" }));
    assert.ok(
      !isHarthmereInspectableWorldObjectV1({ label: "Mucked Robot" }),
      "living/robot exemption keeps NPCs out of the object prompt"
    );
  });

  it("scores objects in front of the player and rejects ones behind/out of range", () => {
    const inFront = harthmereWorldObjectCandidateScoreV1({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      objectPosition: [3, 0, 0],
    });
    assert.ok(inFront !== undefined);

    const behind = harthmereWorldObjectCandidateScoreV1({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      objectPosition: [-3, 0, 0],
    });
    assert.strictEqual(behind, undefined, "objects behind the player are skipped");

    const tooFar = harthmereWorldObjectCandidateScoreV1({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      objectPosition: [50, 0, 0],
    });
    assert.strictEqual(tooFar, undefined, "out-of-range objects are skipped");
  });

  it("allows a very close object even when slightly off the facing axis", () => {
    const closeSide = harthmereWorldObjectCandidateScoreV1({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      objectPosition: [0.2, 0, 2.0],
    });
    assert.ok(
      closeSide !== undefined,
      "close-radius allowance keeps adjacent props interactable"
    );
  });

  it("selects the nearest faced object and resolves its authored interaction", () => {
    const candidates: HarthmereWorldObjectCandidateV1[] = [
      { id: "crate", label: "Road Kit Crate", position: [3, 0, 0] },
      { id: "board", label: "Fountain Lesson Board", position: [1.5, 0, 0] },
      { id: "npc", label: "Jackie", position: [1, 0, 0] },
      { id: "behind", label: "Old Supply Box", position: [-2, 0, 0] },
    ];
    const selected = selectNearestHarthmereWorldObjectInspectableV1({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates,
    });
    assert.ok(selected);
    assert.strictEqual(selected!.id, "board", "nearest faced prop wins");
    assert.strictEqual(selected!.interaction.kind, "read");
    assert.strictEqual(selected!.isContainer, false);
  });

  it("flags container props so the open-container action is used", () => {
    const selected = selectNearestHarthmereWorldObjectInspectableV1({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates: [{ id: "crate", label: "Road Kit Crate", position: [2, 0, 0] }],
    });
    assert.ok(selected);
    assert.strictEqual(selected!.isContainer, true);
    assert.strictEqual(selected!.interaction.kind, "open_container");
  });

  it("opens the jobs board prop with the jobs-board action", () => {
    const selected = selectNearestHarthmereWorldObjectInspectableV1({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates: [
        {
          id: "jobs",
          label: "Harthmere Town Jobs Board",
          position: [2, 0, 0],
        },
      ],
    });
    assert.ok(selected);
    assert.strictEqual(selected!.interaction.kind, "open_jobs_board");
  });

  it("opens wanted and bounty board props with the wanted-board action", () => {
    const selected = selectNearestHarthmereWorldObjectInspectableV1({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates: [
        {
          id: "wanted",
          label: "Farming Wanted Board",
          position: [2, 0, 0],
        },
      ],
    });
    assert.ok(selected);
    assert.strictEqual(selected!.interaction.kind, "open_wanted_board");
    assert.strictEqual(selected!.interaction.title, "Open Wanted Board");
  });

  it("returns undefined when nothing interactable is nearby", () => {
    const selected = selectNearestHarthmereWorldObjectInspectableV1({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates: [{ id: "npc", label: "Jackie", position: [2, 0, 0] }],
    });
    assert.strictEqual(selected, undefined);
  });
});
