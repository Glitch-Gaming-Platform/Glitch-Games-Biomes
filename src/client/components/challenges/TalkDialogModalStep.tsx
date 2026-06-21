import { NpcDialogView } from "@/client/components/challenges/QuestViews";
import {
  maybeTranslateDialogText,
  npcTypeForNpcId,
} from "@/client/components/challenges/helpers";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { useSelectedLanguage } from "@/client/components/inventory/LanguageSelector";
import type { DialogButtonType } from "@/client/components/system/DialogButton";
import { DialogButton } from "@/client/components/system/DialogButton";
import {
  NpcSpeechInputButton,
  NPC_SPEECH_STOP_RECORDING_EVENT,
} from "@/client/components/system/NpcSpeechInputButton";
import type { NpcSpeechButtonState } from "@/client/components/system/npcSpeechInputState";
import { Tooltipped } from "@/client/components/system/Tooltipped";
import { VoiceChat } from "@/client/components/system/VoiceChat";
import { selectHarthmereCombatTarget } from "@/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem";
import {
  talkDialogAdvanceDecisionForTest,
  talkDialogHasChoiceActionsForTest,
  talkDialogShouldShowVoiceInputForTest,
} from "@/client/components/challenges/talkDialogModalFlow";
import { HARTHMERE_VENDOR_TRADE_CLOSE_TALK_EVENT } from "@/client/components/challenges/harthmereEvents";
import { cleanListener } from "@/client/util/helpers";
import { useEffectAsync } from "@/client/util/hooks";
import { useTypedStorageItem } from "@/client/util/typed_local_storage";

import type { Voice } from "@/shared/ecs/gen/components";
import {
  harthmereAzureVoiceIdOrFallback,
  harthmereVoiceProfileForActor,
} from "@/shared/harthmere/npc_voice_profiles";
import type { BiomesId } from "@/shared/ids";
import { relevantBiscuitForEntityId } from "@/shared/npc/bikkie";
import { AnimatePresence, motion } from "framer-motion";
import type { PropsWithChildren, ReactNode } from "react";
import React, { useCallback, useEffect, useState } from "react";

export interface TalkDialogInfo {
  text: string;
  children?: React.ReactNode;
  actions?: TalkDialogStepAction[];
}

export interface TalkDialogStep {
  id: string | BiomesId | number;
  entityId: BiomesId;
  dialog: TalkDialogInfo[];
}

export interface TalkDialogStepAction {
  name: string;
  type?: DialogButtonType;
  tooltip?: string;
  disabled?: boolean;
  onPerformed: () => void;
  icon?: { view?: ReactNode; src?: string; text?: string };
  followUpText?: string;
  closeAfterPerformed?: boolean;
}

export interface TalkDialogVoiceInput {
  disabled?: boolean;
  maxRecordingMs?: number;
  onTranscript: (text: string) => unknown;
}

export type ButtonLayout = "horizontal-rectangle" | "vertical";

export function resolveTalkDialogAzureVoiceForTest(input: {
  voiceComponent?: Voice;
  fallbackVoice: Voice;
}) {
  const voice = harthmereAzureVoiceIdOrFallback({
    voiceId: input.voiceComponent?.voice,
    fallbackVoiceId: input.fallbackVoice.voice,
  });
  return voice === input.voiceComponent?.voice
    ? input.voiceComponent
    : input.fallbackVoice;
}

export const ClickToContinue: React.FunctionComponent<{
  className?: string;
  customText?: string;
}> = ({ className, customText }) => {
  return (
    <motion.div
      className={`select-none font-semibold ${className} text-med text-shadow-bordered`}
      initial={{ x: "0%" }}
      animate={{ x: "0%", scale: [1, 0.9, 1] }}
      transition={{ repeat: Infinity, repeatDelay: 1 }}
    >
      {customText ?? "Click to continue"}
    </motion.div>
  );
};

export const TalkDialogModalStep: React.FunctionComponent<
  PropsWithChildren<{
    id: string | BiomesId | number;
    entityId: BiomesId;
    dialog: TalkDialogInfo[];
    onClose?: () => void;
    buttonLayout?: ButtonLayout;
    voiceInput?: TalkDialogVoiceInput;
  }>
> = ({
  id,
  entityId,
  dialog,
  buttonLayout = "horizontal-rectangle",
  onClose,
  voiceInput,
  children,
}) => {
  const { reactResources, resources } = useClientContext();

  const [label, npcMetadata] = reactResources.useAll(
    ["/ecs/c/label", entityId],
    ["/ecs/c/npc_metadata", entityId]
  );

  const npcType = npcTypeForNpcId(reactResources, npcMetadata?.type_id);
  const relevantBiscuit = relevantBiscuitForEntityId(resources, entityId);

  return (
    <GenericTalkDialogModalStep
      entityId={entityId}
      title={
        label?.text ??
        npcType?.displayName ??
        relevantBiscuit?.displayName ??
        "Entity"
      }
      dialog={dialog}
      buttonLayout={buttonLayout}
      id={id}
      onClose={onClose}
      voiceInput={voiceInput}
    >
      {children}
    </GenericTalkDialogModalStep>
  );
};

