// HARTHMERE_CUTSCENE_RESOURCE
//
// The /scene/cutscene resource: single source of truth for "a cutscene is
// running" that the player script (input lock), the audio script (music
// override), the overlay (letterbox/subtitles/skip UI) and the director all
// share.

import type { ClientContext } from "@/client/game/context";
import type { ClientResourcesBuilder } from "@/client/game/resources/types";
import type { RegistryLoader } from "@/shared/registry";

export interface CutsceneSubtitle {
  speaker?: string;
  text: string;
  /** Provider-neutral NPC actor descriptor; absent for player/narration text. */
  voice?: string;
}

export interface CutsceneUiState {
  active: boolean;
  defId?: string;
  letterbox: boolean;
  hideHud: boolean;
  lockInput: boolean;
  invulnerable: boolean;
  subtitle?: CutsceneSubtitle;
  musicOverride?: string;
  /** Set by the overlay (ESC); consumed by the director. */
  skipRequested: boolean;
  /** Set by the overlay (Space/click); consumed by the director. */
  advanceRequested: boolean;
  /** Whether the active shot is currently accepting dialogue advance input. */
  canAdvance: boolean;
  /** Whether the skip prompt should be shown right now. */
  canSkip: boolean;
  /** Dedicated cinematic fade, independent from the warp/world-load effect. */
  fadeOpacity: number;
  fadeTransitionMs: number;
}

export function emptyCutsceneUiState(): CutsceneUiState {
  return {
    active: false,
    defId: undefined,
    letterbox: false,
    hideHud: false,
    lockInput: false,
    invulnerable: false,
    subtitle: undefined,
    musicOverride: undefined,
    skipRequested: false,
    advanceRequested: false,
    canAdvance: false,
    canSkip: false,
    fadeOpacity: 0,
    fadeTransitionMs: 0,
  };
}

export async function addCutsceneResources(
  _loader: RegistryLoader<ClientContext>,
  builder: ClientResourcesBuilder
) {
  builder.addGlobal("/scene/cutscene", emptyCutsceneUiState());
}
