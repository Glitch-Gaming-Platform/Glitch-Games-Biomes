// HARTHMERE_LIVE_ENTITY_SEED_IDS
//
// Lightweight deterministic identity helpers shared by server seeders and
// client cinematic definitions. Keep this module data-only: importing the full
// production seeder into a browser bundle also pulls terrain generation and
// asset-definition initialization across the client/server boundary.

import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_ids";
import type { BiomesId } from "@/shared/ids";

export function harthmereLiveEntityIdFromOffset(idOffset: number): BiomesId {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + idOffset) as BiomesId;
}

export const HARTHMERE_ROAD_MUCKWAD_FIRST_OFFSET = 9466;

// The May 16 snapshot has these three Road Muckwad ECS entities persisted as a
// tight cluster around [550, 70, -142]. Earlier records in the same layout are
// valid Muckers but are hundreds of metres apart in that snapshot; an observer
// cannot stream all three at once, which made cinematic binding fall back.
export const HARTHMERE_JACKIE_FIGHT_MUCKER_OFFSETS = [
  9472, 9473, 9474,
] as const;

export const HARTHMERE_JACKIE_FIGHT_MUCKER_ENTITY_IDS =
  HARTHMERE_JACKIE_FIGHT_MUCKER_OFFSETS.map(harthmereLiveEntityIdFromOffset);
