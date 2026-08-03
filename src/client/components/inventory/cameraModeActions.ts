import type { Events } from "@/client/game/context_managers/events";
import type { ClientReactResources } from "@/client/game/resources/types";
import type { CameraItemMode } from "@/shared/bikkie/schema/types";
import { ChangeCameraModeEvent } from "@/shared/ecs/gen/events";
import { fireAndForget } from "@/shared/util/async";

export function switchCameraModes(
  reactResources: ClientReactResources,
  events: Events,
  mode: CameraItemMode
) {
  // This helper is called from document/click event handlers as well as React
  // callbacks. `use()` invokes React hooks and therefore throws outside render,
  // aborting camera exit before the hotbar selection can change. Event paths
  // must read the already-created resource directly.
  const localPlayer = reactResources.get("/scene/local_player");
  reactResources.set("/hotbar/camera_mode", { value: mode });
  fireAndForget(
    events.publish(
      new ChangeCameraModeEvent({ id: localPlayer.id, mode: mode.modeType })
    )
  );
}
