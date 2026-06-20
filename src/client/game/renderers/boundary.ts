import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import type { ClientResources } from "@/client/game/resources/types";

export class BoundaryRenderer implements Renderer {
  name = "boundary";

  constructor(readonly resources: ClientResources) {}

  draw(scenes: Scenes) {
    const worldMetadata = this.resources.get("/ecs/metadata");
    const box = this.resources.get("/scene/boundary");
    const player = this.resources.get("/scene/local_player");

    // Compute the player distance to the boundary.
    const [x, y, z] = player.player.position;
    const distance = Math.min(
      x - worldMetadata.aabb[0],
      y - worldMetadata.aabb[1],
      z - worldMetadata.aabb[2],
      worldMetadata.aabb[0] - x,
      worldMetadata.aabb[1] - y,
      worldMetadata.aabb[2] - z
    );
    // Add the box to the scene if it's close.
    if (distance < 24) {
      addToScenes(scenes, box);
    }
  }
}
