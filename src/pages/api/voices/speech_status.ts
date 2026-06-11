import { azureOpenAIConfigFromEnvV1 } from "@/server/shared/azure_openai";
import { azureSpeechConfigFromEnvV1 } from "@/server/shared/azure_speech";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { z } from "zod";

export const zSpeechStatusResponse = z.object({
  speechToText: z.boolean(),
  textToSpeech: z.boolean(),
  generatedChat: z.boolean(),
});

export type SpeechStatusResponse = z.infer<typeof zSpeechStatusResponse>;

export function speechStatusForEnvV1(
  env: Record<string, string | undefined>
): SpeechStatusResponse {
  const speechConfigured = Boolean(azureSpeechConfigFromEnvV1(env));
  return {
    speechToText: speechConfigured,
    textToSpeech: speechConfigured,
    generatedChat: Boolean(azureOpenAIConfigFromEnvV1(env)),
  };
}

export default biomesApiHandler(
  {
    auth: "required",
    response: zSpeechStatusResponse,
  },
  async () => {
    return speechStatusForEnvV1(process.env);
  }
);
