import {
  azureSpeechConfigFromEnvV1,
  transcribeAzureSpeechV1,
} from "@/server/shared/azure_speech";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { log } from "@/shared/logging";
import { z } from "zod";

export const zSpeechToTextRequest = z.object({
  audioBase64: z.string(),
  mimeType: z.string().optional(),
  language: z.string().optional(),
});

export type SpeechToTextRequest = z.infer<typeof zSpeechToTextRequest>;

export const zSpeechToTextResponse = z.object({
  text: z.string(),
  unavailableReason: z.string().optional(),
});

export type SpeechToTextResponse = z.infer<typeof zSpeechToTextResponse>;

export default biomesApiHandler(
  {
    auth: "required",
    body: zSpeechToTextRequest,
    response: zSpeechToTextResponse,
  },
  async ({ body: { audioBase64, mimeType, language } }) => {
    const config = azureSpeechConfigFromEnvV1();
    if (!config) {
      return {
        text: "",
        unavailableReason: "Azure Speech is not configured.",
      };
    }

    try {
      const text = await transcribeAzureSpeechV1({
        config,
        audio: Buffer.from(audioBase64, "base64"),
        mimeType,
        language,
      });
      return { text: text ?? "" };
    } catch (error) {
      log.warn("Azure Speech recognition unavailable", { error });
      return {
        text: "",
        unavailableReason: "Azure Speech could not transcribe this audio.",
      };
    }
  }
);
