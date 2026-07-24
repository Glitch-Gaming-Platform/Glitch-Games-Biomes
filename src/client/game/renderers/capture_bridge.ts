import type { RendererController } from "@/client/game/renderers/renderer_controller";

let activeRendererController: RendererController | undefined;

export function setActiveRendererController(
  controller: RendererController | undefined
): void {
  activeRendererController = controller;
}

export function getActiveRendererController(): RendererController | undefined {
  return activeRendererController;
}
