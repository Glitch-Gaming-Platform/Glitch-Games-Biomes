import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";

export async function runPlaceableMeshOptionalUpdates(
  placeableId: BiomesId,
  updates: ReadonlyArray<{ name: string; run: () => Promise<void> }>,
  onError: (name: string, error: unknown) => void = (name, error) => {
    log.warn("PLACEABLE_MESH_OPTIONAL_UPDATE_DEFERRED", {
      id: placeableId,
      update: name,
      error,
    });
  }
) {
  // Picture frames, mounts, punchthrough media, and race metadata may perform
  // OOB/network reads. A brief replica or proxy interruption must not reject the
  // parent /scene/placeable/mesh resource: the resource graph caches a rejected
  // async value until invalidated, which previously left the object absent until
  // a full page reload. Keep the already-built mesh and retry optional metadata
  // naturally on its next ECS/resource update.
  for (const update of updates) {
    try {
      await update.run();
    } catch (error) {
      onError(update.name, error);
    }
  }
}
