import type { Overlay, OverlayMap } from "@/client/game/resources/overlays";

function isNativeInspectableWorldTarget(overlay: Overlay): boolean {
  switch (overlay.kind) {
    case "player":
    case "npc":
    case "robot":
    case "group":
    case "placeable":
    case "plant":
    case "grab_bag":
    case "harthmere_object":
    case "blueprint":
      return true;
    case "hidden":
      return isNativeInspectableWorldTarget(overlay.overlay);
    default:
      return false;
  }
}

/**
 * Native cursor inspection owns F whenever it has selected a concrete gameplay
 * target. Bespoke Harthmere proximity prompts run in the capture phase, so they
 * must hide before installing their key listener or they can consume F ahead of
 * crates, crops, NPCs, doors, crafting stations, and native GrabBags.
 */
export function hasNativeInspectableWorldTarget(overlays: OverlayMap) {
  for (const overlay of overlays.values()) {
    if (isNativeInspectableWorldTarget(overlay)) {
      return true;
    }
  }
  return false;
}
