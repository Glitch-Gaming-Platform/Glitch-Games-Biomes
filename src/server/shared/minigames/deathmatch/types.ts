import {
  zBaseMinigameSettings,
  zMinigameLoadoutSetting,
} from "@/server/shared/minigames/types";
import { BikkieIds } from "@/shared/bikkie/ids";
import { z } from "zod";

export const zDeathmatchSettings = zBaseMinigameSettings.extend({
  minPlayers: z.number().int().min(1).max(32).default(2),
  countdownSeconds: z.number().min(0).max(120).default(10),
  roundLengthSeconds: z
    .number()
    .min(10)
    .max(3600)
    .default(2 * 60),
  loadOut: zMinigameLoadoutSetting.default([
    [BikkieIds.megaAxe, 1],
    [BikkieIds.superStriker, 1],
    [BikkieIds.bizzyCola, 1],
  ]),
});
export type DeathmatchSettings = z.infer<typeof zDeathmatchSettings>;
