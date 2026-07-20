// HARTHMERE_WORLD_OBJECT_DIRECT_HIT_PROMPT regression tests.
//
// Locks in the fix for "crates/chests show their label but no interaction
// toaster". The bug was that the world-object inspect prompt only drew
// candidates from static source-code landmark tables, so live ECS world objects
// (seeded chests/crates that exist in the running world) never became
// candidates and never produced a prompt. The client now also feeds live ECS
// entities (id `ecs:<entityId>`) into the same selector. These tests assert that
// such live candidates are recognized, selected, and resolve to the correct
// per-type interaction -- using the exact labels seen in-game.

import {
  harthmereObjectInteractionForLabel,
  isHarthmereContainerObjectLabel,
} from "@/shared/harthmere/object_interaction_semantics";
import {
  isHarthmereInspectableWorldObject,
  selectNearestHarthmereWorldObjectInspectable,
  type HarthmereWorldObjectCandidate,
} from "@/shared/harthmere/harthmere_world_object_inspectable";
import assert from "assert";

process.env.NEXT_PUBLIC_BIOMES_ENABLE_SYNTHETIC_ROAD_AHEAD = "1";

describe("harthmere live world-object inspect candidates (current)", () => {
  const facingPlusX: readonly [number, number, number] = [1, 0, 0];

  // The exact labels from the reported screenshots (live, not in any static
  // landmark table) must resolve to the open-container action.
  it("resolves the live container labels from the screenshots", () => {
    for (const label of ["Clothing Crate", "Chest The Grove Underwater Main"]) {
      assert.ok(
        isHarthmereInspectableWorldObject({ label }),
        `${label} should be an inspectable world object`
      );
      assert.ok(
        isHarthmereContainerObjectLabel({ label }),
        `${label} should be a container`
      );
      const interaction = harthmereObjectInteractionForLabel({ label });
      assert.strictEqual(
        interaction?.kind,
        "open_container",
        `${label} should open as a container`
      );
    }
  });

  // A live ECS candidate is built by the client as { id: `ecs:<entityId>`, ... }.
  // It must flow through the selector exactly like a static landmark prop.
  it("selects a live ECS container candidate the player faces", () => {
    const candidates: HarthmereWorldObjectCandidate[] = [
      {
        id: "ecs:8923129305317123",
        label: "Clothing Crate",
        position: [3, 0, 0],
      },
    ];
    const selected = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates,
    });
    assert.ok(selected, "faced live container should be selected");
    assert.strictEqual(selected!.id, "ecs:8923129305317123");
    assert.strictEqual(selected!.isContainer, true);
    assert.strictEqual(selected!.interaction.kind, "open_container");
  });

  // Static landmark candidates and live ECS candidates are merged into one list;
  // the nearest faced one still wins, and the caller can map the chosen id back
  // to a real entity id (live ids are the only ones in the map).
  it("merges static + live candidates and maps the winner to its entity id", () => {
    const entityIdByCandidateId = new Map<string, number>([
      ["ecs:4935319490671922", 4935319490671922],
    ]);
    const candidates: HarthmereWorldObjectCandidate[] = [
      // static landmark prop (string id, not in the entity-id map)
      { id: "grove_tool_crate", label: "Road Kit Crate", position: [5, 0, 0] },
      // live ECS chest, closer and faced -> should win
      {
        id: "ecs:4935319490671922",
        label: "Chest The Grove Underwater Secret",
        position: [2, 0, 0],
      },
    ];
    const selected = selectNearestHarthmereWorldObjectInspectable({
      playerPosition: [0, 0, 0],
      facingView: facingPlusX,
      candidates,
    });
    assert.ok(selected);
    assert.strictEqual(selected!.id, "ecs:4935319490671922");
    assert.strictEqual(
      entityIdByCandidateId.get(selected!.id),
      4935319490671922,
      "winner maps back to its real entity id"
    );
    assert.strictEqual(
      entityIdByCandidateId.get("grove_tool_crate"),
      undefined,
      "static landmark props have no live entity id"
    );
  });

  // Non-container world objects keep their own per-type action when bridged from
  // live ECS entities (doors open, boards read, cookpots cook, ...).
  it("resolves per-type actions for non-container live objects", () => {
    const cases: Array<[string, string]> = [
      ["Grove Storehouse Door", "open_door"],
      ["Fountain Lesson Board", "read"],
      ["Carlo's Cookpot", "cook"],
      ["Business Craft Table", "craft"],
      ["Campfire", "cook"],
      ["Cooking Pot", "cook"],
      ["Orchard Softwood Branches", "gather"],
      ["Boar Sounder Harvest", "gather"],
      ["Broken Safe-Zone Fence", "repair"],
    ];
    for (const [label, kind] of cases) {
      const selected = selectNearestHarthmereWorldObjectInspectable({
        playerPosition: [0, 0, 0],
        facingView: facingPlusX,
        candidates: [{ id: `ecs:1:${label}`, label, position: [2, 0, 0] }],
      });
      assert.ok(selected, `${label} should be selectable`);
      assert.strictEqual(
        selected!.interaction.kind,
        kind,
        `${label} should resolve to ${kind}`
      );
    }
  });

  // Living entities (players / NPCs / robots) must never be offered the
  // world-object prompt even if they pass through the same scan.
  it("rejects living entities so they keep Talk, not Open", () => {
    for (const label of ["Jackie", "Mira Thatch", "Mucked Robot", "bimes2"]) {
      assert.ok(
        !isHarthmereInspectableWorldObject({ label }),
        `${label} must not be a world object`
      );
    }
  });
});
