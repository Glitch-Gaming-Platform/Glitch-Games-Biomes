import type {
  NavigationAidKind,
  NavigationAidSpec,
} from "@/client/game/helpers/navigation_aids";
import { isCh1NativeQuestId } from "@/shared/harthmere/ch1_native_quests";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";
import { harthmereJobsBoardFieldTargetsNearPosition } from "@/shared/harthmere/jobs_board_field_targets";
import { HARTHMERE_WORLD_OBJECT_ACTIVE_PIN_MATCH_RADIUS } from "@/shared/harthmere/harthmere_world_object_inspectable";
import { groveNativeQuestId } from "@/shared/harthmere/grove/grove_quest_ids";
import { linearMainStoryProgressOrderForTest } from "./mainQuestSelection";

export const BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY = "biomes_ui_active_map_pin";
export const BIOMES_UI_ACTIVE_MAP_PIN_EVENT = "biomes-ui-active-map-pin";
export const BIOMES_UI_ACTIVE_MAP_PIN_NAV_AID_ID = 14_200_147;
const SNAPSHOT_GROVE_QUEST_STATE_STORAGE_KEY =
  "biomes.localDev.snapshotGroveQuestState";

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
  /** Exact rendered prop behind a synthetic quest/todo marker. */
  worldObjectId?: string;
  /** Exact interaction candidate when it differs from the rendered prop id. */
  interactionTargetId?: string;
  setAtMs: number;
}

export type BiomesUIMapPinWriteSource = "automatic" | "user";

export interface BiomesUIMapPinWriteOptions {
  source?: BiomesUIMapPinWriteSource;
}

export type BiomesUIMapPinWriteResult =
  | {
      ok: true;
      persisted: boolean;
      message?: string;
    }
  | {
      ok: false;
      reason: "invalid_destination" | "automatic_destination_protected";
      message: string;
    };

// Sandboxed/cross-origin embeds can deny localStorage even after the game has
// already loaded. Keep the accepted pin in memory so adapter refreshes do not
// immediately replace the user's choice with the last persisted value.
let volatileActiveMapPinOverride:
  { pin: BiomesUIActiveMapPin | undefined } | undefined;

export function resetActiveBiomesUIMapPinVolatileStateForTest() {
  volatileActiveMapPinOverride = undefined;
}

export function shouldPreserveExactChapter1RoutePinForTest(input: {
  current:
    | Pick<BiomesUIActiveMapPin, "markerId" | "ownerQuestId" | "ownerStepId">
    | undefined;
  next:
    | Pick<BiomesUIActiveMapPin, "markerId" | "ownerQuestId" | "ownerStepId">
    | undefined;
}) {
  return Boolean(
    input.current?.markerId.startsWith("chapter1_route:") &&
    input.next?.markerId.startsWith("native_quest:") &&
    input.current.ownerQuestId &&
    input.current.ownerQuestId === input.next.ownerQuestId &&
    input.current.ownerStepId &&
    input.current.ownerStepId === input.next.ownerStepId
  );
}

export function shouldPreserveExactGroveRoutePinForTest(input: {
  current:
    | Pick<BiomesUIActiveMapPin, "markerId" | "ownerQuestId" | "ownerStepId">
    | undefined;
  nextQuestId: string | undefined;
}) {
  const ownerQuestId = String(input.current?.ownerQuestId ?? "").trim();
  const nativeOwnerQuestId = ownerQuestId
    ? groveNativeQuestId(ownerQuestId)
    : undefined;
  return Boolean(
    input.current?.ownerStepId &&
    !input.current.markerId.startsWith("native_quest:") &&
    nativeOwnerQuestId !== undefined &&
    Boolean(String(input.nextQuestId ?? "").trim())
  );
}

export function shouldBlockNativeQuestPinDuringGroveQuestForTest(input: {
  nextMarkerId: string | undefined;
  activeGroveQuestId: string | undefined;
}) {
  return Boolean(
    String(input.nextMarkerId ?? "").startsWith("native_quest:") &&
    input.activeGroveQuestId &&
    groveNativeQuestId(input.activeGroveQuestId) !== undefined
  );
}

function activeSnapshotGroveQuestIdFromStorage(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage?.getItem(
      SNAPSHOT_GROVE_QUEST_STATE_STORAGE_KEY
    );
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as {
      activeQuestId?: unknown;
      completedQuestIds?: unknown;
    };
    const questId = String(parsed.activeQuestId ?? "").trim();
    const completed = Array.isArray(parsed.completedQuestIds)
      ? parsed.completedQuestIds.map(String)
      : [];
    return questId && !completed.includes(questId) ? questId : undefined;
  } catch {
    return undefined;
  }
}

