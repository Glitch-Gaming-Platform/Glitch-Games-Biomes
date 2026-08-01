import { ch1AllScenes } from "@/shared/cutscene/ch1_scenes";
import {
  CH1_VOICE_ACTORS,
  ch1VoiceActorForSpeaker,
} from "@/shared/harthmere/ch1_voice";
import { HARTHMERE_NPC_VOICE_CATALOG } from "@/shared/harthmere/npc_voice_catalog";
import { CH1_SERGEANT_HOLT } from "@/shared/harthmere/ch1_returning_npcs";
import assert from "assert";

describe("Chapter 1 NPC voices", () => {
  it("assigns a stable voice and at least one committed line to every voiced actor", () => {
    for (const actor of CH1_VOICE_ACTORS) {
      const entry = HARTHMERE_NPC_VOICE_CATALOG.find(
        (candidate) =>
          candidate.displayName === actor.displayName &&
          candidate.profile.voiceParameterId === actor.profile.voiceParameterId
      );
      assert.ok(
        entry,
        `missing Chapter 1 catalog entry for ${actor.displayName}`
      );
      assert.ok(
        entry.staticLines.length > 0,
        `missing Chapter 1 MP3 plan for ${actor.displayName}`
      );
      assert.strictEqual(
        entry.profile.voiceParameterId,
        actor.profile.voiceParameterId
      );
    }
  });

  it("voices NPC cinematic lines while leaving player and narration lines text-only", () => {
    const dialogue = ch1AllScenes().flatMap((scene) =>
      scene.shots.flatMap((shot) =>
        shot.actions
          .filter((action) => action.kind === "dialogue")
          .map((action) => ({ sceneId: scene.id, shotId: shot.id, action }))
      )
    );
    const voiced = dialogue.filter(({ action }) => action.voice);
    assert.strictEqual(voiced.length, 46);
    assert.ok(
      voiced.every(({ action }) =>
        CH1_VOICE_ACTORS.some(
          (actor) => actor.profile.voiceParameterId === action.voice
        )
      )
    );

    const unvoicedText = dialogue
      .filter(({ action }) => !action.voice)
      .map(({ action }) => action.text);
    assert.ok(unvoicedText.includes("Not this small."));
    assert.ok(unvoicedText.includes("I didn't sign that."));
    assert.ok(
      unvoicedText.some((text) => text.includes("anyone is hearing this")),
      "the player's stored voice must not be replaced by an NPC actor"
    );

    for (const scene of ch1AllScenes()) {
      for (const shot of scene.shots) {
        for (const action of shot.actions) {
          if (action.kind !== "dialogue" || !action.voice) {
            continue;
          }
          assert.ok(
            action.duration,
            `${scene.id}/${shot.id} needs voice timing`
          );
          assert.ok(
            shot.duration >= action.at + action.duration,
            `${scene.id}/${shot.id} cuts off its voiced line`
          );
          if (shot.until?.kind === "dialogueDone") {
            assert.ok(
              shot.until.maxDuration >= shot.duration,
              `${scene.id}/${shot.id} has an invalid dialogue ceiling`
            );
          }
        }
      }
    }
  });

  it("keeps returning characters on their established actor identity", () => {
    const jackie = ch1VoiceActorForSpeaker("Jackie");
    const existingJackie = HARTHMERE_NPC_VOICE_CATALOG.find(
      (entry) => entry.source === "snapshot_grove" && entry.id === "jackie"
    );
    assert.ok(jackie && existingJackie);
    assert.strictEqual(
      jackie.profile.voiceParameterId,
      existingJackie.profile.voiceParameterId
    );
  });

  it("binds Sergeant Holt's dialogue and expressions to his one native ECS body", () => {
    const holt = ch1VoiceActorForSpeaker("Sergeant Bram Holt");
    assert.ok(holt);
    assert.equal(holt.entityId, Number(CH1_SERGEANT_HOLT.entityId));
    assert.equal(
      ch1VoiceActorForSpeaker("Sergeant Bramwell Holt")?.entityId,
      Number(CH1_SERGEANT_HOLT.entityId)
    );
  });

  it("does not leak protected reveal terms through Chapter 1 filenames", () => {
    const forbidden = [
      "stillwater",
      "riverbed",
      "seven",
      "anchor-zero",
      "anchor_zero",
      "ardan-betrayal",
    ];
    const paths = HARTHMERE_NPC_VOICE_CATALOG.filter(
      (entry) => entry.source === "chapter_1_identity"
    ).flatMap((entry) => entry.staticLines.map((line) => line.recordingPath));
    for (const recordingPath of paths) {
      assert.ok(
        forbidden.every((term) => !recordingPath.includes(term)),
        `spoiler leaked through voice filename: ${recordingPath}`
      );
    }
  });
});
