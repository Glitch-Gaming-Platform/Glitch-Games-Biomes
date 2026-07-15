import { readLiveEntityHelperQuestState } from "@/client/components/challenges/LocalDevLiveEntityHelperQuestState";
import { liveEntityHelperQuestRecordReadyToTurnIn } from "@/client/components/challenges/LocalDevLiveEntityHelperQuests";
import {
  firstActiveSnapshotRoadAheadQuestTitleForBiomesUI,
  readSnapshotMissionState,
  snapshotRoadAheadMissionStepsForBiomesUI,
  snapshotRoadAheadTrackableQuestsForBiomesUI,
} from "@/client/components/challenges/LocalDevSnapshotMissionBridge";
import {
  BUILDING_SYSTEM_GROVE_STEWARD_NPC,
  BUILDING_SYSTEM_MIRA_INTRO_QUEST,
} from "@/shared/harthmere/building_system";
import {
  activeBiomesUIMapPinFromMarkerForTest,
  readActiveBiomesUIMapPin,
  shouldClearStaleActiveMapPin,
  writeActiveBiomesUIMapPin,
} from "./mapPinnedDestination";
import {
  readBiomesUIMainQuestSelection,
  setBiomesUIMainQuestFromTrackableQuest,
  writeBiomesUIMainQuestSelection,
} from "./mainQuestSelection";
import { appendHarthmereBusinessOutpostMapLandmarks } from "./harthmereBusinessMapMarkers";
import {
  activeJobsBoardMissionStepsForBiomesUI,
  firstActiveJobsBoardQuestTitleForBiomesUI,
  jobsBoardAcceptedJobLandmarksForBiomesUI,
  jobsBoardItemSourceLandmarksForBiomesUI,
  jobsBoardToolSourceLandmarksForBiomesUI,
  jobsBoardTrackableQuestsForBiomesUI,
} from "./jobsBoardQuestMapAdapter";
import { harthmereJobToolOwnedState } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  BIOMES_UI_LIVE_ENTITY_HELPER_MARKER_SOURCE,
  activeLiveEntityHelperMissionStepsForBiomesUI,
  firstActiveLiveEntityHelperQuestTitleForBiomesUI,
  liveEntityHelperAcceptedQuestLandmarksForBiomesUI,
  liveEntityHelperTrackableQuestsForBiomesUI,
  mergeLiveEntityHelperQuestStatesForBiomesUI,
} from "./liveEntityHelperQuestMapAdapter";
import {
  BIOMES_UI_SHARED_QUEST_MARKER_SOURCE,
  activeSharedQuestMissionStepsForBiomesUI,
  firstActiveSharedQuestTitleForBiomesUI,
  sharedQuestAcceptedLandmarksForBiomesUI,
  sharedQuestTrackableQuestsForBiomesUI,
} from "./questInviteAdapter";
// HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14).
import { bibleQuestTrackableQuestsForBiomesUI } from "@/client/components/challenges/bibleQuestLiveAdapter";
import { readableMapMarkerLabelForTest } from "./mapMarkerLabels";
import { harthmereMapTerrainRegionsForBounds } from "./harthmereMapTerrainRegions";
import {
  HARTHMERE_PROPERTY_MARKER_SOURCE,
  harthmerePropertyMapLandmarksFromBuildingState,
  harthmerePurchasablePlotMapLandmarksFromBuildingState,
  type HarthmerePropertyMapBuildingState,
} from "./propertyMapMarkers";

function readSnapshotGroveApi(): any | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as any).__snapshotGrove;
}

