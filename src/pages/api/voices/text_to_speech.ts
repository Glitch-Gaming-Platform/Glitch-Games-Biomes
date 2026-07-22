import {
  azureSpeechConfigFromEnv,
  synthesizeAzureSpeech,
} from "@/server/shared/azure_speech";
import {
  elevenLabsConfigFromEnv,
  synthesizeElevenLabsSpeech,
} from "@/server/shared/elevenlabs";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { log } from "@/shared/logging";
import { zNpcVoiceProvider } from "@/shared/voices/types";
import { z } from "zod";

export const zChatVoiceRequest = z.object({
  // Bound authenticated requests so a malformed dialogue cannot create an
  // unexpectedly large paid provider request or data URL response.
  text: z.string().max(5000),
  voice: z.string(),
  language: z.string().optional(),
  provider: zNpcVoiceProvider.default("elevenlabs"),
});

export type ChatVoiceRequest = z.infer<typeof zChatVoiceRequest>;

export const zChatVoiceResponse = z.object({
  url: z.string(),
});

export type ChatVoiceResponse = z.infer<typeof zChatVoiceResponse>;

export default biomesApiHandler(
  {
    auth: "required",
    body: zChatVoiceRequest,
    response: zChatVoiceResponse,
  },
  async ({ body: { text, voice, language, provider } }) => {
    try {
      // Provider credentials and voice discovery stay server-side. The client
      // sends the provider choice plus the existing per-NPC voice descriptor.
      const result =
        provider === "elevenlabs"
          ? await synthesizeElevenLabsSpeech({
              config: elevenLabsConfigFromEnv(),
              text,
              voiceProfileId: voice,
              language,
            })
          : await synthesizeAzureSpeech({
              config: azureSpeechConfigFromEnv(),
              text: text.trim(),
              voice,
              language,
            });
      if (!result) {
        return { url: "" };
      }
      return {
        url: `data:${result.contentType};base64,${result.audio.toString(
          "base64"
        )}`,
      };
    } catch (error) {
      log.warn("NPC text-to-speech unavailable; using text only", {
        error,
        provider,
      });
      return { url: "" };
    }
  }
);
