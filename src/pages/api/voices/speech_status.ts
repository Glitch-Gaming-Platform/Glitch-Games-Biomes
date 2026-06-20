import { azureOpenAIConfigFromEnv } from "@/server/shared/azure_openai";
import { azureSpeechConfigFromEnv } from "@/server/shared/azure_speech";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { z } from "zod";

export const zSpeechStatusResponse = z.object({
  speechToText: z.boolean(),
  textToSpeech: z.boolean(),
  generatedChat: z.boolean(),
});

export type SpeechStatusResponse = z.infer<typeof zSpeechStatusResponse>;

export function speechStatusForEnv(
  env: Record<string, string | undefined>
): SpeechStatusResponse {
  const speechConfigured = Boolean(azureSpeechConfigFromEnv(env));
  return {
    speechToText: speechConfigured,
    textToSpeech: speechConfigured,
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
