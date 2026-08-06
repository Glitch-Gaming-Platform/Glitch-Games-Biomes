import type {
  NavigationAidKind,
  NavigationAidSpec,
} from "@/client/game/helpers/navigation_aids";
import { isCh1NativeQuestId } from "@/shared/harthmere/ch1_native_quests";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";
import { linearMainStoryProgressOrderForTest } from "./mainQuestSelection";

export const BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY = "biomes_ui_active_map_pin";
export const BIOMES_UI_ACTIVE_MAP_PIN_EVENT = "biomes-ui-active-map-pin";
export const BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID = 14_200_147;

// BIOMES_UI_LOCATE_ON_MAP:
// "Locate on map" should do more than drop a pin — it should open the Map tab
// and center the map on the target. This event carries that intent: BiomesUIMount
// switches to the Map tab, and the Map tab centers on the pin. A short recency
// window lets the Map tab center even if it mounts just after the event fired
// (the tab-switch and the listener attach are not perfectly ordered).
export const BIOMES_UI_LOCATE_ON_MAP_EVENT = "biomes-ui-locate-on-map";
export const BIOMES_UI_LOCATE_ON_MAP_RECENCY_MS = 12_000;

export interface BiomesUIActiveMapPin {
  markerId: string;
  label: string;
  kind: string;
  worldPosition: [number, number, number];
  description?: string;
  ownerQuestId?: string;
  ownerStepId?: string;
  setAtMs: number;
}

export interface BiomesUIMapPinSourceMarker {
  id: string;
  label: string;
  kind: string;
  worldPosition?: [number, number, number];
  description?: string;
  ownerQuestId?: string;
  ownerStepId?: string;
}

export interface BiomesUIAutoDestinationQuest {
  questId: string;
  status: string;
  firstMarkerId?: string;
  currentStepId?: string;
}

/**
 * Advance story guidance without stealing a destination the player deliberately
 * selected. Native quest steps can synthesize a marker even when the original
 * Bikkie leaf had no navigation aid; promoting that marker to the active pin is
 * what makes it appear on the HUD minimap and directional overlay.
 */
export function automaticQuestDestinationMarkerForTest(input: {
  existingPin?: Pick<
    BiomesUIActiveMapPin,
    | "markerId"
    | "label"
    | "worldPosition"
    | "ownerQuestId"
    | "ownerStepId"
  >;
  quest?: BiomesUIAutoDestinationQuest;
  markers: readonly BiomesUIMapPinSourceMarker[];
}): BiomesUIMapPinSourceMarker | undefined {
  const markerId = String(input.quest?.firstMarkerId ?? "").trim();
  if (input.quest?.status !== "active" || !markerId) {
    return undefined;
  }
  const marker = input.markers.find((candidate) => candidate.id === markerId);
  if (!marker || !finiteWorldPosition(marker.worldPosition)) {
    return undefined;
  }
  const questOwnedMarker: BiomesUIMapPinSourceMarker = {
    ...marker,
    ownerQuestId: input.quest.questId,
    ownerStepId: input.quest.currentStepId,
  };
  const existingMarkerId = String(input.existingPin?.markerId ?? "").trim();
  if (existingMarkerId === markerId) {
    // Quest-level fallback anchors intentionally reuse
    // native_quest:<questId>:<questId> while their label and destination move
    // with the active leaf. Refresh the persisted pin at that handoff; merely
    // comparing marker ids left the HUD pointing at the previous objective
    // (for example Cross the Dunes after the story had reached Salt Market).
    const objectiveChanged = Boolean(
      input.quest.currentStepId &&
        input.existingPin?.ownerStepId !== input.quest.currentStepId
    );
    const labelChanged =
      String(input.existingPin?.label ?? "").trim() !==
      String(marker.label ?? "").trim();
    const existingPosition = finiteWorldPosition(
      input.existingPin?.worldPosition
    );
    const markerPosition = finiteWorldPosition(marker.worldPosition);
    // Native fallback anchors can first resolve to the actor's current
    // position, then asynchronously acquire the real NPC/position aid. Their
    // marker id, label, and objective stay identical, so position drift must
    // also refresh the persisted destination. Compare X/Z only because the
    // active pin may be collision-grounded below an authored marker's Y.
    const destinationChanged = Boolean(
      existingPosition &&
        markerPosition &&
        Math.hypot(
          existingPosition[0] - markerPosition[0],
          existingPosition[2] - markerPosition[2]
        ) >= 1
    );
    return objectiveChanged || labelChanged || destinationChanged
      ? questOwnedMarker
      : undefined;
  }
  if (!existingMarkerId) {
    return questOwnedMarker;
  }

  // A material-source pin selected from a quest is manual only for that
  // objective. Once the objective or quest advances it must yield to the next
  // authored story marker; otherwise a vendor/store can remain on the
  // minimap forever while the HUD correctly names the next Chapter 1 step.
  const existingBelongsToPriorQuestObjective = Boolean(
    input.existingPin?.ownerQuestId &&
    (input.existingPin.ownerQuestId !== input.quest.questId ||
      (input.existingPin.ownerStepId &&
        input.quest.currentStepId &&
        input.existingPin.ownerStepId !== input.quest.currentStepId))
  );

  const existingIsEarlierStepOfQuest = existingMarkerId.startsWith(
    `native_quest:${input.quest.questId}:`
  );
  const existingQuestId = /^native_quest:([^:]+):/.exec(existingMarkerId)?.[1];
  const existingStoryOrder = existingQuestId
    ? linearMainStoryProgressOrderForTest(existingQuestId)
    : -1;
  const nextStoryOrder = linearMainStoryProgressOrderForTest(
    input.quest.questId
  );
  const existingIsPreviousStoryChapter =
    existingStoryOrder >= 0 &&
    nextStoryOrder >= 0 &&
    existingStoryOrder < nextStoryOrder;
  // Chapter 1 is a tightly sequenced story. At an objective handoff, stale
  // side-quest/store pins must not continue pointing somewhere unrelated while
  // the HUD names the new story destination. This effect only runs when the
  // native quest projection changes, so a destination the player deliberately
  // chooses afterward remains in place until the next Chapter 1 handoff.
  const chapter1StoryHandoff = isCh1NativeQuestId(input.quest.questId);
  return chapter1StoryHandoff ||
    existingBelongsToPriorQuestObjective ||
    existingIsEarlierStepOfQuest ||
    existingIsPreviousStoryChapter
    ? questOwnedMarker
    : undefined;
}

