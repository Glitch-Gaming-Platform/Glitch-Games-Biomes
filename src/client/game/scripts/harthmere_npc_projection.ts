import type { CutscenePuppetOverride } from "@/shared/cutscene/puppets";
import type { ReadonlyVec3 } from "@/shared/math/types";

export interface HarthmereProjectedNpcPresentation {
  hidden: boolean;
  position?: ReadonlyVec3;
  label?: string;
  override?: CutscenePuppetOverride;
}

export interface HarthmereProjectedNpcCandidate<T> {
  entity: T;
  presentation: HarthmereProjectedNpcPresentation;
}

/**
 * Resolve the one player-visible presentation for a shared ECS NPC.
 *
 * Chapter One never moves the shared entity: its override is a per-player
 * projection. Every renderer, nameplate and interaction scan must therefore
 * use this same resolution or the body can appear at the story location while
 * Talk/name/combat state remains at the shared starter position.
 */
export function harthmereProjectedNpcPresentation(
  entityId: number,
  basePosition: ReadonlyVec3 | undefined,
  baseLabel: string | undefined,
  overrides: ReadonlyMap<number, CutscenePuppetOverride>
): HarthmereProjectedNpcPresentation {
  const override = overrides.get(entityId);
  return {
    hidden: override?.hidden === true,
    position: override?.at ?? basePosition,
    label: override?.label ?? baseLabel,
    override,
  };
}

/**
 * Merge ordinary spatial-query results with exact canonical entities whose
 * per-player projected position is inside the requested radius. The returned
 * list is unique by ECS id and excludes hidden/out-of-range presentations.
 */
export function harthmereProjectedNpcCandidates<
  T extends { id: number },
>(input: {
  nearby: readonly T[];
  projectedEntities: readonly T[];
  overrides: readonly CutscenePuppetOverride[];
  center: ReadonlyVec3;
  radius: number;
  basePosition: (entity: T) => ReadonlyVec3 | undefined;
  baseLabel?: (entity: T) => string | undefined;
}): HarthmereProjectedNpcCandidate<T>[] {
  const overrides = new Map(
    input.overrides
      .filter((override) => override.id > 0)
      .map((override) => [override.id, override] as const)
  );
  const entities = new Map<number, T>();
  for (const entity of input.nearby) {
    entities.set(Number(entity.id), entity);
  }
  for (const entity of input.projectedEntities) {
    entities.set(Number(entity.id), entity);
  }

  const result: HarthmereProjectedNpcCandidate<T>[] = [];
  for (const entity of entities.values()) {
    const presentation = harthmereProjectedNpcPresentation(
      Number(entity.id),
      input.basePosition(entity),
      input.baseLabel?.(entity),
      overrides
    );
    if (presentation.hidden || !presentation.position) {
      continue;
    }
    const dx = presentation.position[0] - input.center[0];
    const dy = presentation.position[1] - input.center[1];
    const dz = presentation.position[2] - input.center[2];
    if (Math.hypot(dx, dy, dz) > input.radius) {
      continue;
    }
    result.push({ entity, presentation });
  }
  return result;
}
