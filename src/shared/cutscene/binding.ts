// HARTHMERE_CUTSCENE_BINDING
//
// Cast resolution: turn declarative RoleBindings into concrete actors against
// a structural view of the world (so it's testable with plain objects and
// adaptable to the ECS table, the live-creature bridge, or both).
//
// Fallback chain per role:
//   exact binding -> role.fallback ("ghost" stand-in | "skipActions")
//   -> if required and nothing resolved: cancel the scene gracefully.

import type {
  CutsceneDef,
  CutsceneRole,
  CutsceneVec3,
} from "@/shared/cutscene/schema";
import { v3dist } from "@/shared/cutscene/math";

/** Structural entity view (subset of ECS components the binder needs). */
export interface CutsceneEntityView {
  id: number;
  label?: string;
  position?: CutsceneVec3;
  orientation?: [number, number];
  npcTypeId?: number; // Bikkie biscuit id from npc_metadata.type_id
  height?: number;
  alive?: boolean;
  isNpc?: boolean;
}

export interface CutsceneWorldIndex {
  playerId: number;
  playerPosition: CutsceneVec3;
  playerHeight?: number;
  entity(id: number): CutsceneEntityView | undefined;
  /** All live NPC-ish entities near a position (already coarse-filtered). */
  npcsNear(position: CutsceneVec3, radius: number): CutsceneEntityView[];
}

export type ResolvedActor =
  | {
      kind: "player";
      role: string;
      entityId: number;
      height: number;
    }
  | {
      kind: "entity";
      role: string;
      entityId: number;
      height: number;
      isNpc: boolean;
    }
  | {
      kind: "ghost";
      role: string;
      // Ghost ids are negative and unique per scene instance so they can ride
      // the live-creature bridge without ever colliding with real ECS ids.
      ghostId: number;
      asset: string;
      family: string;
      spawnAt: CutsceneVec3;
      height: number;
    }
  | {
      kind: "anchor";
      role: string;
      position: CutsceneVec3;
      height: number;
      label?: string;
    }
  | {
      // Role exists but nothing bound; actions referencing it are dropped.
      kind: "unbound";
      role: string;
    };

export interface CastResolution {
  ok: boolean;
  cancelReason?: string;
  actors: Map<string, ResolvedActor>;
  diagnostics: string[];
}

const DEFAULT_ACTOR_HEIGHT = 1.8;

let ghostIdCounter = 0;
/** Negative, never collides with real BiomesIds (which are positive). */
export function nextGhostId(): number {
  ghostIdCounter += 1;
  return -(1_000_000 + ghostIdCounter);
}

function entityAlive(view: CutsceneEntityView | undefined): boolean {
  return !!view && view.alive !== false && !!view.position;
}

function resolveOne(
  member: CutsceneRole,
  world: CutsceneWorldIndex,
  diagnostics: string[],
  usedAuthorities: ReadonlyMap<string, string>
): ResolvedActor | undefined {
  const binding = member.binding;
  switch (binding.kind) {
    case "player":
      return {
        kind: "player",
        role: member.role,
        entityId: world.playerId,
        height: world.playerHeight ?? DEFAULT_ACTOR_HEIGHT,
      };
    case "entity": {
      const view = world.entity(binding.entityId);
      if (!entityAlive(view)) {
        diagnostics.push(
          `role "${member.role}": entity ${binding.entityId} missing or dead`
        );
        return undefined;
      }
      return {
        kind: "entity",
        role: member.role,
        entityId: view!.id,
        height: view!.height ?? DEFAULT_ACTOR_HEIGHT,
        isNpc: view!.isNpc !== false,
      };
    }
    case "nearestNpc": {
      const near = binding.near ?? world.playerPosition;
      const labelRe = binding.labelMatch
        ? new RegExp(binding.labelMatch, "i")
        : undefined;
      let best: CutsceneEntityView | undefined;
      let bestDist = Infinity;
      for (const candidate of world.npcsNear(near, binding.within)) {
        if (!entityAlive(candidate)) continue;
        if (usedAuthorities.has(`entity:${candidate.id}`)) continue;
        if (labelRe && !labelRe.test(candidate.label ?? "")) continue;
        if (
          binding.npcTypeId !== undefined &&
          candidate.npcTypeId !== binding.npcTypeId
        ) {
          continue;
        }
        const d = v3dist(candidate.position!, near);
        if (d < bestDist) {
          best = candidate;
          bestDist = d;
        }
      }
      if (!best) {
        diagnostics.push(
          `role "${member.role}": no npc match within ${binding.within}m`
        );
        return undefined;
      }
      return {
        kind: "entity",
        role: member.role,
        entityId: best.id,
        height: best.height ?? DEFAULT_ACTOR_HEIGHT,
        isNpc: true,
      };
    }
    case "ghost":
      return {
        kind: "ghost",
        role: member.role,
        ghostId: nextGhostId(),
        asset: binding.asset,
        family: binding.family === "human" ? "live_entity" : binding.family,
        spawnAt: binding.spawnAt ?? world.playerPosition,
        height: binding.height,
      };
    case "anchor":
      return {
        kind: "anchor",
        role: member.role,
        position: [...binding.position],
        height: binding.height,
        label: binding.label,
      };
  }
}

