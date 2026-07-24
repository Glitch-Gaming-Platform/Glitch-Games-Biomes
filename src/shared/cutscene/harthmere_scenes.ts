// HARTHMERE_AUTHORED_CUTSCENES
//
// Canonical, triggerable Harthmere scenes assembled from shared ECS seed data
// and reusable templates. Keeping identity lookup here prevents UI/dev tools
// from copying stale actor ids or rebuilding choreography ad hoc.

import { heroVsCreaturesCutscene } from "@/shared/cutscene/templates";
import type { CutsceneDef, CutsceneVec3 } from "@/shared/cutscene/schema";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  SNAPSHOT_GROVE_JACKIE_ENTITY_ID,
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
} from "@/shared/harthmere/snapshot_grove_ids";
import { HARTHMERE_JACKIE_FIGHT_MUCKER_ENTITY_IDS } from "@/shared/harthmere/live_entity_seed_ids";

export const JACKIE_VS_MUCKERS_CUTSCENE_ID = "jackie-vs-muckers";
export const JACKIE_VS_MUCKERS_DURATION_SECONDS = 15;

// This Old Grove Road clearing was visually validated for the camera paths.
// The snapshot's Road Muckwad 7–9 cluster remains close enough to stream, then
// client-puppet staging moves those native meshes here without mutating ECS.
export const JACKIE_VS_MUCKERS_STAGE_CENTER: CutsceneVec3 = [
  500,
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
  -140,
];

function canonicalJackieEntityId(): number {
  // Use the current server-seeded Grove entity, not the legacy tutorial-only
  // JACKIE_ID alias. This is the id routed to Jackie's archived snapshot GLB.
  return Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID);
}

function canonicalRoadMuckerEntityIds(): number[] {
  const ids = HARTHMERE_JACKIE_FIGHT_MUCKER_ENTITY_IDS.map(Number);
  if (ids.length !== 3) {
    throw new Error("three canonical Road Muckers are required for the scene");
  }
  return ids;
}

/** A 15-second, non-authoritative Jackie-versus-Muckers combat vignette. */
export function jackieVsMuckersCutscene(): CutsceneDef {
  return heroVsCreaturesCutscene({
    id: JACKIE_VS_MUCKERS_CUTSCENE_ID,
    name: "Jackie Clears the Old Grove Road",
    hero: { kind: "entity", entityId: canonicalJackieEntityId() },
    heroName: "Jackie",
    enemies: canonicalRoadMuckerEntityIds().map((entityId) => ({
      binding: { kind: "entity" as const, entityId },
      // Do not substitute a generic humanoid when a native Mucker is absent.
      // The reusable template cancels this required scene instead, making a
      // bad snapshot/streaming setup visible to capture automation.
    })),
    center: JACKIE_VS_MUCKERS_STAGE_CENTER,
    weaponItemId: Number(BikkieIds.muckBuster),
    durationSeconds: JACKIE_VS_MUCKERS_DURATION_SECONDS,
    victoryLine: "Path's clear. Keep moving — and watch the Muck.",
    music: "battle_music",
    timeOfDay: 0.68,
  });
}
