import type { AudioTrackType } from "@/client/game/context_managers/audio_manager";

export const HARTHMERE_BUSINESS_MINIGAME_MUSIC_OVERRIDE_OWNER =
  "harthmere_business_minigame" as const;

export interface HarthmereBusinessMinigameMusicState {
  businessId?: string;
  insideBusiness: boolean;
  sessionStatus?: string;
}

export function harthmereBusinessMinigameMusicTrack(
  state: HarthmereBusinessMinigameMusicState
): AudioTrackType | undefined {
  return state.businessId &&
    state.insideBusiness &&
    state.sessionStatus === "active"
    ? "business_minigame_music"
    : undefined;
}
