import type { ProposedChange } from "@/shared/ecs/change";
import { NpcMetadata, Position } from "@/shared/ecs/gen/components";
import {
  harthmereBusinessBlockedAisleForPoint,
  harthmereBusinessPostClearOfEveryAisle,
} from "@/shared/harthmere/business_aisle_keep_out";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_BUSINESS_AISLE_NPC_SWEEP_VERSION =
  "harthmere-business-aisle-npc-sweep-v1" as const;

/**
 * HARTHMERE_BUSINESS_AISLE_NPC_SWEEP
 *
 * Relocate persistent NPC bodies out of business customer aisles at the
 * reconciliation boundary.
 *
 * The authored fix — putting shop owners on the staff side of their own
 * counter — solves the family we control. It cannot solve the other one.
 * Chapter 1 quest actors, additive-town residents and Grove NPCs are authored
 * in their own tables, by their own passes, with no knowledge of which business
 * shell they now stand inside; the outposts only grew to their audited
 * 24x20 / 28x22 footprints later. Ashline alone had two of them planted across
 * its entrance. Chasing every authoring table would fix today's world and miss
 * the next NPC someone adds.
 *
 * So the guarantee is enforced once, where every persistent NPC in the world
 * passes through, and it is expressed as authored reconciliation rather than a
 * repair script: a cold seed, a warm-Redis refresh and a reconciliation replay
 * all converge on the same clear aisles.
 *
 * Two things this deliberately does *not* do:
 *
 * - It never touches session-only business customers. Those bodies are supposed
 *   to be in the aisle; that is the entire feature. Callers pass them in the
 *   exempt set.
 * - It never moves an NPC without also moving its home anchor. That is the trap
 *   this system has fallen into before: `spawn_position` drives return-home and
 *   meander, so a body relocated by position alone simply walks back into the
 *   lane on its next tick and the reconciliation looks like it silently failed.
 */

export interface HarthmereBusinessAisleNpcCandidate {
  id: BiomesId;
  position: Vec3;
  spawnPosition?: Vec3;
  /** Present for NPCs; used to keep the home anchor consistent with the move. */
  npcMetadata?: {
    npc_type_id: BiomesId;
    created_time: number;
    spawn_event_id?: BiomesId;
    spawn_coordinates?: Vec3;
    spawn_position?: Vec3;
    spawn_orientation?: [number, number];
  };
}

export interface HarthmereBusinessAisleNpcRelocation {
  id: BiomesId;
  outpostId: string;
  from: Vec3;
  to: Vec3;
  movedHomeAnchor: boolean;
}

export interface HarthmereBusinessAisleNpcSweepResult {
  version: typeof HARTHMERE_BUSINESS_AISLE_NPC_SWEEP_VERSION;
  relocations: HarthmereBusinessAisleNpcRelocation[];
  changes: ProposedChange[];
  /** Bodies that block an aisle and could not be moved anywhere legal. */
  unresolved: BiomesId[];
}

