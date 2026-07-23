import { harthmereLocalStorage } from "@/client/util/storage";
import type { BiomesId } from "@/shared/ids";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import type { MapTrackableQuest } from "@/client/components/biomes_ui/tabs/MapQuestsTab";
import type { NativeFarmingInterfaceModel } from "@/client/components/biomes_ui/adapters/nativeFarmingInterfaceAdapter";

export const HARTHMERE_BUY_HOE_QUEST_ID = "farming:buy-a-hoe";
export const HARTHMERE_HOE_VENDOR_MARKER_ID = "farming:orchard-produce-stand";
export const HARTHMERE_HOE_QUEST_EVENT = "harthmere:farming-hoe-quest";
export const HARTHMERE_HOE_VENDOR_AUTHORED_POSITION = [462, 53, -112] as const;
export const HARTHMERE_HOE_VENDOR_POSITION =
  shiftHarthmereAuthoredPositionToWorld(HARTHMERE_HOE_VENDOR_AUTHORED_POSITION);
export const HARTHMERE_NATIVE_CROP_MARKER_SOURCE = "native_farming_crop";
export const HARTHMERE_HOE_QUEST_MARKER_SOURCE = "farming_hoe_quest";

export type HarthmereHoeQuestState =
  | "loading"
  | "available"
  | "active"
  | "completed";

export interface HarthmereFarmingMapLandmark {
  id: string;
  label: string;
  kind: "crop" | "objective";
  position: readonly [number, number, number];
  description: string;
  source:
    | typeof HARTHMERE_NATIVE_CROP_MARKER_SOURCE
    | typeof HARTHMERE_HOE_QUEST_MARKER_SOURCE;
  active?: boolean;
}

function hoeQuestStorageKey(userId: BiomesId) {
  return `biomes.localDev.harthmere.farming.hoeQuest.${String(userId)}`;
}

function persistedHoeQuestState(
  value: string | null
): "active" | "completed" | undefined {
  return value === "active" || value === "completed" ? value : undefined;
}

export function readHarthmereHoeQuestState(
  userId: BiomesId
): HarthmereHoeQuestState {
  if (typeof window === "undefined") return "loading";
  try {
    return (
      persistedHoeQuestState(
        harthmereLocalStorage.getItem(hoeQuestStorageKey(userId))
      ) ?? "available"
    );
  } catch {
    return "available";
  }
}

function writeHarthmereHoeQuestState(
  userId: BiomesId,
  state: "active" | "completed"
) {
  try {
    harthmereLocalStorage.setItem(hoeQuestStorageKey(userId), state);
  } catch {
    // The quest remains playable for this session even if browser storage is
    // unavailable. The layered Harthmere storage handles its own fallbacks.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(HARTHMERE_HOE_QUEST_EVENT, {
        detail: { userId: String(userId), state },
      })
    );
  }
  return state;
}

export function acceptHarthmereHoeQuest(
  userId: BiomesId
): HarthmereHoeQuestState {
  const current = readHarthmereHoeQuestState(userId);
  if (current === "completed") return current;
  return writeHarthmereHoeQuestState(userId, "active");
}

export function resetHarthmereHoeQuestForTest(
  userId: BiomesId
): HarthmereHoeQuestState {
  try {
    harthmereLocalStorage.removeItem(hoeQuestStorageKey(userId));
  } catch {
    // Test-only cleanup remains best effort in blocked-storage environments.
  }
  return "available";
}

export function reconcileHarthmereHoeQuestState(
  userId: BiomesId,
  hasHoe: boolean
): HarthmereHoeQuestState {
  const current = readHarthmereHoeQuestState(userId);
  if (current === "completed") return current;
  // Obtaining a hoe permanently completes the one-time guide. This also marks
  // players who already owned one before the feature shipped, so losing or
  // moving the tool later cannot make the onboarding quest reappear.
  if (hasHoe) return writeHarthmereHoeQuestState(userId, "completed");
  return current === "loading" ? "available" : current;
}

export function harthmereNativeCropMapLandmarks(
  model: NativeFarmingInterfaceModel | undefined
): HarthmereFarmingMapLandmark[] {
  return (model?.plants ?? []).map((plant) => ({
    id: `farming:crop:${String(plant.id)}`,
    label: plant.name,
    kind: "crop" as const,
    position: plant.position,
    description:
      plant.status === "fully_grown"
        ? "Your crop is ready to harvest."
        : plant.status === "halted_water"
        ? "Your crop is dry and needs water."
        : `Your planted crop is at stage ${plant.stage + 1}.`,
    source: HARTHMERE_NATIVE_CROP_MARKER_SOURCE,
  }));
}

export function harthmereHoeQuestMapLandmarks(
  state: HarthmereHoeQuestState
): HarthmereFarmingMapLandmark[] {
  if (state !== "active") return [];
  return [
    {
      id: HARTHMERE_HOE_VENDOR_MARKER_ID,
      label: "Orchard Produce Stand",
      kind: "objective",
      position: HARTHMERE_HOE_VENDOR_POSITION,
      description:
        "Buy a Hoe for 22 gold from Apple Picker Ren at the Orchard Produce Stand.",
      source: HARTHMERE_HOE_QUEST_MARKER_SOURCE,
      active: true,
    },
  ];
}

export function harthmereHoeQuestTrackableQuests(
  state: HarthmereHoeQuestState
): MapTrackableQuest[] {
  if (state !== "active") return [];
  return [
    {
      questId: HARTHMERE_BUY_HOE_QUEST_ID,
      title: "Buy A Hoe",
      area: "Orchard",
      status: "active",
      firstMarkerId: HARTHMERE_HOE_VENDOR_MARKER_ID,
      kind: "farming_tutorial",
      kindLabel: "Farming Tutorial",
      objective: "Buy a Hoe from the Orchard Produce Stand.",
      objectives: ["Buy a Hoe from the Orchard Produce Stand."],
      description:
        "A hoe lets you till dirt or grass voxels into farmland before planting seeds.",
      toolSource: {
        action: "buy",
        toolName: "Hoe",
        vendorName: "Orchard Produce Stand",
        vendorMarkerId: HARTHMERE_HOE_VENDOR_MARKER_ID,
        hint: "Apple Picker Ren sells a Hoe for 22 gold in the Orchard.",
      },
    },
  ];
}
