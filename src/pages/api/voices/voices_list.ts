import {
  azureSpeechConfigFromEnvV1,
  listAzureSpeechVoicesV1,
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
    const config = azureSpeechConfigFromEnvV1();
    if (!config) {
      return { voices: [] };
    }
    try {
      const voices = await listAzureSpeechVoicesV1({ config });

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