export function shouldClearOwnedQuestMapPinForTest(input: {
  pin: Pick<BiomesUIActiveMapPin, "ownerQuestId" | "ownerStepId"> | undefined;
  quests: readonly BiomesUIAutoDestinationQuest[];
}): boolean {
  const ownerQuestId = String(input.pin?.ownerQuestId ?? "").trim();
  if (!ownerQuestId) return false;
  const owner = input.quests.find(
    (quest) => quest.questId === ownerQuestId && quest.status === "active"
  );
  if (!owner) return true;
  const ownerStepId = String(input.pin?.ownerStepId ?? "").trim();
  return Boolean(
    ownerStepId && owner.currentStepId && ownerStepId !== owner.currentStepId
  );
}

function finiteWorldPosition(
  position: BiomesUIMapPinSourceMarker["worldPosition"]
): [number, number, number] | undefined {
  if (!Array.isArray(position) || position.length < 3) {
    return undefined;
  }
  const x = Number(position[0]);
  const y = Number(position[1]);
  const z = Number(position[2]);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [x, y, z]
    : undefined;
}

export function biomesUIActiveMapPinNavigationAidKindForTest(
  _markerKind: string
): NavigationAidKind {
  // A user-set active map pin is always a non-quest "map_pin" navigation aid so
  // its directional indicator (on-circle arrow + on-screen precision overlay)
  // renders even when the player is NOT tracking a quest. Previously every kind
  // mapped to a QuestCategory, which suppressed the arrow unless a quest was
  // being tracked -- the core "set destination -> see the way there" feature.
  return "map_pin";
}

export function biomesUIActiveMapPinNavigationAidSpecForTest(
  pin: BiomesUIActiveMapPin | undefined
): NavigationAidSpec | undefined {
  const worldPosition = finiteWorldPosition(pin?.worldPosition);
  if (!pin || !worldPosition) {
    return undefined;
  }
  return {
    target: {
      kind: "position",
      position: worldPosition,
    },
    kind: biomesUIActiveMapPinNavigationAidKindForTest(pin.kind),
    autoremoveWhenNear: false,
  };
}