function authorityKey(actor: ResolvedActor): string | undefined {
  switch (actor.kind) {
    case "player":
    case "entity":
      return `entity:${actor.entityId}`;
    case "ghost":
      return `ghost:${actor.ghostId}`;
    case "anchor":
    case "unbound":
      return undefined;
  }
}

/**
 * Resolve every cast member. Never returns a half-cast runnable scene: a
 * required role that can't resolve (even via fallback) cancels the whole
 * scene so the caller can clean up and apply only cancellation-authorized
 * end-state hooks.
 */
export function resolveCast(
  def: CutsceneDef,
  world: CutsceneWorldIndex
): CastResolution {
  const actors = new Map<string, ResolvedActor>();
  const diagnostics: string[] = [];
  const usedAuthorities = new Map<string, string>();

  for (const member of def.cast) {
    let actor = resolveOne(member, world, diagnostics, usedAuthorities);
    const key = actor ? authorityKey(actor) : undefined;
    if (actor && key) {
      const priorRole = usedAuthorities.get(key);
      if (priorRole) {
        diagnostics.push(
          `role "${member.role}": resolved to the same actor as role "${priorRole}"`
        );
        actor = undefined;
      }
    }
    if (!actor && member.fallback === "ghost" && member.ghostAsset) {
      diagnostics.push(`role "${member.role}": using ghost stand-in`);
      actor = {
        kind: "ghost",
        role: member.role,
        ghostId: nextGhostId(),
        asset: member.ghostAsset,
        family: "live_entity",
        spawnAt: world.playerPosition,
        height: DEFAULT_ACTOR_HEIGHT,
      };
    }
    if (!actor) {
      if (member.required) {
        return {
          ok: false,
          cancelReason: `required role "${member.role}" could not be bound`,
          actors,
          diagnostics,
        };
      }
      diagnostics.push(`role "${member.role}": unbound (optional)`);
      actor = { kind: "unbound", role: member.role };
    }
    actors.set(member.role, actor);
    const resolvedKey = authorityKey(actor);
    if (resolvedKey) {
      usedAuthorities.set(resolvedKey, member.role);
    }
  }

  for (const [role, actor] of actors) {
    if (actor.kind !== "entity" || actor.isNpc) {
      continue;
    }
    const unsupportedAction = def.shots
      .flatMap((shot) => shot.actions)
      .find(
        (action) =>
          "role" in action &&
          action.role === role &&
          ["moveTo", "teleport", "face", "emote"].includes(action.kind)
      );
    if (unsupportedAction) {
      return {
        ok: false,
        cancelReason: `role "${role}" resolves to a non-NPC entity that cannot run "${unsupportedAction.kind}"`,
        actors,
        diagnostics,
      };
    }
  }

  return { ok: true, actors, diagnostics };
}
