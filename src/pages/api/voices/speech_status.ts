import { azureOpenAIConfigFromEnv } from "@/server/shared/azure_openai";
import { azureSpeechConfigFromEnv } from "@/server/shared/azure_speech";
import { elevenLabsConfigFromEnv } from "@/server/shared/elevenlabs";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { z } from "zod";

export const zSpeechStatusResponse = z.object({
  speechToText: z.boolean(),
  textToSpeech: z.boolean(),
  openAITextToSpeech: z.boolean(),
  elevenLabsTextToSpeech: z.boolean(),
  generatedChat: z.boolean(),
});

export type SpeechStatusResponse = z.infer<typeof zSpeechStatusResponse>;

export function speechStatusForEnv(
  env: Record<string, string | undefined>
): SpeechStatusResponse {
  // Azure Speech still supplies microphone transcription and the legacy TTS
  // path, while ElevenLabs independently enables the new default TTS path.
  const speechConfigured = Boolean(azureSpeechConfigFromEnv(env));
  const elevenLabsConfigured = Boolean(elevenLabsConfigFromEnv(env));
  return {
    speechToText: speechConfigured,
    textToSpeech: speechConfigured || elevenLabsConfigured,
    openAITextToSpeech: speechConfigured,
    elevenLabsTextToSpeech: elevenLabsConfigured,
    generatedChat: Boolean(azureOpenAIConfigFromEnv(env)),
  };
}

export default biomesApiHandler(
  {
    auth: "required",
    response: zSpeechStatusResponse,
  },
  async () => {
    return speechStatusForEnv(process.env);
  }
);
