import {
  azureSpeechConfigFromEnv,
  listAzureSpeechVoices,
} from "@/server/shared/azure_speech";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { log } from "@/shared/logging";
import { z } from "zod";

export const zVoicesListResponse = z.object({
  voices: z.array(
    z.object({
      name: z.string(),
      voiceId: z.string(),
    })
  ),
});

export type VoicesListResponse = z.infer<typeof zVoicesListResponse>;

export default biomesApiHandler(
  {
    auth: "required",
    response: zVoicesListResponse,
  },
  async () => {
    const config = azureSpeechConfigFromEnv();
    if (!config) {
      return { voices: [] };
    }
    try {
      const voices = await listAzureSpeechVoices({ config });

      return {
        voices: (voices ?? []).flatMap((voice) => {
          if (!voice.ShortName) {
            return [];
          }
          return [
            {
              name: voice.Name ?? voice.ShortName,
              voiceId: voice.ShortName,
            },
          ];
        }),
      };
    } catch (error) {
      log.warn("Azure Speech voices list unavailable", { error });
      return { voices: [] };
    }
  }
);
