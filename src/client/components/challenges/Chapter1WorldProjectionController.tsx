import {
  clearChapter1PuppetOverrides,
  publishChapter1PuppetOverrides,
  type CutscenePuppetOverride,
} from "@/shared/cutscene/puppets";
import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import { harthmereLiveCreatureAssetFor } from "@/shared/harthmere/live_creature_ecs_bridge";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { setCh1WorldPhaseEffectIds } from "@/client/game/renderers/ch1_world_phase";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import React, { useEffect } from "react";

export interface Chapter1ProjectionResponse {
  staging: Array<{
    entityId: number;
    displayName: string;
    present: boolean;
    useSeededBody: boolean;
    position?: [number, number, number];
    activity: string;
  }>;
  worldPhase: Array<{ id: string; summary: string }>;
  /** E2E catalog playback hides persistent story bodies until the director
   * publishes the scene's actual cast, preventing non-cast actors from
   * standing on top of the subject. Never returned by the production API. */
  isolateCutsceneCast?: boolean;
}

declare global {
  interface Window {
    __chapter1WorldPhase?: Chapter1ProjectionResponse["worldPhase"];
    /** Local visual-audit fixture; never installed outside the E2E route. */
    __chapter1E2ECutsceneProjection?: Chapter1ProjectionResponse;
  }
}

export function chapter1ProjectionPuppetOverrides(
  response: Chapter1ProjectionResponse
): CutscenePuppetOverride[] {
  const castByEntityId = new Map(
    CH1_NEW_CAST.map((member) => [member.entityId as number, member])
  );
  return response.staging.flatMap<CutscenePuppetOverride>((npc) => {
    if (response.isolateCutsceneCast) {
      return [
        { id: npc.entityId, yaw: 0, hidden: true, label: npc.displayName },
      ];
    }
    if (!npc.present) {
      return [
        { id: npc.entityId, yaw: 0, hidden: true, label: npc.displayName },
      ];
    }
    const member = castByEntityId.get(npc.entityId);
    const family = member?.key === "marrow" ? "animal" : "live_entity";
    return [
      {
        id: npc.entityId,
        ...(npc.position
          ? { at: [...npc.position] as [number, number, number] }
          : {}),
        yaw: 0,
        label: npc.displayName,
        animation: npc.activity.includes("walking") ? "walk" : undefined,
        ...(npc.position && member
          ? {
              ghost: {
                family,
                asset: harthmereLiveCreatureAssetFor(
                  family,
                  member.key === "marrow" ? "dog" : undefined,
                  npc.displayName
                ),
                label: npc.displayName,
              },
            }
          : {}),
      },
    ];
  });
}

function publishProjection(response: Chapter1ProjectionResponse) {
  const overrides = chapter1ProjectionPuppetOverrides(response);
  publishChapter1PuppetOverrides(overrides);
  setCh1WorldPhaseEffectIds(response.worldPhase.map((effect) => effect.id));
  window.__chapter1WorldPhase = response.worldPhase;
  window.dispatchEvent(new CustomEvent("chapter1-world-projection-updated"));
}

export const Chapter1WorldProjectionController: React.FunctionComponent =
  () => {
    useEffect(() => {
      if (!nativeBiomesEcsAuthorityEnabled()) return;
      let disposed = false;
      let inFlight = false;
      const refresh = async () => {
        if (disposed || inFlight || document.visibilityState !== "visible")
          return;
        inFlight = true;
        try {
          // Direct catalog playback has no active quest step to drive the
          // normal per-player projection. Keep its explicit story stage stable
          // instead of letting the one-second poll replace it mid-shot with the
          // current saved-game state.
          const e2eProjection = window.__chapter1E2ECutsceneProjection;
          if (e2eProjection) {
            publishProjection(e2eProjection);
            return;
          }
          const response = await defaultHarthmereLiveFetch(
            "/api/harthmere/chapter1_story",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "state" }),
              cache: "no-store",
            }
          );
          if (response.ok && !disposed) {
            publishProjection(
              (await response.json()) as Chapter1ProjectionResponse
            );
          }
        } catch {
          // A projection poll is advisory presentation state. Keep the last
          // successful stage until the authenticated route is available again.
        } finally {
          inFlight = false;
        }
      };
      void refresh();
      const timer = window.setInterval(() => void refresh(), 1_000);
      return () => {
        disposed = true;
        window.clearInterval(timer);
        clearChapter1PuppetOverrides();
        setCh1WorldPhaseEffectIds(undefined);
        delete window.__chapter1WorldPhase;
      };
    }, []);
    return null;
  };
