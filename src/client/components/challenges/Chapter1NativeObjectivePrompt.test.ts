/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

describe("Chapter1NativeObjectivePrompt input ownership", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/client/components/challenges/Chapter1NativeObjectivePrompt.tsx"
    ),
    "utf8"
  );

  it("registers one highest-priority story action with the central dispatcher", () => {
    assert.match(source, /useWorldInteractionCandidate\(worldCandidate\)/);
    assert.match(source, /WORLD_INTERACTION_PRIORITY\.chapter1Story/);
    assert.doesNotMatch(source, /window\.addEventListener\("keydown"/);
  });

  it("registers only active, in-range, non-proximity objectives", () => {
    assert.match(source, /state\?\.status === "active"/);
    assert.match(source, /state\.withinRange/);
    assert.match(source, /state\.trigger !== "near_location"/);
    assert.match(source, /disabled: busy/);
  });

  it("coalesces state polls and synchronously excludes completion races", () => {
    assert.match(source, /refreshInFlight\.current/);
    assert.match(source, /if \(refreshInFlight\.current\) return/);
    assert.match(source, /busyRef\.current = true/);
    assert.match(source, /!busyRef\.current/);
  });

  it("exposes authored choice ids for the production browser gate", () => {
    assert.match(source, /data-chapter1-choice-objective=/);
    assert.match(source, /data-chapter1-choice=/);
    assert.match(source, /option\.id === "not_yet"/);
  });

  it("paginates active dialogue before choices or completion", () => {
    assert.match(source, /data-chapter1-dialogue-objective=/);
    assert.match(source, /data-chapter1-dialogue-page=/);
    assert.match(source, /data-chapter1-dialogue-next/);
    assert.match(source, /data-chapter1-dialogue-final=/);
    assert.match(source, /state\.dialogue/);
    assert.match(source, /dialogue\.mode === "objective"/);
  });

  it("pauses background state polling while story modals are open", () => {
    assert.match(source, /modalOpenRef\.current = modalOpen/);
    assert.match(source, /!modalOpenRef\.current/);
  });

  it("runs containment as a no-fail expert interface and prepares combat routes before progress", () => {
    assert.match(source, /Chapter1ContainmentTriage/);
    assert.match(source, /state\.authoredStepId === "the_procedure"/);
    assert.match(source, /action: "prepare"/);
    assert.match(source, /prepareEncounter\(option\.id\)/);
    assert.match(source, /state\.preparedChoice/);
  });

  it("launches authored cinematics from normal objective completion", () => {
    assert.match(source, /requestCutsceneById\(next\.cutsceneId/);
    assert.match(source, /state\?\.introCutsceneId/);
    assert.match(source, /biomes\.chapter1\.cutscene/);
  });
});
