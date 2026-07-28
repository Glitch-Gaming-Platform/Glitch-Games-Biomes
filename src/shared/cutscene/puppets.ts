// HARTHMERE_CUTSCENE_PUPPETS
//
// Visual puppet layer for cutscenes, built on the live-creature ECS bridge:
// while a scene runs, the director registers per-entity overrides (position,
// yaw, animation) and ghost records (negative ids, no ECS entity). The bridge
// script merges them into its published records, so puppets render through
// the exact same mesh path as gameplay creatures — zero new render code.
//
// Anima interplay (clientPuppet mode): the server entity never moves; we only
// override what the renderer draws. When the scene releases an entity, the
// override disappears and the normal renderer smoothing converges back to the
// ECS-authoritative position. In serverShared mode the entity is
// ALSO moved via SetNPCPositionEvent, so there is nothing to snap.
//
// Pure core + window glue, same pattern as live_creature_ecs_bridge.ts.

import type { HarthmereLiveCreatureBridgeRecord } from "@/shared/harthmere/live_creature_ecs_bridge";

export interface CutscenePuppetOverride {
  /** Real (positive) entity id to override, or negative ghost id to add. */
  id: number;
  at?: [number, number, number];
  yaw: number;
  /** Per-player story projection may suppress a shared ECS body entirely. */
  hidden?: boolean;
  /** Per-player presented identity without mutating the shared ECS label. */
  label?: string;
  /** Best-effort animation hint for the renderer (e.g. "talkGesture"). */
  animation?: string;
  animationTime?: number;
  moving?: boolean;
  motionTime?: number;
  /** Native Bikkie item rendered in the actor's right hand. */
  itemId?: number;
  /** Only used for ghosts (records created from scratch). */
  ghost?: {
    asset: string;
    family: string;
    label: string;
  };
}

export function isGhostPuppetId(id: number): boolean {
  return id < 0;
}

/**
 * Merge cutscene overrides into the bridge records:
 *  - overrides for real entities replace that record's position/yaw;
 *  - ghost overrides append synthetic records;
 *  - everything else passes through untouched.
 * Ghosts never carry hp so they can never be targeted as combatants.
 */
export function mergeCutscenePuppetOverrides(
  base: ReadonlyArray<HarthmereLiveCreatureBridgeRecord>,
  overrides: ReadonlyArray<CutscenePuppetOverride>
): HarthmereLiveCreatureBridgeRecord[] {
  if (overrides.length === 0) {
    return [...base];
  }
  const byId = new Map<number, CutscenePuppetOverride>();
  for (const override of overrides) {
    byId.set(override.id, override);
  }
  const merged: HarthmereLiveCreatureBridgeRecord[] = base.flatMap((record) => {
    const override = byId.get(record.id);
    if (!override) {
      return [record];
    }
    byId.delete(record.id);
    if (override.hidden) return [];
    return [
      {
        ...record,
        ...(override.at
          ? { at: [...override.at] as [number, number, number] }
          : {}),
        yaw: override.yaw,
        ...(override.label ? { label: override.label } : {}),
        animation: override.animation,
        animationTime: override.animationTime,
        moving: override.moving,
        motionTime: override.motionTime,
        cinematic: true,
      },
    ];
  });
  for (const override of byId.values()) {
    if (!isGhostPuppetId(override.id) || !override.ghost || !override.at) {
      // Override for an entity that isn't currently rendered (despawned or
      // out of range): nothing to draw — drop it rather than invent a record
      // with a guessed asset.
      continue;
    }
    merged.push({
      id: override.id,
      at: [...override.at],
      yaw: override.yaw,
      family: override.ghost
        .family as HarthmereLiveCreatureBridgeRecord["family"],
      asset: override.ghost.asset,
      scale: 1,
      label: override.ghost.label,
      animation: override.animation,
      animationTime: override.animationTime,
      moving: override.moving,
      motionTime: override.motionTime,
      cinematic: true,
    });
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Window glue (guarded for tests / node).
// ---------------------------------------------------------------------------

export const CUTSCENE_PUPPET_BRIDGE_KEY = "__harthmereCutscenePuppets";
export const CHAPTER1_PUPPET_BRIDGE_KEY = "__harthmereChapter1Puppets";

type PuppetWindow = typeof globalThis & {
  __harthmereCutscenePuppets?: {
    at: number;
    overrides: CutscenePuppetOverride[];
  };
  __harthmereChapter1Puppets?: CutscenePuppetOverride[];
};

export function publishCutscenePuppetOverrides(
  overrides: CutscenePuppetOverride[]
): void {
  if (typeof window === "undefined") {
    return;
  }
  (window as PuppetWindow).__harthmereCutscenePuppets = {
    at: Date.now(),
    overrides,
  };
}

export function clearCutscenePuppetOverrides(): void {
  if (typeof window === "undefined") {
    return;
  }
  delete (window as PuppetWindow).__harthmereCutscenePuppets;
}

export function readCutscenePuppetOverrides(): CutscenePuppetOverride[] {
  if (typeof window === "undefined") {
    return [];
  }
  const bridge = (window as PuppetWindow).__harthmereCutscenePuppets;
  if (!bridge || !Array.isArray(bridge.overrides)) {
    return [];
  }
  // Stale guard: if the director stopped publishing (teardown, crash), the
  // overrides evaporate rather than freezing puppets forever.
  if (Number.isFinite(bridge.at) && Date.now() - bridge.at > 2_000) {
    return [];
  }
  return bridge.overrides;
}

export function publishChapter1PuppetOverrides(
  overrides: CutscenePuppetOverride[]
): void {
  if (typeof window === "undefined") return;
  (window as PuppetWindow).__harthmereChapter1Puppets = overrides;
}

export function clearChapter1PuppetOverrides(): void {
  if (typeof window === "undefined") return;
  delete (window as PuppetWindow).__harthmereChapter1Puppets;
}

export function readChapter1PuppetOverrides(): CutscenePuppetOverride[] {
  if (typeof window === "undefined") return [];
  const overrides = (window as PuppetWindow).__harthmereChapter1Puppets;
  return Array.isArray(overrides) ? overrides : [];
}

/** Persistent chapter staging first; active cutscene direction wins per id. */
export function readRenderablePuppetOverrides(): CutscenePuppetOverride[] {
  const byId = new Map<number, CutscenePuppetOverride>();
  for (const override of readChapter1PuppetOverrides()) {
    byId.set(override.id, override);
  }
  for (const override of readCutscenePuppetOverrides()) {
    byId.set(override.id, override);
  }
  return [...byId.values()];
}

export function chapter1PresentedNpcLabel(
  entityId: number,
  fallback: string
): string {
  return (
    readChapter1PuppetOverrides().find((entry) => entry.id === entityId)
      ?.label ?? fallback
  );
}
