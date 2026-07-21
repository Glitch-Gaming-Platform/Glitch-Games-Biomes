import type { FinalizedChangeSet } from "@/server/logic/events/context/change_set";
import type { ApplyStatus } from "@/shared/api/transaction";
import type { BiomesId } from "@/shared/ids";

/**
 * Finds newly allocated IDs that an aborted transaction learned are already
 * occupied in authoritative ECS state.
 *
 * World apply responses include eager changes for failed IFFs. Intersecting
 * those entity IDs with a proposal's `usedIds` distinguishes a generated-ID
 * collision from normal terrain/player version contention. Only collisions
 * must be discarded; IDs from ordinary contention remain safe to reuse.
 */
export function generatedIdsCollidingWithAuthoritativeState(
  proposals: ReadonlyArray<Pick<FinalizedChangeSet<unknown>, "usedIds">>,
  outcomes: readonly ApplyStatus[],
  authoritativeEagerIds: Iterable<BiomesId>
): BiomesId[] {
  const authoritativeIds = new Set(authoritativeEagerIds);
  const collisions = new Set<BiomesId>();

  for (let i = 0; i < proposals.length; ++i) {
    if (outcomes[i] !== "aborted") {
      continue;
    }
    for (const id of proposals[i].usedIds) {
      if (authoritativeIds.has(id)) {
        collisions.add(id);
      }
    }
  }

  return [...collisions];
}
