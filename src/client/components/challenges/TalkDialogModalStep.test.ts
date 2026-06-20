import {
  talkDialogAdvanceDecisionForTest,
  talkDialogHasChoiceActionsForTest,
  talkDialogShouldShowVoiceInputForTest,
  talkDialogVoiceInputBlocksAdvanceForTest,
} from "@/client/components/challenges/talkDialogModalFlow";
import assert from "assert";

describe("TalkDialogModalStep conversation flow guards", () => {
  it("does not count the optional mic button as a blocking dialogue choice", () => {
    assert.equal(talkDialogHasChoiceActionsForTest(undefined), false);
    assert.equal(talkDialogHasChoiceActionsForTest([]), false);
    assert.equal(talkDialogHasChoiceActionsForTest([{}]), true);
  });

  it("allows click/key advance when the mic is idle and no choices are visible", () => {
    assert.equal(
      talkDialogAdvanceDecisionForTest({
        typingComplete: false,
        hasChoiceActions: false,
        voiceInputState: "idle",
      }),
      "finish_typing"
    );
    assert.equal(
      talkDialogAdvanceDecisionForTest({
        typingComplete: true,
        hasChoiceActions: false,
        voiceInputState: "idle",
      }),
      "go_next"
    );
  });

  it("keeps real dialogue choices from being bypassed by page clicks", () => {
    assert.equal(
      talkDialogAdvanceDecisionForTest({
        typingComplete: true,
        hasChoiceActions: true,
        voiceInputState: "idle",
      }),
      "ignore"
    );
  });

  it("stops recording on page click without advancing and blocks while transcribing", () => {
    assert.equal(
      talkDialogVoiceInputBlocksAdvanceForTest({
        voiceInputState: "recording",
      }),
      true
    );
    assert.equal(
      talkDialogVoiceInputBlocksAdvanceForTest({
        voiceInputState: "transcribing",
      }),
      true
    );
    assert.equal(
      talkDialogVoiceInputBlocksAdvanceForTest({ voiceInputState: "idle" }),
      false
    );
    assert.equal(
      talkDialogAdvanceDecisionForTest({
        typingComplete: true,
        hasChoiceActions: false,
        voiceInputState: "recording",
      }),
      "stop_recording"
    );
    assert.equal(
      talkDialogAdvanceDecisionForTest({
        typingComplete: true,
        hasChoiceActions: false,
        voiceInputState: "transcribing",
      }),
      "ignore"
    );
  });

  it("covers every click-advance state used by voice conversations", () => {
    const cases = [
      {
        typingComplete: false,
        hasChoiceActions: false,
        voiceInputState: "idle",
        expected: "finish_typing",
      },
      {
        typingComplete: false,
        hasChoiceActions: true,
        voiceInputState: "idle",
        expected: "finish_typing",
      },
      {
        typingComplete: true,
        hasChoiceActions: false,
        voiceInputState: "idle",
        expected: "go_next",
      },
      {
        typingComplete: true,
        hasChoiceActions: true,
        voiceInputState: "idle",
        expected: "ignore",
      },
      {
        typingComplete: false,
        hasChoiceActions: false,
        voiceInputState: "recording",
        expected: "stop_recording",
      },
      {
        typingComplete: true,
        hasChoiceActions: true,
        voiceInputState: "recording",
        expected: "stop_recording",
      },
      {
        typingComplete: false,
        hasChoiceActions: false,
        voiceInputState: "transcribing",
        expected: "ignore",
      },
      {
        typingComplete: true,
        hasChoiceActions: true,
        voiceInputState: "transcribing",
        expected: "ignore",
      },
    ] as const;

    for (const testCase of cases) {
      assert.equal(
        talkDialogAdvanceDecisionForTest(testCase),
        testCase.expected
      );
    }
  });

  it("shows the mic only when voice input is present, enabled, and choices are visible", () => {
    assert.equal(
      talkDialogShouldShowVoiceInputForTest({
        hasVoiceInput: true,
        microphoneInputEnabled: true,
        actionCount: 1,
      }),
      true
    );
    assert.equal(
      talkDialogShouldShowVoiceInputForTest({
        hasVoiceInput: false,
        microphoneInputEnabled: true,
        actionCount: 1,
      }),
      false
    );
    assert.equal(
      talkDialogShouldShowVoiceInputForTest({
        hasVoiceInput: true,
        microphoneInputEnabled: false,
        actionCount: 1,
      }),
      false
    );
    assert.equal(
      talkDialogShouldShowVoiceInputForTest({
        hasVoiceInput: true,
        microphoneInputEnabled: true,
        actionCount: 0,
      }),
      false
    );
  });
});
