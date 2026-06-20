/// <reference types="mocha" />
import assert from "assert";
import { harthmereObjectiveMiniMapPinsFromLandmarks } from "../harthmere_objective_minimap_pins";

// HARTHMERE_OBJECTIVE_MINIMAP_PINS
describe("harthmereObjectiveMiniMapPinsFromLandmarks", () => {
  it("maps accepted-job / helper-quest landmarks to minimap pins", () => {
    const pins = harthmereObjectiveMiniMapPinsFromLandmarks([
      { id: "jobs_board_todo:7", label: "Deliver Apples", position: [10, 50, -20] },
      { id: "live_entity_helper:exotic", label: "Exotic Matter", position: [428, 53, -160] },
    ]);
    assert.deepStrictEqual(pins, [
      { key: "jobs_board_todo:7", markerId: "jobs_board_todo:7", label: "Deliver Apples", position: [10, 50, -20] },
      { key: "live_entity_helper:exotic", markerId: "live_entity_helper:exotic", label: "Exotic Matter", position: [428, 53, -160] },
    ]);
  });

  it("dedupes by id and drops landmarks without a finite position", () => {
    const pins = harthmereObjectiveMiniMapPinsFromLandmarks([
      { id: "a", label: "A", position: [1, 2, 3] },
      { id: "a", label: "A dup", position: [9, 9, 9] },
      { id: "b", label: "no pos" },
      { id: "c", label: "bad pos", position: [1, "x" as any, 3] },
      { id: "", label: "no id", position: [0, 0, 0] },
    ]);
    assert.strictEqual(pins.length, 1);
    assert.strictEqual(pins[0].markerId, "a");
  });

  it("defaults a blank label to 'Objective'", () => {
    const pins = harthmereObjectiveMiniMapPinsFromLandmarks([
      { id: "x", label: "  ", position: [0, 0, 0] },
    ]);
    assert.strictEqual(pins[0].label, "Objective");
  });
});
