/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import {
  generatedChatConversationMessagesFromContextForTestV1,
  generatedChatConversationGuardrailPromptV1,
  generatedChatLikeabilityForOptionV1,
  generatedChatNormalizeModelOutputForTestV1,
  generatedChatPlayerNameForPromptV1,
  generatedChatSanitizeContextForPromptV1,
  generatedChatSerializeMessageContextForTestV1,
  generatedChatSpeechPerformanceBriefForTestV1,
} from "@/pages/api/npcs/generated_chat";
import { harthmereFallbackNpcOptionsV143 } from "@/shared/harthmere/npc_dialog_fallback_v143";

describe("generated NPC chat likeability classification", () => {
  it("marks friendly, neutral, and rude generated options with HUD-ready deltas", () => {
    assert.equal(
      generatedChatLikeabilityForOptionV1("Compliment Ruthe's steady eye"),
      6
    );
    assert.equal(
      generatedChatLikeabilityForOptionV1("Ask about this place"),
      0
    );
    assert.equal(generatedChatLikeabilityForOptionV1("Call Ruthe useless"), -8);
    assert.equal(generatedChatLikeabilityForOptionV1("Close"), 0);
  });

  it("keeps authored fallback ask options neutral", () => {
    const ask = harthmereFallbackNpcOptionsV143({
      name: "Ruthe",
      description: "Harthmere lookout",
    }).find((option) => option.name === "Ask about this place");

    assert.equal(ask?.likeability, 0);
  });

  it("keeps ugly account ids out of spoken NPC prompt names", () => {
    assert.equal(
      generatedChatPlayerNameForPromptV1("Glitch2a0103314f7be0"),
      "traveler"
    );
    assert.equal(
      generatedChatPlayerNameForPromptV1(
        "2a010331-4f54-460f-bdaf-d9afe0587be0"
      ),
      "traveler"
    );
    assert.equal(generatedChatPlayerNameForPromptV1("Devin"), "Devin");
  });

  it("guards voice conversations against repeated opening monologues", () => {
    const prompt = generatedChatConversationGuardrailPromptV1({
      hasUserResponse: true,
      hasMessageContext: true,
    });
    assert.match(prompt, /ongoing conversation/i);
    assert.match(prompt, /do not restart/i);
    assert.match(prompt, /Do not repeat/i);
    assert.match(prompt, /Do not recite metadata/i);
  });

  it("adds NPC-specific speech performance guidance to generated chat prompts", () => {
    assert.match(
      generatedChatSpeechPerformanceBriefForTestV1({
        npcName: "Jackie",
        voiceId:
          "azure-speech-v1|voice=en-US-LunaNeural|style=conversation|rate=-3%25|pitch=%2B1%25|actor=snapshot_grove_v75%3Ajackie%3A8810000000019301%3Ajackie",
      }),
      /Tone: warm_practical.*road markers/
    );
    assert.match(
      generatedChatSpeechPerformanceBriefForTestV1({
        npcName: "Doc",
        entityDescription: "Field medic and muck researcher.",
        voiceId:
          "azure-speech-v1|voice=en-US-DavisNeural|style=chat|rate=-2%25|pitch=%2B0%25|actor=snapshot_grove_v75%3Adoc%3A8810000000019309%3Adoc",
      }),
      /Tone: clinical_blunt.*samples/
    );
  });

  it("keeps raw account ids out of current player context", () => {
    const sanitized = generatedChatSanitizeContextForPromptV1(
      [
        "Current player context:",
        "- Player: Glitch2a0103314f7be0.",
        "- Tracker: 2a010331-4f54-460f-bdaf-d9afe0587be0.",
        "- Token: 2a0103314f54bdafd9afe0587be0.",
      ].join("\n")
    );

    assert.ok(sanitized);
    assert.doesNotMatch(sanitized, /Glitch2a0103314f7be0/);
    assert.doesNotMatch(sanitized, /2a010331-4f54-460f-bdaf-d9afe0587be0/);
    assert.doesNotMatch(sanitized, /2a0103314f54bdafd9afe0587be0/);
    assert.match(sanitized, /traveler/);
  });

  it("uses natural model dialog even when the model forgets button tags", () => {
    const parsed = generatedChatNormalizeModelOutputForTestV1({
      content:
        "I hear you. The east fence is still our worry, so keep your eyes on the broken posts.",
      questContext: "Quest: Repair the Safe-Zone Fence",
    });

    assert.equal(
      parsed?.dialog,
      "I hear you. The east fence is still our worry, so keep your eyes on the broken posts."
    );
    assert.deepEqual(parsed?.buttons, [
      "Ask about the quest",
      "Ask what to do next",
      "Say goodbye",
    ]);
  });

  it("keeps model-provided buttons and strips speech markup from dialog text", () => {
    const parsed = generatedChatNormalizeModelOutputForTestV1({
      content: [
        "<text>Meet me by the fence after sundown.</text>",
        "<button>Ask why sundown matters</button>",
        "<button>Offer help</button>",
      ].join("\n"),
    });

    assert.deepEqual(parsed, {
      dialog: "Meet me by the fence after sundown.",
      buttons: ["Ask why sundown matters", "Offer help"],
    });
  });

  it("uses non-quest fallback buttons when generated chat has no active quest context", () => {
    const parsed = generatedChatNormalizeModelOutputForTestV1({
      content: "I heard you, but I need a clearer question.",
    });

    assert.deepEqual(parsed?.buttons, [
      "Ask what they mean",
      "Ask what to do next",
      "Say goodbye",
    ]);
  });

  it("rejects empty generated chat output instead of speaking a blank line", () => {
    assert.equal(
      generatedChatNormalizeModelOutputForTestV1({
        content: "   <text>   </text>   ",
      }),
      undefined
    );
  });

  it("stores only same-NPC user and assistant conversation turns", () => {
    const context = generatedChatSerializeMessageContextForTestV1({
      entityId: 123 as any,
      messages: [
        { role: "system", content: "Old NPC identity" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "well met" },
      ],
    });

    assert.deepEqual(
      generatedChatConversationMessagesFromContextForTestV1(
        context,
        123 as any
      ),
      [
        { role: "user", content: "hello" },
        { role: "assistant", content: "well met" },
      ]
    );
    assert.deepEqual(
      generatedChatConversationMessagesFromContextForTestV1(
        context,
        999 as any
      ),
      []
    );
  });

  it("accepts legacy array contexts while dropping stale system prompts", () => {
    const legacyContext = JSON.stringify([
      { role: "system", content: "Old identity that must not persist" },
      { role: "user", content: "first" },
      { role: "assistant", content: "second" },
    ]);

    assert.deepEqual(
      generatedChatConversationMessagesFromContextForTestV1(
        legacyContext,
        777 as any
      ),
      [
        { role: "user", content: "first" },
        { role: "assistant", content: "second" },
      ]
    );
  });

  it("limits saved voice conversation history to the latest eight turns", () => {
    const context = generatedChatSerializeMessageContextForTestV1({
      entityId: 123 as any,
      messages: Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
        content: `turn-${index}`,
      })),
    });

    assert.deepEqual(
      generatedChatConversationMessagesFromContextForTestV1(
        context,
        123 as any
      ).map((message) => message.content),
      [
        "turn-4",
        "turn-5",
        "turn-6",
        "turn-7",
        "turn-8",
        "turn-9",
        "turn-10",
        "turn-11",
      ]
    );
  });
});