function samePoint(a: Vec3, b: Vec3) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export function buildHarthmereBusinessAisleNpcSweep(input: {
  candidates: readonly HarthmereBusinessAisleNpcCandidate[];
  /** Session-only business customers, which belong in the aisle. */
  exemptIds?: ReadonlySet<BiomesId>;
}): HarthmereBusinessAisleNpcSweepResult {
  const exempt = input.exemptIds ?? new Set<BiomesId>();
  const relocations: HarthmereBusinessAisleNpcRelocation[] = [];
  const changes: ProposedChange[] = [];
  const unresolved: BiomesId[] = [];

  for (const candidate of input.candidates) {
    if (exempt.has(candidate.id)) continue;
    const blocking = harthmereBusinessBlockedAisleForPoint(candidate.position);
    if (!blocking) continue;
    const moved = harthmereBusinessPostClearOfEveryAisle(candidate.position);
    if (samePoint(moved, candidate.position)) {
      // The relocator could not find a legal post. Report it rather than
      // shuffling the body somewhere arbitrary; a business whose interior has
      // no free staff-side floor is an authoring defect the contract surfaces.
      unresolved.push(candidate.id);
      continue;
    }

    const homeAnchor = candidate.npcMetadata?.spawn_position;
    // Move the home anchor with the body whenever it was itself in the aisle.
    // Leaving a home anchor behind is how a "relocated" NPC walks straight back
    // into the customer lane on its next return-home tick.
    const homeBlocked =
      homeAnchor !== undefined &&
      harthmereBusinessBlockedAisleForPoint(homeAnchor) !== undefined;
    const entity: Record<string, unknown> = {
      id: candidate.id,
      position: Position.create({ v: moved }),
    };
    if (candidate.npcMetadata && homeBlocked) {
      entity.npc_metadata = NpcMetadata.create({
        ...candidate.npcMetadata,
        spawn_position: moved,
      });
    }
    changes.push({ kind: "update", entity: entity as any });
    relocations.push({
      id: candidate.id,
      outpostId: blocking.outpostId,
      from: [candidate.position[0], candidate.position[1], candidate.position[2]],
      to: moved,
      movedHomeAnchor: Boolean(candidate.npcMetadata && homeBlocked),
    });
  }

  return {
    version: HARTHMERE_BUSINESS_AISLE_NPC_SWEEP_VERSION,
    relocations,
    changes,
    unresolved,
  };
}

/**
 * Apply the keep-out rule to seed changes before they are written.
 *
 * Correcting an authored seed in place is better than writing it into the aisle
 * and relocating it afterwards: the world never contains a blocking body even
 * momentarily, the correction costs no extra ECS write, and a warm-Redis
 * refresh converges to the same state as a cold seed because both run this same
 * pass. Chapter 1 actors, Grove residents and additive-town NPCs all flow
 * through here.
 *
 * Both `position` and the NPC's `spawn_position` home anchor are corrected
 * together, because return-home and meander steer to the anchor: moving one
 * without the other produces a body that walks back into the lane and a
 * reconciliation that appears to have done nothing.
 */
export function applyHarthmereBusinessAisleKeepOutToSeedChanges<
  // Constrained on `kind` rather than on an entity shape.
  //
  // The obvious constraint — `{ entity?: { position?: { v: Vec3 } } }` — cannot
  // accept a real `Change[]`. `ReadonlyEntity.position` is a `ReadonlyPosition`
  // holding a `ReadonlyVec3f`; an `Update` is a delta whose components may be
  // explicitly `null`; and a `Delete` has no `entity` key at all, which trips
  // TypeScript's weak-type detection. Constraining on the discriminant instead
  // accepts every member of the union, preserves `T` so the swept result goes
  // straight back into a `Change[]`, and leaves the position read structural.
  T extends { kind: string },
>(
  changes: readonly T[],
  options: { exemptIds?: ReadonlySet<BiomesId> } = {}
): { changes: T[]; correctedIds: BiomesId[] } {
  const exempt = options.exemptIds ?? new Set<BiomesId>();
  const correctedIds: BiomesId[] = [];
  const next = changes.map((change) => {
    const entity = (change as { entity?: any }).entity;
    const readonlyPosition = entity?.position?.v as
      | readonly [number, number, number]
      | undefined;
    if (!readonlyPosition || (entity?.id && exempt.has(entity.id))) {
      return change;
    }
    const position: Vec3 = [
      readonlyPosition[0],
      readonlyPosition[1],
      readonlyPosition[2],
    ];
    if (!harthmereBusinessBlockedAisleForPoint(position)) return change;
    const moved = harthmereBusinessPostClearOfEveryAisle(position);
    if (samePoint(moved, position)) return change;
    correctedIds.push(entity.id);
    const corrected: any = {
      ...change,
      entity: { ...entity, position: Position.create({ v: moved }) },
    };
    const anchor = entity.npc_metadata?.spawn_position as Vec3 | undefined;
    if (
      anchor &&
      harthmereBusinessBlockedAisleForPoint(anchor) !== undefined
    ) {
      corrected.entity.npc_metadata = NpcMetadata.create({
        ...entity.npc_metadata,
        spawn_position: moved,
      });
    }
    return corrected as T;
  });
  return { changes: next, correctedIds };
}
