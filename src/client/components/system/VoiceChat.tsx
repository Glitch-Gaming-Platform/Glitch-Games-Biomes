import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { useTypedStorageItem } from "@/client/util/typed_local_storage";
import type {
  ChatVoiceRequest,
  ChatVoiceResponse,
} from "@/pages/api/voices/text_to_speech";
import { log } from "@/shared/logging";
import { jsonPost } from "@/shared/util/fetch_helpers";
import type { NpcVoiceProvider } from "@/shared/voices/types";
import React from "react";

const RECENTLY_PLAYED_VOICE_LINES = new Map<string, number>();
export const RECENT_VOICE_LINE_TTL_MS_FOR_TEST = 5 * 60_000;

function shouldSuppressRecentVoiceLine(key: string, now = Date.now()) {
  for (const [playedKey, playedAt] of RECENTLY_PLAYED_VOICE_LINES) {
    if (now - playedAt > RECENT_VOICE_LINE_TTL_MS_FOR_TEST) {
      RECENTLY_PLAYED_VOICE_LINES.delete(playedKey);
    }
  }
  const lastPlayedAt = RECENTLY_PLAYED_VOICE_LINES.get(key);
  if (
    lastPlayedAt !== undefined &&
    now - lastPlayedAt <= RECENT_VOICE_LINE_TTL_MS_FOR_TEST
  ) {
    return true;
  }
  RECENTLY_PLAYED_VOICE_LINES.set(key, now);
  return false;
}

export function voiceLineSuppressionKeyForTest(input: {
  text: string;
  voice: string;
  language?: string;
  provider?: NpcVoiceProvider;
}) {
  return `${input.provider ?? "elevenlabs"}|${input.voice}|${
    input.language ?? ""
  }|${input.text.trim().replace(/\s+/g, " ")}`;
}

export function shouldPlayVoiceLineForTest(key: string, now = Date.now()) {
  return !shouldSuppressRecentVoiceLine(key, now);
}

export function clearRecentVoiceLinesForTest() {
  RECENTLY_PLAYED_VOICE_LINES.clear();
}

export function clearVoiceChatAudioElementForTest(
  audio: HTMLAudioElement | null | undefined
) {
  if (!audio) {
    return;
  }
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

export function shouldRequestVoiceChatAudioForTest(input: {
  npcSpeechEnabled: boolean;
  text?: string;
  voice?: string;
}) {
  return Boolean(
    input.npcSpeechEnabled && input.text?.length && input.voice?.length
  );
}

export function shouldApplyVoiceChatAudioResultForTest(input: {
  cancelled: boolean;
  requestText: string;
  latestText?: string;
  requestKey: string;
  latestRequestKey: string;
  audioStillMounted: boolean;
  responseUrl?: string;
  currentAudioSrc?: string;
}) {
  return Boolean(
    !input.cancelled &&
      input.responseUrl &&
      input.latestText === input.requestText &&
      input.latestRequestKey === input.requestKey &&
      input.audioStillMounted &&
      input.currentAudioSrc !== input.responseUrl
  );
}

export const VoiceChat: React.FunctionComponent<{
  text?: string;
  voice?: string;
  language?: string;
  playbackKey?: string;
}> = ({ text, voice, language, playbackKey }) => {
  const { audioManager } = useClientContext();
  const [npcSpeechEnabled] = useTypedStorageItem(
    "settings.voice.npcSpeechEnabled",
    true
  );
  const [npcSpeechProvider] = useTypedStorageItem(
    "settings.voice.npcSpeechProvider",
    "elevenlabs"
  );
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const latestText = React.useRef(text);
  const latestRequestKey = React.useRef("");

  latestText.current = text;

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    clearVoiceChatAudioElementForTest(audio);

    if (
      !shouldRequestVoiceChatAudioForTest({
        npcSpeechEnabled,
        text,
        voice,
      })
    ) {
      latestRequestKey.current = "";
      return;
    }
    const requestText = text ?? "";
    const requestVoice = voice ?? "";
    const lineKey = voiceLineSuppressionKeyForTest({
      text: requestText,
      voice: requestVoice,
      language,
      // Provider is part of the key so changing providers can immediately
      // replay the current line in the newly selected voice stack.
      provider: npcSpeechProvider,
    });
    const requestKey = `${playbackKey ?? ""}|${lineKey}`;
    latestRequestKey.current = requestKey;
    if (shouldSuppressRecentVoiceLine(lineKey)) {
      latestRequestKey.current = "";
      return;
    }

    void (async () => {
      try {
        const res = await jsonPost<ChatVoiceResponse, ChatVoiceRequest>(
          "/api/voices/text_to_speech",
          {
            text: requestText,
            voice: requestVoice,
            language,
            provider: npcSpeechProvider,
          },
          { signal: controller.signal }
        );
        if (!res.url) {
          return;
        }
        if (
          shouldApplyVoiceChatAudioResultForTest({
            cancelled,
            requestText,
            latestText: latestText.current,
            requestKey,
            latestRequestKey: latestRequestKey.current,
            audioStillMounted: audioRef.current === audio,
            responseUrl: res.url,
            currentAudioSrc: audio.src,
          })
        ) {
          audio.src = res.url!;
          audio.volume = audioManager.getVolume("settings.volume.voice");
          await audio.play();
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        // The local/dev starter world can run without authenticated voice
        // services. Dialogue text should remain usable even when text-to-speech
        // is unavailable, so do not let this API failure crash the whole React
        // tree.
        log.warn("Voice chat audio unavailable; continuing with text only", {
          error,
        });
        clearVoiceChatAudioElementForTest(audio);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (latestRequestKey.current === requestKey) {
        latestRequestKey.current = "";
      }
      clearVoiceChatAudioElementForTest(audio);
    };
  }, [text, voice, language, playbackKey, npcSpeechEnabled, npcSpeechProvider]);

  return (
    <audio
      ref={audioRef}
      preload="auto"
      onEnded={() => clearVoiceChatAudioElementForTest(audioRef.current)}
    />
  );
};
