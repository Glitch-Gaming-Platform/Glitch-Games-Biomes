import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { useEffectAsync } from "@/client/util/hooks";
import type {
  ChatVoiceRequest,
  ChatVoiceResponse,
} from "@/pages/api/voices/text_to_speech";
import { log } from "@/shared/logging";
import { jsonPost } from "@/shared/util/fetch_helpers";
import React from "react";

export const VoiceChat: React.FunctionComponent<{
  text?: string;
  voice?: string;
  language?: string;
}> = ({ text, voice, language }) => {
  const { audioManager } = useClientContext();
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const latestText = React.useRef(text);

  latestText.current = text;

  useEffectAsync(async () => {
    if (!audioRef.current) {
      return;
    }
    audioRef.current.pause();
    audioRef.current.src = "";

    if (!text?.length || !voice?.length) {
      return;
    }

    try {
      const res = await jsonPost<ChatVoiceResponse, ChatVoiceRequest>(
        "/api/voices/text_to_speech",
        {
          text,
          voice,
          language,
        }
      );
      if (
        latestText.current === text &&
        audioRef.current &&
        audioRef.current.src !== res.url
      ) {
        audioRef.current.src = res.url;
        audioRef.current.volume = audioManager.getVolume("settings.volume.voice");
      }
    } catch (error) {
      // The local/dev starter world can run without authenticated voice
      // services or an ElevenLabs key. Dialogue text should remain usable even
      // when text-to-speech is unavailable, so do not let this API failure crash
      // the whole React tree.
      log.warn("Voice chat audio unavailable; continuing with text only", {
        error,
      });
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    }
  }, [text, voice, language]);

  return <audio ref={audioRef} autoPlay={true} />;
};
