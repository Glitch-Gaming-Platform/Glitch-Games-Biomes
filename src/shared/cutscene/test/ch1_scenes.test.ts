/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  CH1_MEMORY_STAGE,
  CH1_CONSOLIDATION_PLAYBACK_SEQUENCE,
  CH1_SCENE_ACTING_CUES,
  CH1_SCENE_FACTORIES,
  CH1_SCENE_IDS,
  ch1AllScenes,
  ch1CorridorCutscene,
  ch1ConsolidationRevisionCutscene,
  ch1IgnitionCutscene,
} from "../ch1_scenes";
import { validateCutsceneDef } from "../schema";
import {
  CH1_CONSOLIDATION_ENTRY_SECONDS,
  CH1_CONSOLIDATION_ORDER,
} from "@/shared/harthmere/ch1_fragment_ledger";
import { ch1QuestCutsceneIds } from "@/shared/harthmere/ch1_quests";
import { CH1_ANCHORS, CH1_NPC_ENTITY_IDS } from "@/shared/harthmere/ch1_ids";
import { isHarthmereCinematicExpression } from "../cinematic_expressions";
import { SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET } from "../puppets";

describe("ch1 cutscenes - validity", () => {
  it("every authored scene validates", () => {
    for (const [id, factory] of CH1_SCENE_FACTORIES) {
      const def = factory();
      const result = validateCutsceneDef(def);
      assert.ok(
        result.ok,
        `${id} failed validation: ${
          result.ok
            ? ""
            : result.issues.map((i) => `${i.path}: ${i.message}`).join("; ")
        }`
      );
    }
  });

  it("scene ids are unique and match their registry key", () => {
    for (const [id, factory] of CH1_SCENE_FACTORIES) {
      assert.equal(
        factory().id,
        id,
        `registry key ${id} disagrees with def id`
      );
    }
    const ids = ch1AllScenes().map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("gives every scene a deliberate cinematic acting plan", () => {
    assert.deepStrictEqual(
      Object.keys(CH1_SCENE_ACTING_CUES).sort(),
      [...CH1_SCENE_FACTORIES.keys()].sort()
    );
    for (const scene of ch1AllScenes()) {
      const expressions = scene.shots
        .flatMap((shot) => shot.actions)
        .filter(
          (action) =>
            action.kind === "emote" &&
            isHarthmereCinematicExpression(action.emote)
        );
      assert.ok(expressions.length > 0, `${scene.id}: no cinematic acting`);
    }
  });

  it("never authors a procedural Three.js human fallback", () => {
    for (const scene of ch1AllScenes()) {
      for (const member of scene.cast) {
        if (
          member.binding.kind === "ghost" &&
          member.binding.family === "human"
        ) {
          assert.equal(
            member.binding.asset,
            SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
            `${scene.id}/${member.role}: human ghost must use PlayerMesh`
          );
        }
        assert.ok(
          !member.ghostAsset?.startsWith("townsperson_"),
          `${scene.id}/${member.role}: legacy townsperson fallback is forbidden`
        );
      }
    }
  });

  it("hides the gameplay HUD and hotbar throughout Chapter 1 cinematics", () => {
    for (const scene of ch1AllScenes()) {
      assert.equal(scene.settings.hideHud, true, scene.id);
    }
  });

  it("smooths every Chapter 1 camera handoff instead of hard-cutting", () => {
    for (const scene of ch1AllScenes()) {
      assert.equal(scene.shots[0].transitionIn, "fade", scene.id);
      for (const shot of scene.shots.slice(1)) {
        assert.notEqual(
          shot.transitionIn,
          "cut",
          `${scene.id}/${shot.id}: interior camera hard-cut`
        );
        if (shot.transitionIn === "blend") {
          assert.ok(
            shot.blendSeconds >= 0.55,
            `${scene.id}/${shot.id}: blend is too abrupt`
          );
        }
      }
    }
  });

  it("keeps every expression cue on an existing actor and inside its shot", () => {
    for (const scene of ch1AllScenes()) {
      const roles = new Set(scene.cast.map((member) => member.role));
      for (const shot of scene.shots) {
        for (const action of shot.actions) {
          if (
            action.kind !== "emote" ||
            !isHarthmereCinematicExpression(action.emote)
          ) {
            continue;
          }
          assert.ok(roles.has(action.role), `${scene.id}: ${action.role}`);
          assert.ok(
            action.at < shot.duration,
            `${scene.id}/${shot.id}: ${action.emote} starts after the shot`
          );
        }
      }
    }
  });

  it("does not assign emotional expressions to the Chapter 1 robot", () => {
    assert.deepStrictEqual(
      CH1_SCENE_ACTING_CUES[CH1_SCENE_IDS.ignition].map(
        (cue) => cue.expression
      ),
      ["getUp"],
      "AUGUR-9 may stand up mechanically but must not perform human emotions"
    );
  });

  it("gives every revised human dialogue beat to its speaking actor", () => {
    const expected = [
      [CH1_SCENE_IDS.confrontation, "line-1", "a", "determined"],
      [CH1_SCENE_IDS.sorrelDoor, "line-0", "a", "annoyance"],
      [CH1_SCENE_IDS.sorrelDoor, "line-2", "a", "determined"],
      [CH1_SCENE_IDS.theCase, "line-1", "a", "determined"],
      [CH1_SCENE_IDS.theCase, "line-2", "a", "determined"],
      [CH1_SCENE_IDS.theCase, "line-5", "a", "uncertainty"],
      [CH1_SCENE_IDS.tooLate, "line-2", "a", "determined"],
      [CH1_SCENE_IDS.theWatchHouse, "line-2", "a", "sadness"],
    ] as const;
    for (const [sceneId, shotId, role, expression] of expected) {
      assert.ok(
        CH1_SCENE_ACTING_CUES[sceneId].some(
          (cue) =>
            cue.shotId === shotId &&
            cue.role === role &&
            cue.expression === expression
        ),
        `${sceneId}/${shotId}: ${role} must perform ${expression}`
      );
    }
    assert.ok(
      CH1_SCENE_ACTING_CUES[CH1_SCENE_IDS.confrontation].some(
        (cue) =>
          cue.shotId === "line-2" &&
          cue.role === "b" &&
          cue.expression === "anger"
      )
    );
  });

  it("no scene can hang: every shot is finitely bounded", () => {
    for (const scene of ch1AllScenes()) {
      for (const shot of scene.shots) {
        assert.ok(shot.duration > 0, `${scene.id}/${shot.id} has no duration`);
        if (shot.until) {
          assert.ok(
            shot.until.maxDuration >= shot.duration,
            `${scene.id}/${shot.id}: maxDuration must cap duration`
          );
        }
      }
    }
  });

  it("every scene remains skippable for accessibility", () => {
    for (const scene of ch1AllScenes()) {
      assert.ok(
        scene.settings.skipAfterSeconds <= 10,
        `${scene.id}: a player must always be able to skip within 10s`
      );
    }
  });

  it("stages every reconstructed flashback before sampling its first camera", () => {
    for (const id of [
      CH1_SCENE_IDS.overlayIveGotYou,
      CH1_SCENE_IDS.reconCorridor,
      `${CH1_SCENE_IDS.reconCorridor}-revised`,
      CH1_SCENE_IDS.reconIntake,
    ]) {
      const scene = CH1_SCENE_FACTORIES.get(id)?.();
      assert.ok(scene, `${id}: missing scene`);
      const teleport = scene.shots[0].actions.find(
        (action) => action.kind === "teleport" && action.role === "player"
      );
      assert.ok(teleport?.kind === "teleport", `${id}: player is not staged`);
      assert.deepStrictEqual(teleport.to, CH1_MEMORY_STAGE, id);
    }
  });

  it("grounds the shared memory stage inside the measured road-house aisle", () => {
    assert.deepStrictEqual(CH1_MEMORY_STAGE, CH1_ANCHORS.memory_corridor_stage);
    assert.deepStrictEqual(CH1_MEMORY_STAGE, [474, 70, -133]);
    assert.ok(
      CH1_MEMORY_STAGE[1] < 100,
      "a flashback stage must not leave the client-puppet player falling in the sky"
    );
  });

  it("keeps the ignition reaction camera outside the player model", () => {
    const scene = ch1IgnitionCutscene();
    const augur = scene.cast.find((member) => member.role === "augur9");
    assert.equal(augur?.binding.kind, "entity");
    if (augur?.binding.kind === "entity") {
      assert.equal(augur.binding.entityId, CH1_NPC_ENTITY_IDS.augur9);
    }
    const reaction = scene.shots.find((shot) => shot.id === "it-looks-at-you");
    assert.equal(reaction?.camera.kind, "overShoulder");
    if (reaction?.camera.kind === "overShoulder") {
      assert.ok(reaction.camera.pullout >= 2.4);
    }
    const recording = scene.shots.find((shot) => shot.id === "your-own-voice");
    assert.equal(recording?.camera.kind, "overShoulder");
    if (recording?.camera.kind === "overShoulder") {
      assert.ok(recording.camera.pullout >= 3);
    }
  });

  it("makes every registered scene reachable from production objective playback", () => {
    const reachable = new Set([
      ...ch1QuestCutsceneIds(),
      ...CH1_CONSOLIDATION_PLAYBACK_SEQUENCE,
    ]);
    assert.deepEqual(
      [...CH1_SCENE_FACTORIES.keys()].filter((id) => !reachable.has(id)),
      []
    );
  });

  it("keeps the fence-line camera above the hilly ridge and stages Jackie beside the seam", () => {
    const scene = CH1_SCENE_FACTORIES.get(CH1_SCENE_IDS.firstGate)!();
    assert.deepStrictEqual(CH1_ANCHORS.gate_fence_sighting, [543, 69, -221]);
    const dolly = scene.shots.find((shot) => shot.id === "the-seam")?.camera;
    assert.equal(dolly?.kind, "dolly");
    if (dolly?.kind === "dolly") {
      for (const waypoint of dolly.waypoints) {
        assert.ok(
          waypoint.position[1] >= CH1_ANCHORS.gate_fence_sighting[1] + 2,
          `camera ${waypoint.position.join("/")} is inside the fence ridge`
        );
      }
    }
    const cameraPositions = scene.shots.flatMap((shot) =>
      shot.camera.kind === "static"
        ? [shot.camera.position]
        : shot.camera.kind === "dolly"
          ? shot.camera.waypoints.map((waypoint) => waypoint.position)
          : []
    );
    assert.deepStrictEqual(cameraPositions, [
      [550, 74, -230],
      [554, 75, -232],
      [550, 73, -228],
      [550, 73, -228],
      [548, 72.5, -227],
    ]);
    const stage = scene.shots[0].actions.find(
      (action) => action.kind === "teleport" && action.role === "jackie"
    );
    assert.ok(stage?.kind === "teleport");
    if (stage?.kind === "teleport" && Array.isArray(stage.to)) {
      assert.ok(
        Math.hypot(
          stage.to[0] - CH1_ANCHORS.gate_fence_sighting[0],
          stage.to[2] - CH1_ANCHORS.gate_fence_sighting[2]
        ) < 8
      );
    }
    assert.deepStrictEqual(
      stage?.kind === "teleport" ? stage.to : undefined,
      [539, 70, -215]
    );
    const playerStage = scene.shots[0].actions.find(
      (action) => action.kind === "teleport" && action.role === "player"
    );
    assert.deepStrictEqual(
      playerStage?.kind === "teleport" ? playerStage.to : undefined,
      [536, 69, -218]
    );
  });

  it("aims the persistent-gate reveal at the two-metre aperture", () => {
    const scene = CH1_SCENE_FACTORIES.get(CH1_SCENE_IDS.persistentGate)!();
    const target = scene.cast.find((member) => member.role === "revealTarget");
    assert.equal(target?.binding.kind, "anchor");
    if (target?.binding.kind === "anchor") {
      assert.deepStrictEqual(target.binding.position, CH1_ANCHORS.gate_desert);
      assert.equal(target.binding.height, 2);
    }
    const camera = scene.shots[0].camera;
    assert.equal(camera.kind, "static");
    if (camera.kind === "static") {
      assert.deepStrictEqual(camera.position, [658, 62, -472]);
      assert.ok(camera.orientation);
    }
    const dialogue = scene.shots.find((shot) => shot.id === "rook-says-it");
    assert.equal(dialogue?.camera.kind, "static");
    if (dialogue?.camera.kind === "static") {
      assert.deepStrictEqual(dialogue.camera.position, [654, 60, -450]);
      assert.ok(dialogue.camera.orientation);
    }
    assert.ok(
      scene.shots[0].actions.some(
        (action) => action.kind === "teleport" && action.role === "rook"
      )
    );
  });

  it("aims the Ashline containment reveal above the intake floor", () => {
    const scene = CH1_SCENE_FACTORIES.get(CH1_SCENE_IDS.overlayContainment)!();
    const camera = scene.shots[0].camera;
    assert.equal(camera.kind, "static");
    if (camera.kind === "static") {
      assert.deepStrictEqual(camera.position, [666, 70, -60]);
      assert.ok(camera.orientation);
    }
    assert.ok(
      scene.shots[0].actions.some(
        (action) => action.kind === "teleport" && action.role === "calla"
      )
    );
  });

  it("shows the carried player in the arrival reconstruction", () => {
    const scene = CH1_SCENE_FACTORIES.get(CH1_SCENE_IDS.reconArrival)!();
    const actions = scene.shots[0].actions;
    assert.ok(
      actions.some(
        (action) => action.kind === "teleport" && action.role === "player"
      )
    );
    assert.ok(
      actions.some(
        (action) =>
          action.kind === "emote" &&
          action.role === "player" &&
          action.emote === "injury"
      )
    );
    assert.ok(
      actions.some(
        (action) => action.kind === "moveTo" && action.role === "player"
      )
    );
    const carrier = scene.cast.find((member) => member.role === "carrier");
    assert.equal(carrier?.binding.kind, "ghost");
    if (carrier?.binding.kind === "ghost") {
      assert.deepStrictEqual(carrier.binding.spawnAt, [472.8, 70, -146]);
    }
    assert.ok(
      scene.shots.every(
        (shot) =>
          shot.camera.kind !== "static" || Boolean(shot.camera.orientation)
      )
    );
    const opening = scene.shots[0].camera;
    assert.equal(opening.kind, "static");
    if (opening.kind === "static") {
      assert.deepStrictEqual(opening.position, [481, 71.5, -145]);
      assert.ok(opening.orientation);
    }
    const carriedStop = scene.cast.find(
      (member) => member.role === "carriedStop"
    );
    assert.equal(carriedStop?.binding.kind, "anchor");
    if (carriedStop?.binding.kind === "anchor") {
      assert.deepStrictEqual(carriedStop.binding.position, [474.2, 70, -139.8]);
    }
    const playerMove = actions.find(
      (action) => action.kind === "moveTo" && action.role === "player"
    );
    assert.deepStrictEqual(
      playerMove?.kind === "moveTo" ? playerMove.to : undefined,
      { role: "carriedStop" }
    );
  });

  it("keeps both corridor memory actors inside the visible aisle", () => {
    for (const revised of [false, true]) {
      const scene = ch1CorridorCutscene({ revised });
      const woman = scene.cast.find((member) => member.role === "woman");
      const man = scene.cast.find((member) => member.role === "man");
      assert.equal(woman?.binding.kind, "ghost");
      assert.equal(man?.binding.kind, "ghost");
      if (woman?.binding.kind === "ghost") {
        assert.deepStrictEqual(woman.binding.spawnAt, [474, 70, -129]);
      }
      if (man?.binding.kind === "ghost") {
        assert.deepStrictEqual(man.binding.spawnAt, [474.8, 70, -134.6]);
      }
      const womanMove = scene.shots
        .flatMap((shot) => shot.actions)
        .find((action) => action.kind === "moveTo" && action.role === "woman");
      assert.equal(
        womanMove?.kind === "moveTo" ? womanMove.speed : undefined,
        1.2
      );
    }
  });

  it("frames Lou for the word that triggers consolidation", () => {
    const scene = ch1ConsolidationRevisionCutscene();
    const first = scene.shots[0];
    assert.equal(first.camera.kind, "overShoulder");
    if (first.camera.kind === "overShoulder") {
      assert.equal(first.camera.from, "player");
      assert.equal(first.camera.to, "lou");
      assert.ok(first.camera.pullout >= 2.4);
    }
    assert.ok(scene.cast.some((member) => member.role === "lou"));
    const stage = scene.cast.find(
      (member) => member.role === "consolidation-stage"
    );
    assert.equal(stage?.binding.kind, "anchor");
    if (stage?.binding.kind === "anchor") {
      assert.deepStrictEqual(
        stage.binding.position,
        CH1_ANCHORS.returnstone_pad_office
      );
    }
    assert.equal(scene.settings.timeOfDay, 0.62);
    assert.ok(
      scene.shots[0].actions.some(
        (action) => action.kind === "teleport" && action.role === "lou"
      )
    );
    assert.ok(
      scene.shots.every((shot) => shot.camera.kind !== "pov"),
      "consolidation must not put the camera inside the player model"
    );
  });

  it("keeps every Watch House camera and actor inside the authored room", () => {
    const scene = CH1_SCENE_FACTORIES.get(CH1_SCENE_IDS.theWatchHouse)!();
    const stage = scene.cast.find(
      (member) => member.role === "conversation-stage"
    );
    assert.equal(stage?.binding.kind, "anchor");
    if (stage?.binding.kind === "anchor") {
      assert.deepStrictEqual(stage.binding.position, [472, 70, -149.5]);
    }
    assert.equal(scene.settings.timeOfDay, 0.55);
    for (const shot of scene.shots) {
      assert.equal(shot.camera.kind, "static");
      if (shot.camera.kind !== "static") continue;
      const [x, y, z] = shot.camera.position;
      assert.ok(x >= 469 && x <= 476, `${shot.id}: camera left the room`);
      assert.ok(y >= 70 && y <= 73, `${shot.id}: camera left the room`);
      assert.ok(z >= -152 && z <= -145, `${shot.id}: camera left the room`);
      assert.ok(shot.camera.orientation);
    }
  });

  it("stages every present-day conversation and gives its exact actor a ghost fallback", () => {
    for (const id of [
      CH1_SCENE_IDS.theFlinch,
      CH1_SCENE_IDS.confrontation,
      CH1_SCENE_IDS.sorrelDoor,
      CH1_SCENE_IDS.theCase,
      CH1_SCENE_IDS.tooLate,
      CH1_SCENE_IDS.theWatchHouse,
    ]) {
      const scene = CH1_SCENE_FACTORIES.get(id)!();
      const actor = scene.cast.find((member) => member.role === "a");
      assert.equal(actor?.binding.kind, "entity", id);
      assert.equal(actor?.fallback, "ghost", id);
      assert.ok(actor?.ghostAsset, `${id}: missing renderer fallback`);
      assert.ok(
        scene.cast.some(
          (member) =>
            member.role === "conversation-stage" &&
            member.binding.kind === "anchor"
        ),
        `${id}: missing authored world-stage focus`
      );
      for (const role of ["a", "b"]) {
        assert.ok(
          scene.shots[0].actions.some(
            (action) => action.kind === "teleport" && action.role === role
          ),
          `${id}: ${role} is not staged before the first camera`
        );
      }
    }
    const sorrel = CH1_SCENE_FACTORIES.get(CH1_SCENE_IDS.sorrelDoor)!();
    const stage = sorrel.cast.find(
      (member) => member.role === "conversation-stage"
    );
    assert.equal(stage?.binding.kind, "anchor");
    if (stage?.binding.kind === "anchor") {
      assert.deepStrictEqual(stage.binding.position, [3444, 65, -344]);
    }
  });

  it("puts Rook and Calla on screen for their own dialogue", () => {
    for (const [sceneId, role, expectedEntityId] of [
      [CH1_SCENE_IDS.persistentGate, "rook", CH1_NPC_ENTITY_IDS.halden_rook],
      [
        CH1_SCENE_IDS.overlayContainment,
        "calla",
        CH1_NPC_ENTITY_IDS.calla_ashe,
      ],
    ] as const) {
      const scene = CH1_SCENE_FACTORIES.get(sceneId)!();
      const actor = scene.cast.find((member) => member.role === role);
      assert.equal(actor?.binding.kind, "entity");
      if (actor?.binding.kind === "entity") {
        assert.equal(actor.binding.entityId, expectedEntityId);
      }
      const spoken = scene.shots
        .flatMap((shot) => shot.actions)
        .find((action) => action.kind === "dialogue");
      assert.equal(spoken?.kind === "dialogue" ? spoken.role : undefined, role);
    }
  });

  it("uses external coverage for memory actors that vanished in POV captures", () => {
    for (const id of [
      CH1_SCENE_IDS.overlayIveGotYou,
      CH1_SCENE_IDS.reconCorridor,
      `${CH1_SCENE_IDS.reconCorridor}-revised`,
      CH1_SCENE_IDS.reconIntake,
    ]) {
      const scene = CH1_SCENE_FACTORIES.get(id)!();
      assert.notEqual(
        scene.shots[0].camera.kind,
        "pov",
        `${id}: first shot repeated the empty-ghost POV failure`
      );
    }
  });

  it("does not repeat dialogue already completed by the preceding choice", () => {
    const watch = CH1_SCENE_FACTORIES.get(CH1_SCENE_IDS.theWatchHouse)!();
    const watchText = watch.shots
      .flatMap((shot) => shot.actions)
      .filter((action) => action.kind === "dialogue")
      .map((action) => action.text)
      .join(" ");
    assert.ok(!watchText.includes("Did he take it?"));

    const confrontation = CH1_SCENE_FACTORIES.get(
      CH1_SCENE_IDS.confrontation
    )!();
    const confrontationText = confrontation.shots
      .flatMap((shot) => shot.actions)
      .filter((action) => action.kind === "dialogue")
      .map((action) => action.text)
      .join(" ");
    assert.ok(!confrontationText.includes("What have you been putting"));
    assert.ok(confrontationText.includes("Ask me again in a month."));
  });
});

// ---------------------------------------------------------------------------
// THE REVISION PROMISE
// ---------------------------------------------------------------------------

describe("ch1 cutscenes - the revision promise", () => {
  // Journal §10.1, rule 2: "A revised Reconstruction may only re-render what
  // was already on screen. It may not add a shot, a line, or an angle."
  //
  // If this test fails, we have cheated the player.

  const original = ch1CorridorCutscene({ revised: false });
  const revised = ch1CorridorCutscene({ revised: true });

  it("has an identical shot list", () => {
    assert.equal(
      revised.shots.length,
      original.shots.length,
      "the revision must not add or remove a shot"
    );
    assert.deepEqual(
      revised.shots.map((s) => s.id),
      original.shots.map((s) => s.id),
      "shot ids must be identical"
    );
  });

  it("has identical timing", () => {
    for (const [i, shot] of original.shots.entries()) {
      assert.equal(
        revised.shots[i].duration,
        shot.duration,
        `${shot.id}: duration changed between renderings`
      );
      assert.deepEqual(
        revised.shots[i].until,
        shot.until,
        `${shot.id}: until condition changed`
      );
      assert.equal(
        revised.shots[i].transitionIn,
        shot.transitionIn,
        `${shot.id}: transition changed`
      );
      assert.equal(revised.shots[i].blendSeconds, shot.blendSeconds);
    }
  });

  it("has identical camera work — not one new angle", () => {
    for (const [i, shot] of original.shots.entries()) {
      assert.deepEqual(
        revised.shots[i].camera,
        shot.camera,
        `${shot.id}: the camera moved between renderings. This is the exact ` +
          `thing the fair-play contract forbids.`
      );
    }
  });

  it("has the same number of beats in the same order", () => {
    for (const [i, shot] of original.shots.entries()) {
      const a = shot.actions.map((x) => `${x.kind}@${x.at}`);
      const b = revised.shots[i].actions.map((x) => `${x.kind}@${x.at}`);
      assert.deepEqual(
        b,
        a,
        `${shot.id}: action kinds/timings changed between renderings`
      );
    }
  });

  it("changes only who the woman is and what she is holding", () => {
    const originalWoman = original.cast.find((c) => c.role === "woman");
    const revisedWoman = revised.cast.find((c) => c.role === "woman");
    assert.ok(originalWoman && revisedWoman);
    assert.equal(originalWoman.binding.kind, "ghost");
    assert.equal(revisedWoman.binding.kind, "ghost");
    // Same staging position: she stood exactly where she stood.
    if (
      originalWoman.binding.kind === "ghost" &&
      revisedWoman.binding.kind === "ghost"
    ) {
      assert.deepEqual(
        revisedWoman.binding.spawnAt,
        originalWoman.binding.spawnAt,
        "the woman must occupy the same position in both renderings"
      );
    }
  });

  it("the revised rendering commits nothing (the Act 3 recovery already happened)", () => {
    assert.equal(original.onEnd.commits.length, 1);
    assert.equal(revised.onEnd.commits.length, 0);
  });

  it("names Ardan only in the revised rendering", () => {
    const text = (def: typeof original) =>
      def.shots
        .flatMap((s) => s.actions)
        .filter((a) => a.kind === "dialogue")
        .map(
          (a) =>
            `${(a as { speaker?: string }).speaker ?? ""} ${
              (a as { text: string }).text
            }`
        )
        .join(" ")
        .toLowerCase();
    assert.ok(!text(original).includes("ardan"), "Act 3 must not name him");
    assert.ok(text(revised).includes("ardan"), "Act 6 must name him");
    assert.ok(!text(original).includes("jackie"), "Act 3 must not name her");
    assert.ok(text(revised).includes("jackie"), "Act 6 must name her");
  });
});

// ---------------------------------------------------------------------------

describe("ch1 cutscenes - the consolidation sequence", () => {
  const def = ch1ConsolidationRevisionCutscene();

  it("revises all six ledger entries in order", () => {
    const revisionShots = def.shots.filter((s) => s.id.startsWith("revision-"));
    assert.equal(revisionShots.length, CH1_CONSOLIDATION_ORDER.length);
    for (const [i, fragmentId] of CH1_CONSOLIDATION_ORDER.entries()) {
      assert.ok(
        revisionShots[i].id.endsWith(fragmentId),
        `revision ${i} should be ${fragmentId}`
      );
      assert.equal(revisionShots[i].duration, CH1_CONSOLIDATION_ENTRY_SECONDS);
    }
  });

  it("accepts no input during the revisions", () => {
    for (const shot of def.shots.filter((s) => s.id.startsWith("revision-"))) {
      assert.equal(
        shot.until,
        undefined,
        "revision shots must not wait on player input"
      );
    }
    assert.equal(def.settings.skippable, false);
  });

  it("renames the Card and applies consolidation on completion", () => {
    const hooks = def.onEnd.commits.map((c) => c.hook);
    assert.ok(hooks.includes("ch1.applyConsolidation"));
    const customHooks = def.shots
      .flatMap((s) => s.actions)
      .filter((a) => a.kind === "custom")
      .map((a) => (a as { hook: string }).hook);
    assert.ok(customHooks.includes("ch1.renameCard"));
    assert.ok(customHooks.includes("ch1.reviseLedgerEntry"));
  });

  it("is bounded", () => {
    const total = def.shots.reduce((n, s) => n + s.duration, 0);
    assert.ok(total < def.settings.maxSceneDurationSeconds);
    assert.ok(total > 20 && total < 90, `sequence is ${total}s`);
  });
});

// ---------------------------------------------------------------------------

describe("ch1 cutscenes - the ignition", () => {
  it("fires the player's own voice out of the robot", () => {
    const def = ch1IgnitionCutscene();
    assert.equal(def.id, CH1_SCENE_IDS.ignition);
    const lines = def.shots
      .flatMap((s) => s.actions)
      .filter((a) => a.kind === "dialogue")
      .map((a) => (a as { text: string }).text);
    assert.ok(lines.some((l) => l.includes("custodian recognized")));
    assert.ok(
      lines.some((l) => l.includes("I was right")),
      "the chapter starts on the player's own recorded voice"
    );
  });

  it("opens the ledger", () => {
    const hooks = ch1IgnitionCutscene().onEnd.commits.map((c) => c.hook);
    assert.ok(hooks.includes("ch1.begin"));
    assert.ok(hooks.includes("ch1.unlockLedger"));
  });
});
