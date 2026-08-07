import {
  harthmereWorldObjectCandidateAtActivePinPosition,
  harthmereWorldObjectCandidateIsVisibleForInteraction,
  harthmereWorldObjectCandidateScore,
  isHarthmereInspectableWorldObject,
  selectNearestHarthmereWorldObjectInspectable,
  type HarthmereWorldObjectCandidate,
} from "@/shared/harthmere/harthmere_world_object_inspectable";
import assert from "assert";

describe("harthmere world object inspectable selection", () => {
  it("prefers the active quest target over a closer unrelated prop", () => {
    const candidates = [
      {
        id: "grove_tool_crate",
        label: "Road Kit Crate",
        position: [4, 0, 0] as const,
      },
      {
        id: "grove_food_satchel",
        label: "Fountain Food Satchel",
        position: [2, 0, 0] as const,
      },
    ];
    const ordinary = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates,
    });
    assert.equal(ordinary?.id, "grove_food_satchel");

    const questTarget = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates,
      preferredCandidateIds: new Set(["grove_tool_crate"]),
    });
    assert.equal(questTarget?.id, "grove_tool_crate");
  });

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

  it("keeps container-shaped presentation while honoring the Road Kit's signed inspect action", () => {
    const selected = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates: [
        { id: "crate", label: "Road Kit Crate", position: [2, 0, 0] },
      ],
    });
    assert.ok(selected);
    assert.strictEqual(selected!.isContainer, true);
    assert.strictEqual(selected!.interaction.kind, "inspect");
  });

  it("keeps nearby containers interactable across authored floor anchors", () => {
    const selected = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [526.5, 65, -96.5],
      facingView: facingPlusX,
      candidates: [
        {
          id: "ecs:4149747832010135",
          label: "Chest The Grove Underwater Main",
          position: [528.5, 59, -96.5],
        },
      ],
    });
    assert.ok(selected, "underwater ship chest should retain its F prompt");
    assert.strictEqual(selected!.isContainer, true);
    assert.strictEqual(selected!.interaction.kind, "open_container");

    const directlyAbove = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [528.5, 65, -96.5],
      facingView: facingPlusX,
      candidates: [
        {
          id: "ecs:4149747832010135",
          label: "Chest The Grove Underwater Main",
          position: [528.5, 59, -96.5],
        },
      ],
    });
    assert.ok(
      directlyAbove,
      "a close container directly below the player should remain openable"
    );

    assert.strictEqual(
      selectNearestHarthmereWorldObjectInspectable({
        playerPosition: [0, 6, 0],
        facingView: facingPlusX,
        candidates: [
          { id: "board", label: "Fountain Lesson Board", position: [2, 0, 0] },
        ],
      }),
      undefined,
      "non-container props on another floor keep the strict visibility gate"
    );
  });

  it("keeps a faced container selectable when terrain under the reticle is closer", () => {
    const selected = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [524.5, 65, -96.5],
      facingView: facingPlusX,
      candidates: [
        {
          id: "ecs:4149747832010135",
          label: "Chest The Grove Underwater Main",
          position: [528.5, 59, -96.5],
        },
      ],
      // The reticle hit the ship wall two metres away, but the chest's old ECS
      // anchor is four horizontal metres away and six metres below the player.
      radius: 2,
      containerRadius: 6.5,
    });
    assert.ok(selected, "the ship hull must not hide the chest's F prompt");
    assert.equal(selected!.interaction.kind, "open_container");

    const board = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates: [
        { id: "board", label: "Fountain Lesson Board", position: [4, 0, 0] },
      ],
      radius: 2,
      containerRadius: 6.5,
    });
    assert.equal(
      board,
      undefined,
      "ordinary props retain terrain-depth gating"
    );
  });

  it("keeps an exact grouped quest prop selectable behind its shallow parent terrain hit", () => {
    const canonicalId = "ecs:6372088708496489";
    const selected = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [680.5, 77, -103.5],
      facingView: facingPlusX,
      candidates: [
        {
          id: canonicalId,
          label: "Greeen Statue Inscription",
          position: [686.5, 77, -103.5],
        },
      ],
      // The reticle hits the statue wall near the player. The quest's exact
      // child plate is six metres away at the back of the grouped geometry.
      radius: 1.25,
      priorityCandidateIds: new Set([canonicalId]),
      priorityRadius: 6.5,
    });
    assert.ok(
      selected,
      "the canonical grouped inscription should remain readable"
    );
    assert.equal(selected!.id, canonicalId);
    assert.equal(selected!.interaction.kind, "read");
    assert.equal(selected!.isPriority, true);

    assert.equal(
      selectNearestHarthmereWorldObjectInspectable({
        playerPosition: [680.5, 77, -103.5],
        facingView: facingPlusX,
        candidates: [
          {
            id: canonicalId,
            label: "Greeen Statue Inscription",
            position: [686.5, 77, -103.5],
          },
        ],
        radius: 1.25,
      }),
      undefined,
      "ordinary props must retain the shallow terrain-depth gate"
    );
  });

  it("keeps a close container selectable when swimming drift puts it behind the current yaw", () => {
    // Exact pose captured by the focused Busted browser run. The reticle hit
    // the ship terrain at distance zero, the player was at the waterline, and
    // physics had moved the chest just over one block behind the camera yaw.
    // Close containers must not require the player to spin in place before the
    // universal F prompt appears; server range and quest-step checks still own
    // whether opening it is allowed.
    const selected = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [528.5, 67, -97.55260902415804],
      facingView: [0, 0, -1],
      candidates: [
        {
          id: "ecs:4149747832010135",
          label: "Chest The Grove Underwater Main",
          position: [528.5, 59, -96.5],
        },
      ],
      radius: 0,
      containerRadius: 6.5,
    });
    assert.ok(selected, "the close sunken chest must retain its F prompt");
    assert.equal(selected!.interaction.kind, "open_container");

    const board = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [0, 0, 0],
      facingView: [1, 0, 0],
      candidates: [
        { id: "board", label: "Fountain Lesson Board", position: [-1, 0, 0] },
      ],
    });
    assert.equal(
      board,
      undefined,
      "the any-facing close allowance remains container-specific"
    );
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

  it("uses the exact grounded active-pin pose for the targeted Run the Coop supply box", () => {
    const authored: HarthmereWorldObjectCandidate = {
      id: "coop_supply_box",
      label: "Old Supply Box",
      position: [384, 71, -198],
    };
    const grounded = harthmereWorldObjectCandidateAtActivePinPosition({
      candidate: authored,
      activePinMarkerId: "coop_supply_box",
      activePinPosition: [384, 59, -198],
    });
    assert.deepEqual(grounded.position, [384, 59, -198]);
    assert.ok(
      selectNearestHarthmereWorldObjectInspectable({
        playerPosition: [384.8, 59, -198],
        facingView: [-1, 0, 0],
        candidates: [grounded],
        preferredCandidateIds: new Set(["coop_supply_box"]),
      }),
      "the grounded supply box must own an F prompt beside the real terrain surface"
    );

    assert.strictEqual(
      harthmereWorldObjectCandidateAtActivePinPosition({
        candidate: authored,
        activePinMarkerId: "another_object",
        activePinPosition: [384, 59, -198],
      }),
      authored,
      "an unrelated pin must not move the candidate"
    );
  });
});