function normalizeMarkerId(markerId: string): string {
  const lower = markerId.toLowerCase();
  if (
    lower.includes("mira") ||
    lower.includes("miranda") ||
    lower.includes("steward")
  )
    return "mira_grove_land_steward";
  if (lower.includes("jackie")) return "jackie";
  if (lower.includes("jump") || lower.includes("stretch")) return "jump_run";
  if (lower.includes("road")) return "road_marker";
  if (lower.includes("muck")) return "muckwad_patch";
  if (lower.includes("build") || lower.includes("place"))
    return "building_spot";
  if (
    lower.includes("wardrobe") ||
    lower.includes("mirror") ||
    lower.includes("locks")
  )
    return "wardrobe";
  if (
    lower.includes("selfie") ||
    lower.includes("overlook") ||
    lower.includes("camera")
  )
    return "selfie_overlook";
  if (
    lower.includes("craft") ||
    lower.includes("service_tower") ||
    lower.includes("tower_platform")
  )
    return "crafting_stop";
  return markerId.replace(/^npc_/, "").replace(/^grove_/, "");
}

function questIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function liveModeActiveQuestIds(liveQuestState: any) {
  return liveQuestState?.active && typeof liveQuestState.active === "object"
    ? Object.keys(liveQuestState.active)
    : [];
}

function liveModeCompletedQuestIds(liveQuestState: any) {
  return liveQuestState?.completed &&
    typeof liveQuestState.completed === "object"
    ? Object.keys(liveQuestState.completed)
    : [];
}

function liveModeActiveQuestObjectiveIndex(
  liveQuestState: any,
  questId: string
) {
  const record =
    liveQuestState?.active && typeof liveQuestState.active === "object"
      ? liveQuestState.active[questId]
      : undefined;
  if (!record || typeof record !== "object") {
    return undefined;
  }
  if (typeof record.objectiveIndex === "number") {
    return Math.max(0, Math.floor(record.objectiveIndex));
  }
  if (typeof record.stepId === "string") {
    const escapedQuestId = questId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = record.stepId.match(
      new RegExp(`^${escapedQuestId}:(\\d+)(?::|$)`)
    );
    if (match) {
      return Math.max(0, Number(match[1]));
    }
  }
  if (typeof record.progress === "number") {
    return Math.max(0, Math.floor(record.progress) - 1);
  }
  return undefined;
}

