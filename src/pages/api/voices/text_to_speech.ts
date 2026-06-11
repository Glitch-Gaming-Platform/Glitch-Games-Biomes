import {
  azureSpeechConfigFromEnvV1,
  synthesizeAzureSpeechV1,
} from "@/server/shared/azure_speech";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { log } from "@/shared/logging";
import { z } from "zod";

export const zChatVoiceRequest = z.object({
  text: z.string(),
  voice: z.string(),
  language: z.string().optional(),
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
  async ({ body: { text, voice, language } }) => {
    const config = azureSpeechConfigFromEnvV1();
    if (!config) {
      return { url: "" };
    }

    try {
      const result = await synthesizeAzureSpeechV1({
        config,
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
      log.warn("Azure Speech text-to-speech unavailable; using text only", {
        error,
      });
      return { url: "" };
    }
  }
);
