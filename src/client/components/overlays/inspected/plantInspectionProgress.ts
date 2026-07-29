import type { ReadonlyFarmingPlantComponent } from "@/shared/ecs/gen/components";
import type { FarmSpec } from "@/shared/game/farming";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function resolvedFarmSpec(
  spec: FarmSpec | undefined,
  variant: number | undefined
): Exclude<FarmSpec, { kind: "variant" }> | undefined {
  if (!spec) {
    return undefined;
  }
  if (spec.kind !== "variant") {
    return spec;
  }
  const index =
    variant !== undefined && variant >= 0 && variant < spec.variants.length
      ? variant
      : 0;
  return spec.variants[index]?.def;
}

export function plantGrowthStageDurationsMs(
  spec: FarmSpec | undefined,
  variant?: number
) {
  const resolved = resolvedFarmSpec(spec, variant);
  if (!resolved) {
    return [];
  }
  if (resolved.kind === "tree") {
    return resolved.stages.map((stage) => Math.max(0, stage.timeMs));
  }
  // Gaia's basic-plant ticker has a zero-time planted stage, two equal growth
  // stages, and a zero-time harvest stage.
  return [0, resolved.timeMs / 2, resolved.timeMs / 2, 0];
}

export function plantGrowthProgress(
  plant: ReadonlyFarmingPlantComponent | undefined,
  spec: FarmSpec | undefined
) {
  if (!plant) {
    return 0;
  }
  if (plant.status === "fully_grown") {
    return 1;
  }

  const durations = plantGrowthStageDurationsMs(spec, plant.variant);
  const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
  if (totalDuration <= 0) {
    return clamp01(plant.stage_progress);
  }

  const stage = Math.max(0, Math.floor(plant.stage));
  if (stage >= durations.length) {
    return 1;
  }
  const completedDuration = durations
    .slice(0, stage)
    .reduce((sum, duration) => sum + duration, 0);
  const currentDuration = durations[stage] ?? 0;
  return clamp01(
    (completedDuration + currentDuration * clamp01(plant.stage_progress)) /
      totalDuration
  );
}

export function plantWaterProgress(
  plant: Pick<ReadonlyFarmingPlantComponent, "water_level"> | undefined
) {
  return clamp01(plant?.water_level ?? 0);
}
