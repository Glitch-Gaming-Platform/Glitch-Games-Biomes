// HARTHMERE_NPC_RENDER_COMPONENT_COMPAT
//
// Lightweight, dependency-minimal NPC render-eligibility helpers. These live in
// their own module (free of three.js / GLTF imports) so they can be unit tested
// without pulling the full renderer graph.

import type {
  ReadonlyEntity,
  ReadonlyEntityWith,
} from "@/shared/ecs/gen/entities";
import { Entity } from "@/shared/ecs/gen/entities";
import { getNpcBoxSize, idToNpcType, isNpcTypeId } from "@/shared/npc/bikkie";
import type { Vec3 } from "@/shared/math/types";

export const RENDER_NPC_COMPONENTS = [
  "rigid_body",
  "npc_metadata",
  "position",
  "size",
  "orientation",
  "health",
] as const;

export type RenderNpcEntity = ReadonlyEntityWith<
  (typeof RENDER_NPC_COMPONENTS)[number]
>;

export function isRenderNpcEntity(
  entity: ReadonlyEntity
): entity is RenderNpcEntity {
  return Entity.has(entity, ...RENDER_NPC_COMPONENTS);
}

export const HARTHMERE_NPC_RENDER_COMPONENT_COMPAT_VERSION =
  "harthmere-npc-render-component-compat";

// Seeded social / grove / muck NPCs in the Harthmere snapshot frequently arrive
// with npc_metadata + label + position but WITHOUT the full combat component
// set the body renderer demanded (rigid_body, size, orientation, health). The
// name-overlay path already tolerates this (see
// SNAPSHOT_OVERLAY_ENTITY_SIZE_COMPAT in scripts/overlays.ts), so those NPCs
// rendered as a floating nameplate with no body — the "invisible NPC" bug.
// What every invisible NPC had in common was a missing render component (most
// often `health`, since town/vendor NPCs are seeded without combat stats), which
// made isRenderNpcEntity() return false and skipped their mesh entirely.
//
// Return a display-only copy of the entity with safe defaults filled in so any
// positioned NPC gets a visible mesh. The authoritative ECS entity is never
// mutated; this copy is consumed only by the renderer for the current frame.
export function harthmereEnsureRenderableNpcEntity(
  entity: ReadonlyEntity
): RenderNpcEntity | undefined {
  if (isRenderNpcEntity(entity)) {
    return entity;
  }
  if (!entity.npc_metadata || !entity.position) {
    // Without a type and a position there is nothing to place a mesh at.
    return undefined;
  }
  const typeId = entity.npc_metadata.type_id;
  const npcType = typeof typeId === "number" && isNpcTypeId(typeId)
    ? idToNpcType(typeId)
    : undefined;
  const boxSize: Vec3 = npcType ? getNpcBoxSize(npcType) : [1, 2, 1];
  const maxHp = Math.max(1, Math.trunc(Number(entity.health?.maxHp ?? 100)));
  return {
    ...entity,
    rigid_body: entity.rigid_body ?? { velocity: [0, 0, 0] },
    size: entity.size ?? { v: boxSize },
    orientation: entity.orientation ?? { v: [0, 0] },
    health:
      entity.health ?? {
        hp: maxHp,
        maxHp,
        lastDamageTime: undefined,
        lastDamageSource: undefined,
      },
  } as unknown as RenderNpcEntity;
}
