import type { BiomesId } from "@/shared/ids";
import {
  LOCAL_DEV_HUMAN_NPC_TYPE_ID,
  LOCAL_DEV_WALKER_NPC_TYPE_ID,
} from "@/shared/npc/bikkie";

export const HARTHMERE_NPC_POPULATION_POLICY_VERSION =
  "harthmere-npc-population-v4-production-recheck" as const;

// Read-only production Redis audit, 2026-08-02: these were the complete set of
// persisted entities whose label contained "Townsperson". All ten decoded as
// local-dev human/walker NPCs inside Market Square, with no authored identity
// or description. Keeping the exact ids lets remote-world reconciliation retire
// them even when it cannot iterate the whole table like ShimWorldService can.
export const HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS = [
  128_172_217_992_643, 1_790_276_464_219_807, 2_108_639_715_362_821,
  2_443_541_317_214_563, 2_937_624_544_637_812, 2_954_162_895_346_540,
  3_748_003_729_365_484, 6_468_562_420_951_240, 6_830_338_842_704_665,
  7_545_622_510_857_151,
  // Production reconciliation readback, 2026-08-04: four additional generic
  // local-dev townsperson rows survived because they were not present in the
  // original August 2 audit snapshot.
  8_914_171_032_004_393, 760_764_132_601_489, 5_085_542_842_933_861,
  3_439_976_947_415_425,
] as unknown as readonly BiomesId[];

const GENERIC_TOWNSPERSON_LABELS = new Set([
  "",
  "townsperson",
  "walking townsperson",
  "local dev townsperson",
  "local dev walking townsperson",
]);

export type HarthmereNpcPopulationCandidate = {
  id: BiomesId;
  typeId?: BiomesId;
  label?: string;
  position?: readonly [number, number, number];
  isPlayer?: boolean;
  isCanonicalPersistentNpc?: boolean;
};

export function isGenericHarthmereTownspersonLabel(label?: string) {
  return GENERIC_TOWNSPERSON_LABELS.has((label ?? "").trim().toLowerCase());
}

export function shouldRetireGenericHarthmereTownsperson(
  candidate: HarthmereNpcPopulationCandidate,
  townOffsetX: number,
  townOffsetZ: number
) {
  if (
    candidate.isPlayer ||
    candidate.isCanonicalPersistentNpc ||
    !candidate.position ||
    !isGenericHarthmereTownspersonLabel(candidate.label)
  ) {
    return false;
  }
  if (
    candidate.typeId !== LOCAL_DEV_HUMAN_NPC_TYPE_ID &&
    candidate.typeId !== LOCAL_DEV_WALKER_NPC_TYPE_ID
  ) {
    return false;
  }
  const authoredX = candidate.position[0] - townOffsetX;
  const authoredZ = candidate.position[2] - townOffsetZ;
  return (
    authoredX >= 320 &&
    authoredX <= 640 &&
    authoredZ >= -384 &&
    authoredZ <= -80
  );
}
