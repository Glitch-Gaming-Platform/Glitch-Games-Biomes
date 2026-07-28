import { harthmereLiveEntityIdFromOffset } from "@/shared/harthmere/live_entity_seed_ids";
import type { BiomesId } from "@/shared/ids";

// Keep this identity table browser-light. The live production seed and jobs
// board modules pull in terrain and quest initialization that the audio client
// does not otherwise need.
export const HARTHMERE_BOSS_MUSIC_ENTITY_IDS = Object.freeze({
  muckScarredHelix: harthmereLiveEntityIdFromOffset(9014),
  thaedrynTheBellbound: harthmereLiveEntityIdFromOffset(9120),
  alphaMucker: harthmereLiveEntityIdFromOffset(9509),
  hexWraith: harthmereLiveEntityIdFromOffset(9543),
  gildedBull: 8_810_000_003_000_006 as BiomesId,
  ninthWinter: 8_810_000_003_000_012 as BiomesId,
});

const HARTHMERE_BOSS_MUSIC_ENTITY_ID_SET = new Set<BiomesId>(
  Object.values(HARTHMERE_BOSS_MUSIC_ENTITY_IDS)
);

const HARTHMERE_BOSS_MUSIC_NAME_FRAGMENTS = [
  "muck scarred helix",
  "gilded bull",
  "ninth winter",
  "failed apprentice",
  "first choir",
  "echo singer",
  "vyrahel",
  "thaedryn the bellbound",
  "hex wraith",
  "alpha mucker",
  "root crowned dead",
] as const;

function normalizeBossMusicName(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isHarthmereBossMusicName(value: string | undefined) {
  if (!value) {
    return false;
  }
  const normalized = normalizeBossMusicName(value);
  return HARTHMERE_BOSS_MUSIC_NAME_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment)
  );
}

export function isHarthmereBossMusicEncounter(input: {
  entityId: BiomesId;
  label?: string;
  npcTypeDisplayName?: string;
}) {
  return (
    HARTHMERE_BOSS_MUSIC_ENTITY_ID_SET.has(input.entityId) ||
    isHarthmereBossMusicName(input.label) ||
    isHarthmereBossMusicName(input.npcTypeDisplayName)
  );
}
