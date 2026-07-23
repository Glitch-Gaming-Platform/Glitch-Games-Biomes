import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import { anItem } from "@/shared/game/item";
import { dist } from "@/shared/math/linear";
import type { ReadonlyVec3 } from "@/shared/math/types";

const HARTHMERE_WATERING_CAN_ID = 7539420629350045;
const HARTHMERE_HOE_ID = 7539420629350046;

export interface NativeFarmingSupply {
  itemId: string;
  name: string;
  count: number;
  kind: "seed" | "hoe" | "watering_can";
}

export interface NativeFarmingPlantView {
  id: BiomesId;
  name: string;
  seedId: BiomesId;
  status: string;
  stage: number;
  stageProgress: number;
  waterLevel: number;
  wilt: number;
  position: readonly [number, number, number];
  distance: number;
  ownedByPlayer: boolean;
  fullyGrownAt?: number;
  waterAt?: number;
}

export interface NativeFarmingInterfaceModel {
  supplies: NativeFarmingSupply[];
  plants: NativeFarmingPlantView[];
  seedCount: number;
  hasHoe: boolean;
  hasWateringCan: boolean;
}

function numericCount(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function inventoryStacks(inventory: any): any[] {
  const overflow = inventory?.overflow;
  return [
    ...(Array.isArray(inventory?.items) ? inventory.items : []),
    ...(Array.isArray(inventory?.hotbar) ? inventory.hotbar : []),
    ...(overflow instanceof Map
      ? [...overflow.values()]
      : Array.isArray(overflow)
      ? overflow
      : Object.values(overflow ?? {})),
  ].filter(Boolean);
}

function readableItemName(itemId: BiomesId, fallback: string) {
  const name = anItem(itemId)?.displayName;
  return name && name !== "???" ? name : fallback;
}

function supplyKind(item: any): NativeFarmingSupply["kind"] | undefined {
  const id = Number(item?.id);
  if (item?.isSeed || item?.action === "plant") return "seed";
  if (item?.action === "till" || id === HARTHMERE_HOE_ID) return "hoe";
  if (
    item?.action === "waterPlant" ||
    (item?.waterAmount ?? 0) > 0 ||
    id === HARTHMERE_WATERING_CAN_ID
  ) {
    return "watering_can";
  }
  return undefined;
}

export function buildNativeFarmingInterfaceModel(input: {
  userId: BiomesId;
  inventory: any;
  entities: Iterable<ReadonlyEntity>;
  playerPosition?: ReadonlyVec3;
}): NativeFarmingInterfaceModel {
  const suppliesById = new Map<string, NativeFarmingSupply>();
  for (const stack of inventoryStacks(input.inventory)) {
    const item = stack?.item;
    if (!item) continue;
    const kind = supplyKind(item);
    if (!kind) continue;
    const itemId = String(item.id);
    const fallback =
      kind === "hoe"
        ? "Hoe"
        : kind === "watering_can"
        ? "Watering Can"
        : "Seed";
    const current = suppliesById.get(itemId);
    suppliesById.set(itemId, {
      itemId,
      name: readableItemName(item.id, fallback),
      count: (current?.count ?? 0) + numericCount(stack.count ?? 1),
      kind,
    });
  }

  const plants: NativeFarmingPlantView[] = [];
  for (const entity of input.entities) {
    const plant = entity.farming_plant_component;
    const position = entity.position?.v;
    if (!plant || !position) continue;
    const distance = input.playerPosition
      ? dist(input.playerPosition, position)
      : Number.POSITIVE_INFINITY;
    const ownedByPlayer = plant.planter === input.userId;
    // The farming journal and crop map are personal views. Nearby plants still
    // exist in the native ECS world, but another player's field must never be
    // projected into this player's UI.
    if (!ownedByPlayer) continue;
    plants.push({
      id: entity.id,
      name: readableItemName(plant.seed, "Crop"),
      seedId: plant.seed,
      status: plant.status,
      stage: plant.stage,
      stageProgress: Math.max(0, Math.min(1, plant.stage_progress)),
      waterLevel: Math.max(0, Math.min(1, plant.water_level)),
      wilt: Math.max(0, Math.min(1, plant.wilt)),
      position: [position[0], position[1], position[2]],
      distance,
      ownedByPlayer,
      fullyGrownAt: plant.fully_grown_at,
      waterAt: plant.water_at,
    });
  }
  plants.sort(
    (a, b) =>
      Number(b.ownedByPlayer) - Number(a.ownedByPlayer) ||
      a.distance - b.distance
  );

  const supplies = [...suppliesById.values()].sort(
    (a, b) =>
      (({ hoe: 0, watering_can: 1, seed: 2 }[a.kind] ?? 3) -
        ({ hoe: 0, watering_can: 1, seed: 2 }[b.kind] ?? 3) ||
      a.name.localeCompare(b.name))
  );
  return {
    supplies,
    plants,
    seedCount: supplies
      .filter((supply) => supply.kind === "seed")
      .reduce((sum, supply) => sum + supply.count, 0),
    hasHoe: supplies.some((supply) => supply.kind === "hoe"),
    hasWateringCan: supplies.some((supply) => supply.kind === "watering_can"),
  };
}
