import type { NpcSpeechButtonStateV1 } from "@/client/components/system/npcSpeechInputState";

export function talkDialogHasChoiceActionsForTestV1(
  actions: readonly unknown[] | undefined
) {
  return (actions?.length ?? 0) > 0;
}

export function talkDialogVoiceInputBlocksAdvanceForTestV1(input: {
  voiceInputState?: NpcSpeechButtonStateV1;
}) {
  return (
    input.voiceInputState === "recording" ||
    input.voiceInputState === "transcribing"
  );
}

export function talkDialogAdvanceDecisionForTestV1(input: {
  typingComplete: boolean;
  hasChoiceActions: boolean;
  voiceInputState?: NpcSpeechButtonStateV1;
}) {
  if (input.voiceInputState === "recording") {
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

export function talkDialogShouldShowVoiceInputForTestV1(input: {
  hasVoiceInput: boolean;
  microphoneInputEnabled: boolean;
  actionCount: number;
}) {
  return (
    input.hasVoiceInput && input.microphoneInputEnabled && input.actionCount > 0
  );
}
