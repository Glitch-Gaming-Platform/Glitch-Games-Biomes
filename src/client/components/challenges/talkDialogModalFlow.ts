import type { NpcSpeechButtonState } from "@/client/components/system/npcSpeechInputState";

export function talkDialogHasChoiceActionsForTest(
  actions: readonly unknown[] | undefined
) {
  return (actions?.length ?? 0) > 0;
}

export function talkDialogVoiceInputBlocksAdvanceForTest(input: {
  voiceInputState?: NpcSpeechButtonState;
}) {
  // Starting is treated like recording so a click cannot advance the dialog
  // while the browser's microphone permission prompt is unresolved.
  return (
    input.voiceInputState === "starting" ||
    input.voiceInputState === "recording" ||
    input.voiceInputState === "transcribing"
  );
}

export function talkDialogAdvanceDecisionForTest(input: {
  typingComplete: boolean;
  hasChoiceActions: boolean;
  voiceInputState?: NpcSpeechButtonState;
}) {
  if (
    input.voiceInputState === "starting" ||
    input.voiceInputState === "recording"
  ) {
    return "stop_recording" as const;
  }
  if (input.voiceInputState === "transcribing") {
    return "ignore" as const;
  }
  if (!input.typingComplete) {
    return "finish_typing" as const;
  }
  return input.hasChoiceActions ? ("ignore" as const) : ("go_next" as const);
}

export function talkDialogShouldShowVoiceInputForTest(input: {
  hasVoiceInput: boolean;
  microphoneInputEnabled: boolean;
  actionCount: number;
}) {
  return (
    input.hasVoiceInput && input.microphoneInputEnabled && input.actionCount > 0
  );
}

export function talkDialogShouldShowActionsForTest(input: {
  typingComplete: boolean;
  revealActionsImmediately: boolean;
  hasContent: boolean;
}) {
  return (
    input.hasContent && (input.typingComplete || input.revealActionsImmediately)
  );
}
