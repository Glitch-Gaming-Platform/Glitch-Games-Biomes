import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { MiniMap, MiniMapContext } from "@/client/components/map/MiniMap";
import { worldToMinimapClippedCanvasCoordinates } from "@/client/components/map/helpers";
import { Tooltipped } from "@/client/components/system/Tooltipped";
import { useAnimation } from "@/client/util/animation";
import { useCurrentLandName } from "@/client/util/location_helpers";
import { readSnapshotGroveQuestStateV75 } from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import {
  SNAPSHOT_GROVE_QUESTS_V75,
  snapshotGroveLandmarkByIdV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";
import { WorldMetadataId } from "@/shared/ecs/ids";
import { yaw } from "@/shared/math/linear";
import type { Vec3 } from "@/shared/math/types";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import onlinePlayerIcon from "/public/hud/icon-online-players.png";

export const MINI_MAP_WIDTH = "w-24";
export const MINI_MAP_HEIGHT = "h-24";

export const MINI_MAP_ICON_WIDTH = "w-3";
export const MINI_MAP_ICON_HEIGHT = "h-3";

const OnlinePlayers: React.FunctionComponent<{}> = ({}) => {
  const { reactResources } = useClientContext();
  const onlinePlayers =
    reactResources.use("/ecs/c/synthetic_stats", WorldMetadataId)
      ?.online_players ?? 1;
  return (
    <Tooltipped tooltip="Online Players">
      <div
        onClick={() => {
          reactResources.set("/game_modal", { kind: "map" });
        }}
        className="absolute bottom-3 right-1 flex cursor-pointer items-center gap-0.2 text-sm font-semibold text-silver"
      >
        <img src={onlinePlayerIcon.src} className="h-[2.5vmin] w-[2.5vmin]" />{" "}
        {onlinePlayers ?? 0}
      </div>
    </Tooltipped>
  );
};

const LocationName: React.FunctionComponent<{}> = ({}) => {
  const landName = useCurrentLandName();

  return (
    <div
      className={`w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-marge font-semibold`}
    >
      {landName ?? "The Muck"}
    </div>
  );
};

function isSnapshotGroveMapItemMarkerV111(markerId: string, objective: string | undefined) {
  const marker = snapshotGroveLandmarkByIdV75(markerId);
  const text = `${markerId} ${marker?.label ?? ""} ${objective ?? ""}`.toLowerCase();
  return (
    marker?.kind === "resource" ||
    /food|ration|item|sample|root|berry|berries|stick|stone|bolt|key|crate|satchel|basket|bin|bandage|salve|medicine|workbench|drop/.test(text)
  );
}

function useSnapshotGroveMiniMapPinsV111() {
  const [state, setState] = useState(() => readSnapshotGroveQuestStateV75());
  useEffect(() => {
    const refresh = () => setState(readSnapshotGroveQuestStateV75());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    window.addEventListener("biomes:local-dev-snapshot-grove-quest-state-v75", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("biomes:local-dev-snapshot-grove-quest-state-v75", refresh);
    };
  }, []);

  return useMemo(() => {
    const quest = SNAPSHOT_GROVE_QUESTS_V75.find((entry) => entry.id === state.activeQuestId);
    if (!quest || state.completedQuestIds.includes(quest.id)) {
      return [];
    }
    const activeIndex = Math.max(0, Math.min(state.activeObjectiveIndex, quest.objectives.length - 1));
    return quest.markerIds
      .map((markerId, stepIndex) => {
        const marker = snapshotGroveLandmarkByIdV75(markerId);
        if (!marker) {
          return undefined;
        }
        const isActive = stepIndex === activeIndex;
        const isFuture = stepIndex >= activeIndex;
        if (!isFuture && !isActive) {
          return undefined;
        }
        const objective = quest.objectives[stepIndex];
        return {
          key: `${quest.id}-${stepIndex}-${marker.id}`,
          questId: quest.id,
          questTitle: quest.title,
          stepIndex,
          isActive,
          isItem: isSnapshotGroveMapItemMarkerV111(marker.id, objective),
          label: marker.label,
          position: marker.position as Vec3,
          objective,
        };
      })
      .filter(Boolean)
      .slice(0, 12) as Array<{
        key: string;
        questId: string;
        questTitle: string;
        stepIndex: number;
        isActive: boolean;
        isItem: boolean;
        label: string;
        position: Vec3;
        objective?: string;
      }>;
  }, [state.activeObjectiveIndex, state.activeQuestId, state.completedQuestIds]);
}

const SnapshotGroveMiniMapPinV111: React.FunctionComponent<{
  pin: ReturnType<typeof useSnapshotGroveMiniMapPinsV111>[number];
}> = ({ pin }) => {
  const { map, zoomRef } = useContext(MiniMapContext);
  const { reactResources } = useClientContext();
  const ref = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);

  useAnimation(() => {
    if (!map || !ref.current) {
      return;
    }
    const player = reactResources.get("/scene/local_player");
    const camera = reactResources.get("/scene/camera");
    const orientation = -yaw(camera.view());
    const maxDist = map.clientWidth / 2;
    const [x, y, isClipped] = worldToMinimapClippedCanvasCoordinates(
      maxDist,
      pin.position,
      player,
      zoomRef.current,
      map.offsetWidth ?? 0,
      map.offsetHeight ?? 0,
    );
    ref.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${orientation}rad)`;
    setClipped(isClipped);
  });

  if (!map || (clipped && !pin.isActive)) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 flex items-center justify-center"
      data-snapshot-grove-minimap-item-v111={pin.isItem ? "true" : "false"}
      data-snapshot-grove-minimap-active-v111={pin.isActive ? "true" : "false"}
      title={`${pin.questTitle}: ${pin.objective ?? pin.label}`}
      style={{ zIndex: pin.isActive ? 6 : 5, willChange: "transform" }}
    >
      <div
        className={pin.isActive
          ? "flex h-4 w-4 items-center justify-center rounded-full border border-white bg-lime-300 text-[9px] font-black text-black shadow-[0_0_12px_rgba(190,242,100,0.95)] [animation:snapshotGroveMiniMapPulseV111_0.95s_ease-in-out_infinite]"
          : pin.isItem
            ? "flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/80 bg-amber-300 text-[8px] font-black text-black shadow-[0_0_8px_rgba(252,211,77,0.75)]"
            : "flex h-3 w-3 items-center justify-center rounded-full border border-white/70 bg-violet-300 text-[8px] font-black text-black"}
      >
        {pin.isActive ? "!" : pin.isItem ? "I" : pin.stepIndex + 1}
      </div>
    </div>
  );
};

const SnapshotGroveMiniMapQuestMarkersV111: React.FunctionComponent<{}> = () => {
  const pins = useSnapshotGroveMiniMapPinsV111();
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const id = "snapshot-grove-minimap-markers-v111";
    if (document.getElementById(id)) {
      return;
    }
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
@keyframes snapshotGroveMiniMapPulseV111 {
  0%, 100% { transform: scale(1); box-shadow: 0 0 9px rgba(190,242,100,0.7); }
  50% { transform: scale(1.28); box-shadow: 0 0 16px rgba(190,242,100,1); }
}`;
    document.head.appendChild(style);
  }, []);
  if (!pins.length) {
    return null;
  }
  return (
    <>
      {pins.map((pin) => (
        <SnapshotGroveMiniMapPinV111 key={pin.key} pin={pin} />
      ))}
    </>
  );
};

export const MiniMapHUD: React.FunctionComponent<{}> = ({}) => {
  return (
    <div
      className={`relative flex ${MINI_MAP_WIDTH} flex-col items-center gap-0.6 text-white text-shadow-bordered`}
    >
      <MiniMap>
        <SnapshotGroveMiniMapQuestMarkersV111 />
      </MiniMap>
      <OnlinePlayers />
      <LocationName />
    </div>
  );
};
