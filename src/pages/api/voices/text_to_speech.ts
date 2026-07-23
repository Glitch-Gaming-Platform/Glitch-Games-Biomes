import {
  AZURE_SPEECH_SYNTHESIS_POLICY_VERSION,
  azureSpeechConfigFromEnv,
  synthesizeAzureSpeech,
} from "@/server/shared/azure_speech";
import {
  elevenLabsConfigFromEnv,
  elevenLabsSpokenTextForTest,
  elevenLabsSynthesisCacheIdentity,
  synthesizeElevenLabsSpeech,
} from "@/server/shared/elevenlabs";
import {
  npcVoiceAudioCacheKey,
  resolveNpcVoiceAudioUrl,
} from "@/server/shared/npc_voice_audio_cache";
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

export async function resolveChatVoiceRequest(
  body: ChatVoiceRequest
): Promise<ChatVoiceResponse> {
  const { text, voice, language, provider } = body;
  // Provider credentials and voice discovery stay server-side. The client
  // sends the provider choice plus the existing per-NPC voice descriptor.
  const elevenLabsConfig =
    provider === "elevenlabs" ? elevenLabsConfigFromEnv() : undefined;
  const azureConfig =
    provider === "openai" ? azureSpeechConfigFromEnv() : undefined;
  if (!elevenLabsConfig && !azureConfig) {
    return { url: "" };
  }
  // Cache the exact text sent to the selected provider. ElevenLabs removes
  // visual-only markup before synthesis, while Azure receives trimmed text.
  const spokenText =
    provider === "elevenlabs" ? elevenLabsSpokenTextForTest(text) : text.trim();
  if (!spokenText) {
    return { url: "" };
  }
  const synthesisIdentity = elevenLabsConfig
    ? elevenLabsSynthesisCacheIdentity(elevenLabsConfig)
    : AZURE_SPEECH_SYNTHESIS_POLICY_VERSION;
  const cacheKey = npcVoiceAudioCacheKey({
    provider,
    synthesisIdentity,
    text: spokenText,
    voice,
    language,
  });
  const url = await resolveNpcVoiceAudioUrl({
    cacheKey,
    provider,
    generate: async () => {
      const result = elevenLabsConfig
        ? await synthesizeElevenLabsSpeech({
            config: elevenLabsConfig,
            // The synthesizer performs this normalization internally too;
            // retain the original here so entity decoding happens once.
            text,
            voiceProfileId: voice,
            language,
          })
        : await synthesizeAzureSpeech({
            config: azureConfig,
            text: spokenText,
            voice,
            language,
          });
      return result
        ? { audio: result.audio, contentType: result.contentType }
        : undefined;
    },
  });
  return { url };
}

export default biomesApiHandler(
  {
    auth: "required",
    body: zChatVoiceRequest,
    response: zChatVoiceResponse,
  },
  async ({ body }) => {
    try {
      return await resolveChatVoiceRequest(body);
    } catch (error) {
      log.warn("NPC text-to-speech unavailable; using text only", {
        error,
        provider: body.provider,
      });
      return { url: "" };
    }
  }
);
