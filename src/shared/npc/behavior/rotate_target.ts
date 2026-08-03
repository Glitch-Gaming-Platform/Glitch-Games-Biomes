// Logic shared by all muckers.

import { degToRad, diffAngle, normalizeAngle } from "@/shared/math/angles";
import {
  finiteNpcOrientation,
  isFiniteNpcOrientation,
} from "@/shared/npc/motion_safety";
import type { SimulatedNpc } from "@/shared/npc/simulated";
import { z } from "zod";

export const zRotateTargetComponent = z.object({
  rotateTarget: z.number(),
});

export function rotateTargetTick(
  npc: SimulatedNpc,
  degsPerSec: number,
  dtSecs: number
) {
  const orientation = finiteNpcOrientation(
    npc.orientation,
    npc.metadata.spawn_orientation
  );
  if (!isFiniteNpcOrientation(npc.orientation)) {
    npc.setOrientation(orientation);
  }

  // Apply logic to turn the NPC towards its rotation target.
  if (npc.state.rotateTarget === undefined) {
    return;
  }
  if (
    !Number.isFinite(npc.state.rotateTarget) ||
    !Number.isFinite(degsPerSec) ||
    degsPerSec < 0 ||
    !Number.isFinite(dtSecs) ||
    dtSecs < 0
  ) {
    delete npc.mutableState().rotateTarget;
    return;
  }

  let rotateDiff = diffAngle(npc.state.rotateTarget, orientation[1]);
  const maxRadsInTick = degToRad(degsPerSec) * dtSecs;
  if (rotateDiff > maxRadsInTick || rotateDiff < -maxRadsInTick) {
    rotateDiff = Math.min(maxRadsInTick, Math.max(-maxRadsInTick, rotateDiff));
  } else {
    // Last tick for rotation!
    delete npc.mutableState().rotateTarget;
  }

  npc.setOrientation([
    orientation[0],
    normalizeAngle(rotateDiff + orientation[1]),
  ]);
}
