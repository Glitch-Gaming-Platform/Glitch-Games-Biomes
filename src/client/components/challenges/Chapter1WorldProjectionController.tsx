import {
  clearChapter1PuppetOverrides,
  publishChapter1PuppetOverrides,
  type CutscenePuppetOverride,
} from "@/shared/cutscene/puppets";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { setCh1WorldPhaseEffectIds } from "@/client/game/renderers/ch1_world_phase";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import React, { useEffect } from "react";

interface Chapter1ProjectionResponse {
  staging: Array<{
    entityId: number;
    displayName: string;
    present: boolean;
    useSeededBody: boolean;
    position?: [number, number, number];
    activity: string;
  }>;
  worldPhase: Array<{ id: string; summary: string }>;
}

declare global {
  interface Window {
    __chapter1WorldPhase?: Chapter1ProjectionResponse["worldPhase"];
  }
}

function publishProjection(response: Chapter1ProjectionResponse) {
  const overrides: CutscenePuppetOverride[] = response.staging.flatMap(
    (npc) => {
      if (!npc.present) {
        return [
          { id: npc.entityId, yaw: 0, hidden: true, label: npc.displayName },
        ];
      }
      return [
        {
          id: npc.entityId,
          ...(npc.position
            ? { at: [...npc.position] as [number, number, number] }
            : {}),
          yaw: 0,
          label: npc.displayName,
          animation: npc.activity.includes("walking") ? "walk" : undefined,
        },
      ];
    }
  );
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
