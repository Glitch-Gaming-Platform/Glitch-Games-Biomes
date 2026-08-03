import type { HotBarSelection } from "@/client/game/resources/inventory";
import { isCameraExitKey } from "@/client/game/resources/inventory";

export function shouldInGameCameraHudHandleExitKey(
  input: {
    code: string;
    repeat: boolean;
    inInputElement: boolean;
  },
  selection: HotBarSelection
) {
  return (
    !input.repeat &&
    !input.inInputElement &&
    isCameraExitKey(input.code, selection)
  );
}