export const GenericTalkDialogModalStep: React.FunctionComponent<
  PropsWithChildren<{
    entityId: BiomesId;
    title: string;
    dialog: TalkDialogInfo[];
    buttonLayout?: ButtonLayout;
    onClose?: () => any;
    id: string | BiomesId | number;
    voiceInput?: TalkDialogVoiceInput;
  }>
> = ({
  entityId,
  title,
  dialog,
  onClose,
  buttonLayout = "horizontal-rectangle",
  id,
  voiceInput,
  children,
}) => {
  const { reactResources } = useClientContext();
  const [beginTyping, setBeginTyping] = useState(false);
  const [typingComplete, setTypingComplete] = useState(false);
  const [dialogIndex, setDialogIndex] = useState(0);
  const [shouldFinishTyping, setShouldFinishTyping] = useState(false);
  const [actionFollowUp, setActionFollowUp] = useState<TalkDialogInfo>();
  const [voiceInputState, setVoiceInputState] =
    useState<NpcSpeechButtonState>("idle");
  const [microphoneInputEnabled] = useTypedStorageItem(
    "settings.voice.microphoneInputEnabled",
    true
  );

  const [voiceComponent, entityDescription] = reactResources.useAll(
    ["/ecs/c/voice", entityId],
    ["/ecs/c/entity_description", entityId]
  );
  const fallbackVoice: Voice = {
    voice: harthmereVoiceProfileForActor({
      source: "runtime_entity",
      entityId,
      displayName: title,
      background: entityDescription?.text,
    }).voiceParameterId,
  };
  const voice = resolveTalkDialogAzureVoiceForTest({
    voiceComponent,
    fallbackVoice,
  });

  const currentDialog =
    actionFollowUp ?? (dialog[dialogIndex] as TalkDialogInfo | undefined);

  useEffect(() => {
    const localDevNpcOffset = Number(entityId) - 8_810_000_000_010_000;
    if (localDevNpcOffset >= 1 && localDevNpcOffset <= 999) {
      selectHarthmereCombatTarget(localDevNpcOffset, title, "NPC Targeted");
    }
  }, [entityId, title]);

  const hasChoiceActions = talkDialogHasChoiceActionsForTest(
    currentDialog?.actions
  );

  const finishTyping = () => {
    if (!typingComplete) {
      setShouldFinishTyping(true);
    }
  };

  const goNext = useCallback(() => {
    if (actionFollowUp) {
      setActionFollowUp(undefined);
      onClose?.();
      return;
    }
    const isLastStep = dialogIndex >= dialog.length - 1;
    if (isLastStep) {
      onClose?.();
    } else {
      setTypingComplete(false);
      setDialogIndex((idx) => idx + 1);
    }
  }, [actionFollowUp, dialogIndex, dialog, setDialogIndex, typingComplete]);

  useEffect(() => {
    setBeginTyping(true);
    setTypingComplete(false);
    setShouldFinishTyping(false);
  }, [setTypingComplete, setBeginTyping, dialogIndex, actionFollowUp]);

  // HARTHMERE_DIALOG_NO_DOUBLE_TEXT:
  // Reset dialog position ONLY when this is truly a new conversation (a new
  // NPC entity). Previously this depended on `id`, which changed every time
  // the parent re-memoized after an action click (state update → new id →
  // dialogIndex reset to 0 → intro text replayed before the followUpText).
  // That produced the "double text" bug where selecting an option re-printed
  // the NPC intro and then the option result. Depending on entityId keeps the
  // mid-conversation position (e.g. an actionFollowUp screen) stable while
  // letting the dialog content itself refresh from new props.
  useEffect(() => {
    setDialogIndex(0);
    setActionFollowUp(undefined);
  }, [entityId]);

  // If the dialog array shrinks beneath the current position (e.g. the
  // parent recomputed with fewer chunks), clamp dialogIndex so it does not
  // point past the end of the new array and blank the modal.
  useEffect(() => {
    if (dialog.length > 0 && dialogIndex > dialog.length - 1) {
      setDialogIndex(dialog.length - 1);
    }
  }, [dialog.length, dialogIndex]);

  useEffect(() => {
    const closeForVendor = () => {
      onClose?.();
    };
    window.addEventListener(
      HARTHMERE_VENDOR_TRADE_CLOSE_TALK_EVENT,
      closeForVendor
    );
    return () => {
      window.removeEventListener(
        HARTHMERE_VENDOR_TRADE_CLOSE_TALK_EVENT,
        closeForVendor
      );
    };
  }, [onClose]);

  useEffect(() => {
    const advance = () => {
      const decision = talkDialogAdvanceDecisionForTest({
        typingComplete,
        hasChoiceActions,
        voiceInputState,
      });
      if (decision === "finish_typing") {
        finishTyping();
      } else if (decision === "stop_recording") {
        window.dispatchEvent(new Event(NPC_SPEECH_STOP_RECORDING_EVENT));
      } else if (decision === "go_next") {
        goNext();
      } else if (voiceInput && hasChoiceActions) {
        window.dispatchEvent(new Event(NPC_SPEECH_STOP_RECORDING_EVENT));
      }
    };
    return cleanListener(window, {
      keyup: (e: KeyboardEvent) => {
        if (e.code === "Space" || e.code === "KeyF") {
          advance();
        }
      },
      mouseup: () => {
        advance();
      },
    });
  }, [
    hasChoiceActions,
    typingComplete,
    dialogIndex,
    dialog,
    voiceInputState,
    voiceInput,
  ]);

  const chatVoices = reactResources.get("/tweaks").chatVoices;

  const [language] = useSelectedLanguage();
  const chatTranslation = reactResources.get("/tweaks").chatTranslation;
  const [translatedText, setTranslatedText] = useState<string | undefined>();
  const [translatedSpokenText, setTranslatedSpokenText] = useState<
    string | undefined
  >();
  useEffectAsync(async () => {
    setTranslatedText(undefined);
    setTranslatedSpokenText(undefined);
    if (!currentDialog?.text) {
      return;
    }
    const { shownText, spokenText } = await maybeTranslateDialogText(
      reactResources,
      currentDialog.text,
      language
    );
    setTranslatedText(shownText);
    setTranslatedSpokenText(spokenText);
  }, [currentDialog?.text, language]);

  if (!currentDialog) {
    return <>{children}</>;
  }

  const actions: TalkDialogStepAction[] = currentDialog.actions ?? [];
  const showVoiceInput = talkDialogShouldShowVoiceInputForTest({
    hasVoiceInput: Boolean(voiceInput),
    microphoneInputEnabled,
    actionCount: actions.length,
  });

  const showNpcAcceptContainer =
    typingComplete && (currentDialog.children || actions.length > 0);
  return (
    <>
      {!!translatedSpokenText?.length && chatVoices && (
        <VoiceChat
          text={translatedSpokenText}
          voice={voice.voice}
          language={chatTranslation ? language : undefined}
          playbackKey={`${entityId}:${id}:${dialogIndex}:${
            actionFollowUp?.text ? "followup" : "dialog"
          }`}
        />
      )}
      <AnimatePresence>
        <motion.div
          key={`${id}-${dialogIndex}-${actionFollowUp?.text ?? ""}`}
          className="npc-quest-dialog-container"
          layout
        >
          <motion.div layout className="npc-quest-dialog select-none">
            <div className="npc-name">{title}</div>
            {translatedText && (
              <NpcDialogView
                text={translatedText}
                onTypeComplete={() => {
                  setTypingComplete(true);
                }}
                beginTyping={beginTyping}
                shouldFinishTyping={shouldFinishTyping}
              />
            )}
          </motion.div>
          {showNpcAcceptContainer && (
            <motion.div
              className="npc-accept-container"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              layout
              transition={{ duration: 0.5 }}
            >
              {currentDialog.children}
              {showVoiceInput && voiceInput && (
                <div
                  onClick={(event) => event.stopPropagation()}
                  onKeyUp={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onMouseUp={(event) => event.stopPropagation()}
                >
                  <NpcSpeechInputButton
                    disabled={voiceInput.disabled}
                    language={chatTranslation ? language : undefined}
                    maxRecordingMs={voiceInput.maxRecordingMs}
                    onStateChange={setVoiceInputState}
                    onTranscript={voiceInput.onTranscript}
                  />
                </div>
              )}
              {currentDialog.actions?.length && (
                <div
                  className={`flex ${
                    buttonLayout === "vertical" ? "flex-col" : ""
                  } gap-1`}
                >
                  {actions.map((e, i) => {
                    return (
                      <Tooltipped
                        wrapperExtraClass="w-full max-w-[60%] mx-auto"
                        key={i}
                        tooltip={e.tooltip}
                      >
                        <DialogButton
                          size="xl"
                          disabled={e.disabled}
                          type={e.type ?? undefined}
                          glow={e.type === "primary"}
                          extraClassNames={`items-center flex flex-row
                            ${!e.tooltip ? "w-full max-w-[60%] mx-auto" : ""}
                          `}
                          onClick={() => {
                            e.onPerformed();
                            if (e.closeAfterPerformed) {
                              onClose?.();
                              return;
                            }
                            if (e.followUpText) {
                              setActionFollowUp({ text: e.followUpText });
                            } else {
                              goNext();
                            }
                          }}
                        >
                          {e.icon?.view && <>{e.icon.view}</>}
                          <div className="flex-1">{e.name}</div>
                        </DialogButton>
                      </Tooltipped>
                    );
                  })}
                </div>
              )}
              {children}
            </motion.div>
          )}
        </motion.div>
        {typingComplete && !hasChoiceActions && (
          <ClickToContinue
            customText={
              dialogIndex === dialog.length - 1
                ? "Click to close"
                : "Click to continue"
            }
            className="fixed bottom-2"
          />
        )}
      </AnimatePresence>
    </>
  );
};