export interface BiomesUIMapPinSourceMarker {
  id: string;
  label: string;
  kind: string;
  worldPosition?: [number, number, number];
  description?: string;
  ownerQuestId?: string;
  ownerStepId?: string;
  worldObjectId?: string;
  interactionTargetId?: string;
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
    "markerId" | "label" | "worldPosition" | "ownerQuestId" | "ownerStepId"
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
  // A multi-person Chapter 1 step publishes its exact authenticated route stop
  // under this marker family. The generic native trigger remains unchanged
  // while Rin -> Fern -> Gus (or testimony/answer routes) advances, so the
  // automatic quest anchor must not overwrite the more precise destination.
  if (
    existingMarkerId.startsWith("chapter1_route:") &&
    input.existingPin?.ownerQuestId === input.quest.questId &&
    input.existingPin?.ownerStepId === input.quest.currentStepId
  ) {
    return undefined;
  }
  if (
    shouldPreserveExactGroveRoutePinForTest({
      current: input.existingPin,
      nextQuestId: input.quest.questId,
    })
  ) {
    // Grove publishes an exact landmark id/position for its authored step.
    // The native challenge projection also exposes a quest-level fallback,
    // but that fallback can say "Talk to Jackie" while the real current step
    // is a paint flag, charter board, sample, or practice dummy. Keep the more
    // precise Grove-owned route until that quest completes or Grove advances
    // it itself.
    return undefined;
  }
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
  const nativeOwnerQuestId = groveNativeQuestId(ownerQuestId);
  const owner = input.quests.find(
    (quest) =>
      quest.status === "active" &&
      (quest.questId === ownerQuestId ||
        (nativeOwnerQuestId !== undefined &&
          quest.questId === String(nativeOwnerQuestId)))
  );
  if (!owner) return true;
  if (nativeOwnerQuestId !== undefined) {
    // Native Grove projections do not preserve the authored step id used by
    // the exact Grove pin. The Grove runtime owns objective handoffs; the
    // generic native adapter should only clear this pin when the quest is no
    // longer active.
    return false;
  }
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
  const physicalFieldTarget = harthmereJobsBoardFieldTargetsNearPosition(
    resolvedWorldPosition,
    HARTHMERE_WORLD_OBJECT_ACTIVE_PIN_MATCH_RADIUS
  )[0];
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
    worldObjectId:
      typeof marker.worldObjectId === "string" && marker.worldObjectId.trim()
        ? marker.worldObjectId.trim()
        : physicalFieldTarget?.mapMarkerId,
    interactionTargetId:
      typeof marker.interactionTargetId === "string" &&
      marker.interactionTargetId.trim()
        ? marker.interactionTargetId.trim()
        : physicalFieldTarget?.targetId,
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
        worldObjectId: parsed.worldObjectId,
        interactionTargetId: parsed.interactionTargetId,
      },
      Number(parsed.setAtMs) || Date.now()
    );
  } catch {
    return undefined;
  }
}

export function readActiveBiomesUIMapPin(): BiomesUIActiveMapPin | undefined {
  if (typeof window === "undefined") return undefined;
  if (volatileActiveMapPinOverride) {
    return volatileActiveMapPinOverride.pin;
  }
  try {
    return parseActiveBiomesUIMapPin(
      window.localStorage?.getItem(BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY) ?? null
    );
  } catch {
    return undefined;
  }
}

export function writeActiveBiomesUIMapPin(
  pin: BiomesUIActiveMapPin | undefined,
  options: BiomesUIMapPinWriteOptions = {}
): BiomesUIMapPinWriteResult {
  if (typeof window === "undefined") {
    return {
      ok: false,
      reason: "invalid_destination",
      message:
        "Map destinations are unavailable until the game finishes loading.",
    };
  }
  const current = readActiveBiomesUIMapPin();
  const nextNativeQuestId = /^native_quest:([^:]+):/.exec(
    String(pin?.markerId ?? "")
  )?.[1];
  const protectedAutomaticDestination =
    shouldPreserveExactChapter1RoutePinForTest({
      current,
      next: pin,
    }) ||
    shouldPreserveExactGroveRoutePinForTest({
      current,
      nextQuestId: nextNativeQuestId,
    }) ||
    shouldBlockNativeQuestPinDuringGroveQuestForTest({
      nextMarkerId: pin?.markerId,
      activeGroveQuestId: activeSnapshotGroveQuestIdFromStorage(),
    });
  if (options.source !== "user" && protectedAutomaticDestination) {
    return {
      ok: false,
      reason: "automatic_destination_protected",
      message:
        "Kept your current destination because a background quest update tried to replace it.",
    };
  }
  let persisted = true;
  try {
    const storage = window.localStorage;
    if (!storage) {
      throw new Error("localStorage unavailable");
    }
    if (pin) {
      storage.setItem(
        BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY,
        JSON.stringify(pin)
      );
    } else {
      storage.removeItem(BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY);
    }
    volatileActiveMapPinOverride = undefined;
  } catch {
    persisted = false;
    volatileActiveMapPinOverride = { pin };
  }
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_ACTIVE_MAP_PIN_EVENT, { detail: pin })
  );
  if (!persisted) {
    return {
      ok: true,
      persisted: false,
      message: pin
        ? "Destination set for this session, but your browser blocked map storage. It may reset when you reload."
        : "Destination cleared for this session, but your browser blocked map storage. It may return when you reload.",
    };
  }
  return { ok: true, persisted: true };
}

// BIOMES_UI_LOCATE_ON_MAP:
// "Locate on map" entry point. Persists the destination pin (so the nav aid /
// minimap arrow appear as before) AND asks the UI to open the Map tab and center
// on it. Used by the Land/Property panels' "Locate on map" buttons.
export function requestBiomesUILocateOnMap(
  pin: BiomesUIActiveMapPin
): BiomesUIMapPinWriteResult {
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
  if (!normalized) {
    return {
      ok: false,
      reason: "invalid_destination",
      message: "This destination does not have a valid map location yet.",
    };
  }
  const result = writeActiveBiomesUIMapPin(normalized, { source: "user" });
  if (!result.ok || typeof window === "undefined") return result;
  window.dispatchEvent(
    new CustomEvent(BIOMES_UI_LOCATE_ON_MAP_EVENT, { detail: normalized })
  );
  return result;
}