export function activeBiomesUIMapPinFromMarkerForTest(
  marker: BiomesUIMapPinSourceMarker,
  nowMs = Date.now()
): BiomesUIActiveMapPin | undefined {
  const worldPosition = finiteWorldPosition(marker.worldPosition);
  const markerId = String(marker.id ?? "").trim();
  const label = String(marker.label ?? "").trim();
  if (!markerId || !label || !worldPosition) {
    return undefined;
  }
  const resolvedWorldPosition = resolveHarthmereProductionMarkerPosition({
    markerId,
    fallback: worldPosition,
  }) as [number, number, number];
  return {
    markerId,
    label,
    kind: String(marker.kind ?? "objective"),
    worldPosition: resolvedWorldPosition,
    description:
      typeof marker.description === "string" && marker.description.trim()
        ? marker.description.trim()
        : undefined,
    ownerQuestId:
      typeof marker.ownerQuestId === "string" && marker.ownerQuestId.trim()
        ? marker.ownerQuestId.trim()
        : undefined,
    ownerStepId:
      typeof marker.ownerStepId === "string" && marker.ownerStepId.trim()
        ? marker.ownerStepId.trim()
        : undefined,
    setAtMs: nowMs,
  };
}

// HARTHMERE active-pin staleness
// The active map pin persists in localStorage with no quest linkage, so a pin
// set for a quest/job that is later completed or abandoned would keep showing a
// directional marker "to nowhere". This decides when to drop a stale pin:
// only when the destination is gone from a POPULATED landmark set. An empty set
// means the map data has not hydrated yet, so we never clear in that case
// (which would wrongly nuke a still-valid pin during loading).
export function shouldClearStaleActiveMapPin(input: {
  pin:
    | {
        markerId: string;
        ownerQuestId?: string;
        ownerStepId?: string;
        worldPosition?: [number, number, number];
      }
    | undefined;
  visibleMarkerIds: readonly string[];
}): boolean {
  if (!input.pin) {
    return false;
  }
  if (input.visibleMarkerIds.length === 0) {
    return false;
  }
  // Material guidance deliberately creates coordinate pins for resources,
  // vendors, and crafting stations that are not always members of the static
  // map-landmark registry. The owning quest/step lifecycle clears these pins
  // when the objective advances; deleting them merely because their marker is
  // synthetic made "Show on map" appear to do nothing.
  if (
    finiteWorldPosition(input.pin.worldPosition) &&
    (Boolean(input.pin.ownerQuestId) ||
      /^(?:material_source|building_material_source):/.test(input.pin.markerId))
  ) {
    return false;
  }
  return !input.visibleMarkerIds.includes(input.pin.markerId);
}

function parseActiveBiomesUIMapPin(
  value: string | null
): BiomesUIActiveMapPin | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as BiomesUIActiveMapPin;
    return activeBiomesUIMapPinFromMarkerForTest(
      {
        id: parsed.markerId,
        label: parsed.label,
        kind: parsed.kind,
        worldPosition: parsed.worldPosition,
        description: parsed.description,
        ownerQuestId: parsed.ownerQuestId,
        ownerStepId: parsed.ownerStepId,
      },
      Number(parsed.setAtMs) || Date.now()
    );
  } catch {
    return undefined;
  }
}

export function readActiveBiomesUIMapPin(): BiomesUIActiveMapPin | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return parseActiveBiomesUIMapPin(
      window.localStorage?.getItem(BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY) ?? null
    );
  } catch {
    return undefined;
  }
}

export function writeActiveBiomesUIMapPin(
  pin: BiomesUIActiveMapPin | undefined
): void {
  if (typeof window === "undefined") return;
  try {
    if (pin) {
      window.localStorage?.setItem(
        BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY,
        JSON.stringify(pin)
      );
    } else {
      window.localStorage?.removeItem(BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY);
    }
  } catch {
    // The map still updates in-memory when storage is unavailable.
  }
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_ACTIVE_MAP_PIN_EVENT, { detail: pin })
  );
}

// BIOMES_UI_LOCATE_ON_MAP:
// "Locate on map" entry point. Persists the destination pin (so the nav aid /
// minimap arrow appear as before) AND asks the UI to open the Map tab and center
// on it. Used by the Land/Property panels' "Locate on map" buttons.
export function requestBiomesUILocateOnMap(pin: BiomesUIActiveMapPin): void {
  const normalized = activeBiomesUIMapPinFromMarkerForTest(
    {
      id: pin.markerId,
      label: pin.label,
      kind: pin.kind,
      worldPosition: pin.worldPosition,
      description: pin.description,
      ownerQuestId: pin.ownerQuestId,
      ownerStepId: pin.ownerStepId,
    },
    pin.setAtMs
  );
  if (!normalized) return;
  writeActiveBiomesUIMapPin(normalized);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_LOCATE_ON_MAP_EVENT, { detail: normalized })
  );
}
