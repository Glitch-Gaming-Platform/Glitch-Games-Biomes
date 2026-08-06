import {
  clearChapter1PuppetOverrides,
  publishChapter1PuppetOverrides,
  SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
  type CutscenePuppetOverride,
} from "@/shared/cutscene/puppets";
import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import { harthmereLiveCreatureAssetFor } from "@/shared/harthmere/live_creature_ecs_bridge";
import { snapshotGroveNpcAssetKeyForEntity } from "@/shared/harthmere/snapshot_grove_npc_mesh_routing";
import { ch1CastVisualForEntity } from "@/shared/harthmere/ch1_cast_visuals";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { setCh1WorldPhaseEffectIds } from "@/client/game/renderers/ch1_world_phase";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import React, { useEffect } from "react";

export const CHAPTER1_PROJECTION_RECONCILE_INTERVAL_MS = 6_000;

export interface Chapter1ProjectionResponse {
  staging: Array<{
    key?: string;
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
    const authoredVisual = ch1CastVisualForEntity(npc.entityId);
    const family =
      member?.key === "marrow" || authoredVisual?.route === "animal"
        ? "animal"
        : "live_entity";
    const snapshotAsset = member
      ? snapshotGroveNpcAssetKeyForEntity(member.entityId, member.displayName, {
          isRobot: member.key === "augur9",
        })
      : undefined;
    const fallbackAsset =
      authoredVisual?.asset ??
      snapshotAsset ??
      (authoredVisual?.route === "player_like" ||
      authoredVisual?.route === "snapshot_player_like"
        ? SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET
        : undefined);
    return [
      {
        id: npc.entityId,
        ...(npc.position
          ? { at: [...npc.position] as [number, number, number] }
          : {}),
        yaw: 0,
        label: npc.displayName,
        animation: npc.activity.includes("walking") ? "walk" : undefined,
        ...(npc.position && fallbackAsset
          ? {
              ghost: {
                family,
                asset:
                  fallbackAsset ??
                  harthmereLiveCreatureAssetFor(
                    family,
                    member?.key === "marrow" ? "dog" : undefined,
                    npc.displayName
                  ),
                label: npc.displayName,
                appearanceSourceEntityId: npc.entityId,
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

export function chapter1ProjectionSignature(
  response: Chapter1ProjectionResponse
) {
  return JSON.stringify(response);
}

export const Chapter1WorldProjectionController: React.FunctionComponent =
  () => {
    useEffect(() => {
      if (!nativeBiomesEcsAuthorityEnabled()) return;
      let disposed = false;
      let inFlight = false;
      let lastPublishedSignature: string | undefined;
      const publishIfChanged = (response: Chapter1ProjectionResponse) => {
        const signature = chapter1ProjectionSignature(response);
        if (signature === lastPublishedSignature) {
          return;
        }
        lastPublishedSignature = signature;
        publishProjection(response);
      };
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
            publishIfChanged(e2eProjection);
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
            publishIfChanged(
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
      // Mutating chapter actions already emit chapter1-story-updated, so they
      // refresh immediately. The slower interval is only a reconciliation
      // safety net for cross-tab/server-side changes.
      const onStoryUpdated = () => void refresh();
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") void refresh();
      };
      window.addEventListener("chapter1-story-updated", onStoryUpdated);
      document.addEventListener("visibilitychange", onVisibilityChange);
      const timer = window.setInterval(
        () => void refresh(),
        CHAPTER1_PROJECTION_RECONCILE_INTERVAL_MS
      );
      return () => {
        disposed = true;
        window.clearInterval(timer);
        window.removeEventListener("chapter1-story-updated", onStoryUpdated);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        clearChapter1PuppetOverrides();
        setCh1WorldPhaseEffectIds(undefined);
        delete window.__chapter1WorldPhase;
      };
    }, []);
    return null;
  };
