/// <reference types="mocha" />

import {
  readHarthmereCombatPresentation,
  resetHarthmereCombatPresentationForTest,
  setHarthmereBiomesUiOpen,
  setHarthmereCombatPresentationActive,
} from "@/client/game/util/harthmere_combat_presentation";
import assert from "assert";

describe("Harthmere combat presentation", () => {
  beforeEach(() => resetHarthmereCombatPresentationForTest());

  it("suspends quest presentation only during active combat with the main UI closed", () => {
    assert.equal(readHarthmereCombatPresentation().suspended, false);
    setHarthmereCombatPresentationActive(true);
    assert.equal(readHarthmereCombatPresentation().suspended, true);
    setHarthmereBiomesUiOpen(true);
    assert.equal(readHarthmereCombatPresentation().suspended, false);
    setHarthmereBiomesUiOpen(false);
    assert.equal(readHarthmereCombatPresentation().suspended, true);
    setHarthmereCombatPresentationActive(false);
    assert.equal(readHarthmereCombatPresentation().suspended, false);
  });
});