function humanizeQuestKindLabel(value: unknown) {
  const text = typeof value === "string" && value.trim() ? value : "Quest";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function activeSnapshotQuestForBiomesUI(
  quests: any[],
  state: any,
  liveQuestState?: unknown
) {
  const completed = new Set([
    ...questIds(state?.completedQuestIds),
    ...liveModeCompletedQuestIds(liveQuestState),
  ]);
  const activeQuestId =
    typeof state?.activeQuestId === "string" &&
    !completed.has(state.activeQuestId)
      ? state.activeQuestId
      : undefined;
  const acceptedQuestId = questIds(state?.acceptedQuestIds).find(
    (questId) => !completed.has(questId)
  );
  const liveQuestId = liveModeActiveQuestIds(liveQuestState).find(
    (questId) => !completed.has(questId)
  );
  const questId = activeQuestId ?? acceptedQuestId ?? liveQuestId;
  return quests.find((quest: any) => quest?.id === questId);
}

// Live map adapter feeds the upgraded MapQuestsTab with everything the
// player should see: their own position, Grove landmarks, Harthmere business
// outposts, Jobs Board, all known NPCs, and highlighted active quest paths.
export function buildBiomesUIMapAdapter(
  snapshotRevision: number,
  playerWorldPos?: [number, number, number],
  jobsBoardState?: unknown,
  liveQuestState?: unknown,
  buildingState?: HarthmerePropertyMapBuildingState,
  roadAheadChallengeStepHints?: Iterable<unknown>
) {
  const NormalizeWorldXZ = (
    worldX: number,
    worldZ: number,
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  ) => {
    const x = (worldX - bounds.minX) / Math.max(1, bounds.maxX - bounds.minX);
    const y = (worldZ - bounds.minZ) / Math.max(1, bounds.maxZ - bounds.minZ);
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };
  const ComputeBounds = (landmarks: any[]) => {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const landmark of landmarks) {
      const pos = landmark?.position;
      if (!Array.isArray(pos)) continue;
      const wx = Number(pos[0]);
      const wz = Number(pos[2]);
      if (!Number.isFinite(wx) || !Number.isFinite(wz)) continue;
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wz < minZ) minZ = wz;
      if (wz > maxZ) maxZ = wz;
    }
    if (!Number.isFinite(minX)) {
      return { minX: 360, maxX: 600, minZ: -270, maxZ: -100 };
    }
    const padX = (maxX - minX) * 0.08 || 12;
    const padZ = (maxZ - minZ) * 0.08 || 12;
    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minZ: minZ - padZ,
      maxZ: maxZ + padZ,
    };
  };
  const VisibleMapLandmarks = (landmarks: any[]) =>
    landmarks.filter(
      (landmark) => landmark && landmark.visibleOnWorldMap !== false
    );
  const LandmarkKind = (
    landmark: any
  ):
    | "vendor"
    | "store"
    | "business"
    | "bank"
    | "quest"
    | "resource"
    | "danger"
    | "safe_zone"
    | "route"
    | "town"
    | "property"
    | "objective" => {
    const id = String(landmark?.id ?? "").toLowerCase();
    const label = readableMapMarkerLabelForTest(landmark).toLowerCase();
    const kind = String(landmark?.kind ?? "").toLowerCase();
    const area = String(landmark?.area ?? "").toLowerCase();
    if (kind === "objective") return "objective";
    if (
      kind === "property" ||
      landmark?.source === HARTHMERE_PROPERTY_MARKER_SOURCE
    )
      return "property";
    if (kind === "quest") return "quest";
    if (
      kind === "danger" ||
      /danger|enemy|muckwad|threat/.test(id + " " + label)
    )
      return "danger";
    if (
      kind === "resource" ||
      /resource|berry|wood|stone|ore|root/.test(id + " " + label)
    )
      return "resource";
    if (/job|board|notice|kiosk/.test(id + " " + label)) return "quest";
    if (/bank|vault|merl/.test(id + " " + label)) return "bank";
    if (kind === "business" || /business|outpost_/.test(id)) return "business";
    if (
      kind === "interactable" ||
      /shop|store|stall|merchant|kiosk|mira|office|chapel|guild|charter|workbench|table|service|building/.test(
        id + " " + label
      )
    )
      return "store";
    if (
      kind === "npc" ||
      /npc_|jackie|billy|jane|luis|taye|alexis|sil|dimmi|doc|coop|buddy|rosalyn|nia|merl/.test(
        id + " " + label
      )
    )
      return "vendor";
    if (
      kind === "connector" ||
      /road|route|bridge|connector|path/.test(id + " " + label + " " + area)
    )
      return "route";
    if (
      id === "the_grove" ||
      label === "the grove" ||
      /^hal 9000$|^goldie b$/.test(label)
    )
      return "town";
    if (
      kind === "safe_zone" ||
      /safe|fountain|sanctuary/.test(id + " " + label)
    )
      return "safe_zone";
    return "objective";
  };
  const MarkerId = (landmark: any) => {
    const id = String(landmark?.id ?? "");
    const kind = String(landmark?.kind ?? "").toLowerCase();
    return kind === "business" ||
      kind === "property" ||
      landmark?.source === HARTHMERE_PROPERTY_MARKER_SOURCE ||
      landmark?.source === BIOMES_UI_LIVE_ENTITY_HELPER_MARKER_SOURCE ||
      landmark?.source === BIOMES_UI_SHARED_QUEST_MARKER_SOURCE
      ? id
      : normalizeMarkerId(id);
  };
  const MapLandmarks = () => {
    const api = readSnapshotGroveApi();
    const liveEntityHelperState = mergeLiveEntityHelperQuestStatesForBiomesUI(
      readLiveEntityHelperQuestState(),
      liveQuestState
    );
    const toolOwned = harthmereJobToolOwnedState();
    return appendHarthmereBusinessOutpostMapLandmarks([
      ...(Array.isArray(api?.landmarks) ? api.landmarks : []),
      ...jobsBoardAcceptedJobLandmarksForBiomesUI(jobsBoardState),
      ...jobsBoardItemSourceLandmarksForBiomesUI(jobsBoardState),
      ...jobsBoardToolSourceLandmarksForBiomesUI(jobsBoardState, toolOwned),
      ...liveEntityHelperAcceptedQuestLandmarksForBiomesUI(
        liveEntityHelperState,
        { isReadyToTurnIn: liveEntityHelperQuestRecordReadyToTurnIn }
      ),
      ...sharedQuestAcceptedLandmarksForBiomesUI(liveQuestState),
      ...harthmerePropertyMapLandmarksFromBuildingState(buildingState),
      // Show unowned plots as "for sale" pins so players can find/preview a plot
      // (location, district, price) before buying.
      ...harthmerePurchasablePlotMapLandmarksFromBuildingState(buildingState),
    ]);
  };
  return {
    getMapBounds: () => {
      void snapshotRevision;
      const landmarks = MapLandmarks();
      return ComputeBounds(VisibleMapLandmarks(landmarks));
    },
    getTerrainRegions: () => {
      void snapshotRevision;
      const landmarks = MapLandmarks();
      const bounds = ComputeBounds(VisibleMapLandmarks(landmarks));
      return harthmereMapTerrainRegionsForBounds(bounds);
    },
    getPlayerMarker: () => {
      void snapshotRevision;
      if (!playerWorldPos) return undefined;
      const landmarks = MapLandmarks();
      const bounds = ComputeBounds(VisibleMapLandmarks(landmarks));
      const { x, y } = NormalizeWorldXZ(
        playerWorldPos[0],
        playerWorldPos[2],
        bounds
      );
      return {
        id: "local_player",
        label: "You",
        x,
        y,
        kind: "player" as const,
        worldPosition: playerWorldPos,
        description: `World position ${Math.round(
          playerWorldPos[0]
        )}, ${Math.round(playerWorldPos[1])}, ${Math.round(
          playerWorldPos[2]
        )}.`,
      };
    },
    getMarkers: () => {
      void snapshotRevision;
      const api = readSnapshotGroveApi();
      const state = api?.readState?.();
      const quests = Array.isArray(api?.quests) ? api.quests : [];
      const landmarks = MapLandmarks();
      const activeQuest = activeSnapshotQuestForBiomesUI(
        quests,
        state,
        liveQuestState
      );
      const roadAheadQuest = snapshotRoadAheadTrackableQuestsForBiomesUI(
        readSnapshotMissionState(),
        roadAheadChallengeStepHints
      )[0];
      const activeRoadAheadMarkerId =
        roadAheadQuest?.status === "active"
          ? roadAheadQuest.firstMarkerId
          : undefined;
      const activeMarkerIds: string[] = Array.isArray(activeQuest?.markerIds)
        ? activeQuest.markerIds
        : [];
      const normalizedActiveMarkerIds = activeMarkerIds.map(normalizeMarkerId);
      const liveObjectiveIndex = activeQuest?.id
        ? liveModeActiveQuestObjectiveIndex(liveQuestState, activeQuest.id)
        : undefined;
      const localObjectiveIndex = Number(state?.activeObjectiveIndex ?? 0);
      const activeObjectiveIndex =
        state?.activeQuestId === activeQuest?.id
          ? localObjectiveIndex
          : liveObjectiveIndex ?? localObjectiveIndex;
      const activeObjectiveMarker =
        activeMarkerIds[
          Math.max(
            0,
            Math.min(activeMarkerIds.length - 1, activeObjectiveIndex)
          )
        ];
      const normalizedActiveObjectiveMarker = activeObjectiveMarker
        ? normalizeMarkerId(activeObjectiveMarker)
        : undefined;
      const visibleLandmarks = VisibleMapLandmarks(landmarks);
      const bounds = ComputeBounds(visibleLandmarks);
      const result: any[] = [];

      for (const landmark of visibleLandmarks) {
        const pos = landmark?.position;
        if (!Array.isArray(pos)) continue;
        const { x, y } = NormalizeWorldXZ(
          Number(pos[0]),
          Number(pos[2]),
          bounds
        );
        const kind = LandmarkKind(landmark);
        const markerId = MarkerId(landmark);
        const isInActiveChain =
          activeMarkerIds.includes(landmark.id) ||
          normalizedActiveMarkerIds.includes(markerId);
        const isCurrentObjective =
          activeObjectiveMarker === landmark.id ||
          normalizedActiveObjectiveMarker === markerId;
        const isRoadAheadObjective =
          activeRoadAheadMarkerId !== undefined &&
          markerId === activeRoadAheadMarkerId;
        const isAcceptedJobMarker =
          landmark?.active === true && kind === "objective";
        const isLiveEntityHelperMarker =
          landmark?.active === true &&
          landmark?.source === BIOMES_UI_LIVE_ENTITY_HELPER_MARKER_SOURCE;
        const isSharedQuestMarker =
          landmark?.active === true &&
          landmark?.source === BIOMES_UI_SHARED_QUEST_MARKER_SOURCE;
        const isActiveQuestMarker =
          isCurrentObjective ||
          isRoadAheadObjective ||
          isInActiveChain ||
          isAcceptedJobMarker ||
          isLiveEntityHelperMarker ||
          isSharedQuestMarker;
        result.push({
          id: markerId,
          label: readableMapMarkerLabelForTest(landmark),
          x,
          y,
          kind:
            isCurrentObjective ||
            isRoadAheadObjective ||
            isAcceptedJobMarker ||
            isLiveEntityHelperMarker ||
            isSharedQuestMarker
              ? ("objective" as const)
              : kind,
          active: isActiveQuestMarker,
          worldPosition: [
            Number(pos[0]),
            Number(pos[1] ?? 0),
            Number(pos[2]),
          ] as [number, number, number],
          description: isLiveEntityHelperMarker
            ? String(landmark.description ?? "Active helper quest target.")
            : isSharedQuestMarker
            ? String(landmark.description ?? "Shared quest target.")
            : isAcceptedJobMarker
            ? String(landmark.description ?? "Accepted jobs board task.")
            : isRoadAheadObjective
            ? "Current Road Ahead objective - head here to advance the route."
            : isCurrentObjective
            ? "Current objective - head here to advance the active quest."
            : isInActiveChain
            ? "Part of the active quest path."
            : String(
                landmark.description ??
                  `${landmark.area ?? "Grove"} - ${landmark.kind ?? "landmark"}`
              ),
        });
      }
      if (!result.some((marker) => marker.id === "mira_grove_land_steward")) {
        const bounds = ComputeBounds(visibleLandmarks);
        const normalized = NormalizeWorldXZ(
          BUILDING_SYSTEM_GROVE_STEWARD_NPC.position[0],
          BUILDING_SYSTEM_GROVE_STEWARD_NPC.position[2],
          bounds
        );
        const miraQuestActive = liveModeActiveQuestIds(liveQuestState).includes(
          BUILDING_SYSTEM_MIRA_INTRO_QUEST.questId
        );
        result.push({
          id: "mira_grove_land_steward",
          label: BUILDING_SYSTEM_GROVE_STEWARD_NPC.displayName,
          x: normalized.x,
          y: normalized.y,
          kind: miraQuestActive ? ("objective" as const) : ("store" as const),
          active: miraQuestActive,
          worldPosition: [...BUILDING_SYSTEM_GROVE_STEWARD_NPC.position] as [
            number,
            number,
            number
          ],
        });
      }
      return result;
    },
    getMissionTitle: () => {
      const api = readSnapshotGroveApi();
      const state = api?.readState?.();
      const quests = Array.isArray(api?.quests) ? api.quests : [];
      const activeQuest = activeSnapshotQuestForBiomesUI(
        quests,
        state,
        liveQuestState
      );
      const liveEntityHelperState = mergeLiveEntityHelperQuestStatesForBiomesUI(
        readLiveEntityHelperQuestState(),
        liveQuestState
      );
      return String(
        activeQuest?.title ??
          firstActiveJobsBoardQuestTitleForBiomesUI(jobsBoardState) ??
          firstActiveSnapshotRoadAheadQuestTitleForBiomesUI(
            readSnapshotMissionState(),
            roadAheadChallengeStepHints
          ) ??
          firstActiveLiveEntityHelperQuestTitleForBiomesUI(
            liveEntityHelperState
          ) ??
          firstActiveSharedQuestTitleForBiomesUI(liveQuestState) ??
          "Current Mission"
      );
    },
    getMissionSteps: () => {
      const api = readSnapshotGroveApi();
      const state = api?.readState?.();
      const quests = Array.isArray(api?.quests) ? api.quests : [];
      const activeQuest = activeSnapshotQuestForBiomesUI(
        quests,
        state,
        liveQuestState
      );
      const objectives = Array.isArray(activeQuest?.objectives)
        ? activeQuest.objectives
        : [];
      const liveObjectiveIndex = activeQuest?.id
        ? liveModeActiveQuestObjectiveIndex(liveQuestState, activeQuest.id)
        : undefined;
      const localObjectiveIndex = Number(state?.activeObjectiveIndex ?? 0);
      const activeObjectiveIndex =
        state?.activeQuestId === activeQuest?.id
          ? localObjectiveIndex
          : liveObjectiveIndex ?? localObjectiveIndex;
      const authoredSteps = activeQuest
        ? objectives.map((objective: string, index: number) => {
            return {
              id: `${activeQuest?.id ?? "quest"}:${index}`,
              title:
                index < activeObjectiveIndex
                  ? `Completed step ${index + 1}`
                  : index === activeObjectiveIndex
                  ? `Current step ${index + 1}`
                  : `Upcoming step ${index + 1}`,
              objective,
              done: index < activeObjectiveIndex,
            };
          })
        : [];
      const liveEntityHelperState = mergeLiveEntityHelperQuestStatesForBiomesUI(
        readLiveEntityHelperQuestState(),
        liveQuestState
      );
      const allSteps = [
        ...authoredSteps,
        ...activeJobsBoardMissionStepsForBiomesUI(jobsBoardState),
        ...snapshotRoadAheadMissionStepsForBiomesUI(
          readSnapshotMissionState(),
          roadAheadChallengeStepHints
        ),
        ...activeLiveEntityHelperMissionStepsForBiomesUI(
          liveEntityHelperState,
          { isReadyToTurnIn: liveEntityHelperQuestRecordReadyToTurnIn }
        ),
        ...activeSharedQuestMissionStepsForBiomesUI(liveQuestState),
      ];
      if (!activeQuest) {
        return allSteps;
      }
      return allSteps;
    },
    getTrackableQuests: () => {
      const api = readSnapshotGroveApi();
      const state = api?.readState?.();
      const quests = Array.isArray(api?.quests) ? api.quests : [];
      const activeQuest = activeSnapshotQuestForBiomesUI(
        quests,
        state,
        liveQuestState
      );
      const activeQuestId = activeQuest?.id;
      const accepted = questIds(state?.acceptedQuestIds);
      const liveActive = new Set(liveModeActiveQuestIds(liveQuestState));
      const completed = [
        ...questIds(state?.completedQuestIds),
        ...liveModeCompletedQuestIds(liveQuestState),
      ];
      const authoredQuests = quests
        .filter((quest: any) => quest && quest.id)
        .map((quest: any) => {
          const objectives = Array.isArray(quest.objectives)
            ? quest.objectives
                .map((objective: unknown) => String(objective ?? "").trim())
                .filter(Boolean)
            : [];
          const status = completed.includes(quest.id)
            ? ("completed" as const)
            : quest.id === activeQuestId ||
              accepted.includes(quest.id) ||
              liveActive.has(quest.id)
            ? ("active" as const)
            : ("available" as const);
          const liveObjectiveIndex = liveModeActiveQuestObjectiveIndex(
            liveQuestState,
            String(quest.id)
          );
          const localObjectiveIndex = Number(state?.activeObjectiveIndex ?? 0);
          const rawObjectiveIndex =
            state?.activeQuestId === quest.id
              ? localObjectiveIndex
              : liveObjectiveIndex ?? localObjectiveIndex;
          const objectiveIndex =
            status === "active" && quest.id === activeQuestId
              ? Math.max(
                  0,
                  Math.min(
                    objectives.length - 1,
                    Number.isFinite(rawObjectiveIndex) ? rawObjectiveIndex : 0
                  )
                )
              : 0;
          return {
            questId: String(quest.id),
            title: String(quest.title ?? quest.id),
            area: String(quest.area ?? "The Grove"),
            status,
            firstMarkerId:
              Array.isArray(quest.markerIds) && quest.markerIds.length
                ? normalizeMarkerId(
                    String(
                      quest.markerIds[objectiveIndex] ?? quest.markerIds[0]
                    )
                  )
                : undefined,
            reward: String(quest.reward ?? ""),
            kind: String(quest.category ?? "authored_grove_quest"),
            kindLabel: humanizeQuestKindLabel(quest.category),
            objective: objectives[objectiveIndex] ?? objectives[0],
            objectives,
            description:
              typeof quest.hook === "string" && quest.hook.trim()
                ? quest.hook.trim()
                : typeof quest.sampleDialogue === "string" &&
                  quest.sampleDialogue.trim()
                ? quest.sampleDialogue.trim()
                : undefined,
          };
        });
      return [
        ...jobsBoardTrackableQuestsForBiomesUI(
          jobsBoardState,
          Date.now(),
          harthmereJobToolOwnedState()
        ),
        ...snapshotRoadAheadTrackableQuestsForBiomesUI(
          readSnapshotMissionState(),
          roadAheadChallengeStepHints
        ),
        ...liveEntityHelperTrackableQuestsForBiomesUI(
          mergeLiveEntityHelperQuestStatesForBiomesUI(
            readLiveEntityHelperQuestState(),
            liveQuestState
          ),
          { isReadyToTurnIn: liveEntityHelperQuestRecordReadyToTurnIn }
        ),
        ...sharedQuestTrackableQuestsForBiomesUI(liveQuestState),
        // HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14): bible
        // catalog quests (Q1–Q12 main arc + side quests) the player has
        // accepted, mirrored server-side into quests.active with
        // source === "bible_catalog". Journal-only-started applies naturally:
        // only accepted quests carry the tag.
        ...bibleQuestTrackableQuestsForBiomesUI(liveQuestState ?? {}),
        // QUEST_JOURNAL_ONLY_STARTED: Only surface authored Snapshot Grove quests
        // the player has actually started (active) or finished (completed). The
        // full authored catalog is 100+ quests; listing every not-yet-started one
        // as "available" floods a brand-new player's journal. Available quests are
        // discovered in-world (NPCs/markers), not pre-listed in the journal.
        ...authoredQuests.filter(
          (quest: { status?: string }) => quest.status !== "available"
        ),
      ];
    },
    getMainQuestSelection: () => readBiomesUIMainQuestSelection(),
    setMainQuest: (quest: any) => setBiomesUIMainQuestFromTrackableQuest(quest),
    clearMainQuest: () => writeBiomesUIMainQuestSelection(undefined),
    getActiveMapPin: () => {
      const pin = readActiveBiomesUIMapPin();
      if (!pin) {
        return undefined;
      }
      // Drop a pin whose destination no longer exists as a landmark (quest/job
      // completed or abandoned) so the directional marker never points "to
      // nowhere". Reconcile against the full (pre-visibility-filter) landmark
      // set so a merely-hidden objective marker is not treated as stale.
      const visibleMarkerIds = MapLandmarks().map((landmark: any) =>
        String(landmark?.id ?? "")
      );
      if (shouldClearStaleActiveMapPin({ pin, visibleMarkerIds })) {
        writeActiveBiomesUIMapPin(undefined);
        return undefined;
      }
      return pin;
    },
    setActiveMapPin: (marker: any) => {
      const pin = activeBiomesUIMapPinFromMarkerForTest(marker);
      if (pin) writeActiveBiomesUIMapPin(pin);
    },
    clearActiveMapPin: () => writeActiveBiomesUIMapPin(undefined),
  };
}

export const buildBiomesUIMapAdapterForTest = buildBiomesUIMapAdapter;
