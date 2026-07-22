import {
  harthmereWorldObjectCandidateIsVisibleForInteraction,
  harthmereWorldObjectCandidateScore,
  isHarthmereInspectableWorldObject,
  selectNearestHarthmereWorldObjectInspectable,
  type HarthmereWorldObjectCandidate,
} from "@/shared/harthmere/harthmere_world_object_inspectable";
import assert from "assert";

describe("harthmere world object inspectable selection", () => {
  const facingPlusX: readonly [number, number, number] = [1, 0, 0];

  it("recognizes authored non-living props and rejects living NPCs", () => {
    assert.ok(isHarthmereInspectableWorldObject({ label: "Road Kit Crate" }));
    assert.ok(
      isHarthmereInspectableWorldObject({ label: "Fountain Lesson Board" })
    );
    assert.ok(
      isHarthmereInspectableWorldObject({ label: "Lost-and-Found Stone" })
    );
    assert.ok(!isHarthmereInspectableWorldObject({ label: "Jackie" }));
    assert.ok(
      !isHarthmereInspectableWorldObject({ label: "Mucked Robot" }),
      "living/robot exemption keeps NPCs out of the object prompt"
    );
  });

  it("scores objects in front of the player and rejects ones behind/out of range", () => {
    const inFront = harthmereWorldObjectCandidateScore({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      objectPosition: [3, 0, 0],
    });
    assert.ok(inFront !== undefined);

    const behind = harthmereWorldObjectCandidateScore({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      objectPosition: [-3, 0, 0],
    });
    assert.strictEqual(
      behind,
      undefined,
      "objects behind the player are skipped"
    );

    const tooFar = harthmereWorldObjectCandidateScore({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      objectPosition: [50, 0, 0],
    });
    assert.strictEqual(tooFar, undefined, "out-of-range objects are skipped");
  });

  it("allows a close object when it remains inside the facing cone", () => {
    const closeSide = harthmereWorldObjectCandidateScore({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      objectPosition: [1.2, 0, 1.6],
    });
    assert.ok(
      closeSide !== undefined,
      "close-radius allowance keeps adjacent props interactable"
    );
  });

  it("rejects close side/behind objects and objects on another floor", () => {
    assert.strictEqual(
      harthmereWorldObjectCandidateScore({
        playerPosition: [0, 0, 0],
        facingView: facingPlusX,
        objectPosition: [0.2, 0, 2],
      }),
      undefined
    );
    assert.strictEqual(
      harthmereWorldObjectCandidateScore({
        playerPosition: [0, 0, 0],
        facingView: facingPlusX,
        objectPosition: [2, 8, 0],
      }),
      undefined
    );
  });

  it("selects the nearest faced object and resolves its authored interaction", () => {
    const candidates: HarthmereWorldObjectCandidate[] = [
      { id: "crate", label: "Road Kit Crate", position: [3, 0, 0] },
      { id: "board", label: "Fountain Lesson Board", position: [1.5, 0, 0] },
      { id: "npc", label: "Jackie", position: [1, 0, 0] },
      { id: "behind", label: "Old Supply Box", position: [-2, 0, 0] },
    ];
    const selected = selectNearestHarthmereWorldObjectInspectable({
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
    const selected = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates: [
        { id: "crate", label: "Road Kit Crate", position: [2, 0, 0] },
      ],
    });
    assert.ok(selected);
    assert.strictEqual(selected!.isContainer, true);
    assert.strictEqual(selected!.interaction.kind, "open_container");
  });

  it("opens the jobs board prop with the jobs-board action", () => {
    const selected = selectNearestHarthmereWorldObjectInspectable({
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
    const selected = selectNearestHarthmereWorldObjectInspectable({
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
    const selected = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates: [{ id: "npc", label: "Jackie", position: [2, 0, 0] }],
    });
    assert.strictEqual(selected, undefined);
  });

  it("only treats hidden quest containers as visible when their marker or active pin targets them", () => {
    const crate: HarthmereWorldObjectCandidate = {
      id: "grove_tool_crate",
      label: "Road Kit Crate",
      position: [10, 53, -4],
    };
    assert.strictEqual(
      harthmereWorldObjectCandidateIsVisibleForInteraction({
        candidate: crate,
      }),
      false
    );
    assert.strictEqual(
      harthmereWorldObjectCandidateIsVisibleForInteraction({
        candidate: crate,
        activeMarkerId: "grove_tool_crate",
      }),
      true
    );
    assert.strictEqual(
      harthmereWorldObjectCandidateIsVisibleForInteraction({
        candidate: crate,
        activePinMarkerId: "jobs_board_marker:grove_tool_crate",
      }),
      true
    );
    assert.strictEqual(
      harthmereWorldObjectCandidateIsVisibleForInteraction({
        candidate: crate,
        activePinMarkerId: "jobs_board_marker:some_todo",
        activePinPosition: [10.75, 70, -4.5],
      }),
      true
    );
    assert.strictEqual(
      harthmereWorldObjectCandidateIsVisibleForInteraction({
        candidate: crate,
        activePinMarkerId: "jobs_board_marker:some_todo",
        activePinPosition: [25, 70, -4],
      }),
      false
    );
  });
});
