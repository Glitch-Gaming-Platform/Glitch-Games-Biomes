import {
  HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE,
  harthmereAdditiveTownNpcEntityId,
  harthmereAdditiveTownNpcVoiceProfile,
} from "@/shared/harthmere/additive_town_npc_dialogue";
import {
  buildHarthmereDialogueLines,
  dialogueActionsForHarthmereNpc,
} from "@/client/components/challenges/LocalDevHarthmereDialogueSystem";
import { HARTHMERE_NPC_VOICE_CATALOG } from "@/shared/harthmere/npc_voice_catalog";
import type { HarthmereReputationState } from "@/client/components/challenges/LocalDevHarthmereReputation";
import assert from "assert";

const SCORE = {
  likeability: 0,
  legal: 0,
  notoriety: 0,
  notorietyFloor: 0,
};

const REPUTATION_STATE: HarthmereReputationState = {
  version: 1,
  global: { ...SCORE },
  regions: { harthmere: { ...SCORE } },
  personal: {},
  recent: [],
};

function sentenceCount(text: string) {
  return text.match(/[.!?]+(?=\s|$)/g)?.length ?? 0;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const BOARD_REFERENCE = /\bboard\b/i;
const DEVELOPER_JARGON =
  /\b(?:NPC|ECS|runtime|entity|offset|quest objective|developer|gameplay)\b/i;

describe("additive Harthmere town NPC dialogue", () => {
  it("covers all 68 living additive-town NPCs exactly once", () => {
    assert.equal(HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE.length, 68);
    assert.equal(
      new Set(
        HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE.map((profile) => profile.offset)
      ).size,
      68
    );
    assert.ok(
      HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE.every(
        (profile) =>
          profile.offset >= 1 && profile.offset <= 69 && profile.offset !== 41
      )
    );
  });

  it("keeps first contact to one or two short lore-grounded sentences", () => {
    for (const profile of HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE) {
      const sentences = sentenceCount(profile.intro);
      assert.ok(
        sentences >= 1 && sentences <= 2,
        `${profile.displayName} intro has ${sentences} sentences`
      );
      assert.ok(
        wordCount(profile.intro) <= 32,
        `${profile.displayName} intro is too long`
      );
      assert.doesNotMatch(profile.intro, BOARD_REFERENCE);
    }
  });

  it("keeps longer background and district lore behind opt-in choices", () => {
    for (const profile of HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE) {
      for (const [label, text] of [
        ["story", profile.story],
        ["location", profile.location],
      ] as const) {
        const sentences = sentenceCount(text);
        assert.ok(
          sentences >= 3 && sentences <= 5,
          `${profile.displayName} ${label} has ${sentences} sentences`
        );
        assert.ok(
          wordCount(text) >= 25,
          `${profile.displayName} ${label} is not meaningfully detailed`
        );
        assert.doesNotMatch(text, BOARD_REFERENCE);
      }
    }
  });

  it("grounds optional conversations in the wider Harthmere conflict", () => {
    const optionalDialogue = HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE.map(
      (profile) => `${profile.story} ${profile.location}`
    );
    assert.ok(
      optionalDialogue.filter((text) =>
        /\b(?:Exotic Matter|antimatter|Biome|portal|anchor|core|Collective)\b/i.test(
          text
        )
      ).length >= 40
    );
    assert.ok(
      optionalDialogue.filter((text) => /\bCompact\b/i.test(text)).length >= 20
    );
    assert.ok(
      optionalDialogue.filter((text) =>
        /\b(?:Mudden|Noble Rise|Watch|Chapel Circle|River Knots|Kin|tax riot|refugees?|debt|scarcity|shortages?)\b/i.test(
          text
        )
      ).length >= 35
    );
  });

  it("keeps every spoken line player-readable instead of developer-readable", () => {
    for (const profile of HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE) {
      for (const spokenText of [
        profile.intro,
        profile.story,
        profile.location,
      ]) {
        assert.doesNotMatch(spokenText, DEVELOPER_JARGON, profile.displayName);
      }
    }
  });

  it("does not leak the autostart Jobs Board objective into town greetings", () => {
    for (const profile of HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE) {
      const lines = buildHarthmereDialogueLines({
        offset: profile.offset,
        defaultDialog:
          "<text>An obsolete multi-page greeting.</text>{break}<text>Read the Market Board.</text>",
        isBoard: false,
        activeObjectiveLines: [
          "Active: Read the Jobs Board — Read the Jobs Board.",
        ],
        activeObjective: "Active: Read the Jobs Board — Read the Jobs Board.",
        availableQuestTitles: [],
        completedQuestTitles: [],
        reputationState: REPUTATION_STATE,
      });
      assert.deepEqual(lines, [profile.intro]);
      assert.doesNotMatch(lines.join(" "), BOARD_REFERENCE);
    }
  });

  it("offers background and location choices without redirecting idle NPCs to a board", () => {
    for (const profile of HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE) {
      const actions = dialogueActionsForHarthmereNpc(profile.offset, {
        activeObjective: "Active: Read the Jobs Board — Read the Jobs Board.",
        availableQuestTitles: [],
        completedQuestTitles: [],
      });
      assert.equal(
        actions.find((action) => action.name === "Tell me about yourself.")
          ?.followUpText,
        profile.story
      );
      assert.equal(
        actions.find(
          (action) => action.name === "What should I know about this place?"
        )?.followUpText,
        profile.location
      );
      for (const action of actions) {
        if (action.followUpText) {
          assert.doesNotMatch(
            action.followUpText,
            BOARD_REFERENCE,
            `${profile.displayName}: ${action.name}`
          );
        }
      }
    }
  });

  it("casts every actor with the authored sex and living kind", () => {
    for (const profile of HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE) {
      const voice = harthmereAdditiveTownNpcVoiceProfile(profile);
      assert.equal(voice.inferredGender, profile.sex, profile.displayName);
      assert.equal(voice.actorKind, profile.kind, profile.displayName);
    }
  });

  it("registers every spoken line for committed prerecorded audio", () => {
    const additiveEntries = HARTHMERE_NPC_VOICE_CATALOG.filter((entry) =>
      entry.id.startsWith("additive-town-")
    );
    assert.equal(additiveEntries.length, 68);

    for (const profile of HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE) {
      const entry = additiveEntries.find(
        (candidate) => candidate.id === `additive-town-${profile.offset}`
      );
      assert.ok(entry, profile.displayName);
      assert.equal(
        entry.entityId,
        harthmereAdditiveTownNpcEntityId(profile.offset)
      );
      assert.deepEqual(
        entry.staticLines.map((line) => line.text),
        [profile.intro, profile.story, profile.location]
      );
      assert.equal(entry.profile.inferredGender, profile.sex);
      assert.equal(entry.profile.actorKind, profile.kind);
    }
  });
});
