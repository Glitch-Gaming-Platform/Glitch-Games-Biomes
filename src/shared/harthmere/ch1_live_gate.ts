// CHAPTER_1_LIVE_GATE
//
// Small, pure helpers shared by the authenticated gate API, the HUD prompt,
// and focused tests. Rendering stays client-only and warping stays
// server-only; this file only translates durable/native state into the
// Chapter 1 contracts that both sides are allowed to know.

import { ch1NativeQuestId } from "@/shared/harthmere/ch1_native_quests";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";
import {
  CH1_ENDINGS,
  CH1_FLAGS,
  CH1_TRACK_DEFAULTS,
  type Ch1Ending,
} from "@/shared/harthmere/ch1_ids";
import {
  CH1_FRAGMENT_IDS,
  ch1EmptyLedger,
  type Ch1LedgerState,
} from "@/shared/harthmere/ch1_fragment_ledger";
import {
  CH1_LATENT_SKILL_IDS,
  ch1EmptyLatentSkills,
  type Ch1LatentSkillId,
  type Ch1LatentSkillState,
} from "@/shared/harthmere/ch1_latent_skills";
import {
  ch1Augur9Initial,
  type Ch1Augur9State,
} from "@/shared/harthmere/ch1_augur9";
import {
  normalizeCh1DungeonSurvivalState,
  type Ch1DungeonResourceKey,
  type Ch1DungeonSurvivalState,
} from "@/shared/harthmere/ch1_dungeon_mechanics";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeItemIdForBiomesId,
} from "@/shared/harthmere/harthmere_native_item_ids";

export const CH1_GATE_INTERACTION_RADIUS = 7;
export const CH1_EXIT_INTERACTION_RADIUS = 9;

export interface Ch1LiveGateRuntimeState {
  activeDungeonRunId?: string;
  /** Unique logical run shared by every admitted member of the native team. */
  activeDungeonInstanceId?: string;
  activeDungeonPartyId?: string;
  /** Diegetic board name chosen with Taye; profile identity is unchanged. */
  chosenName?: string;
  activeGateId?: string;
  activeRunStartedMs?: number;
  /** Exact Grove-side position used for the return warp. */
  returnPosition?: [number, number, number];
  /** Completion flags earned through validated dungeon exits. */
  completionFlags: string[];
  /** Durable story flags mirrored from authored objective consequences. */
  flags: string[];
  tracks: Record<string, number>;
  ledger: Ch1LedgerState;
  latentSkills: Ch1LatentSkillState;
  latentSkillLastUsedAtMs: Partial<Record<Ch1LatentSkillId, number>>;
  lastLatentSkillUse?: {
    skillId: Ch1LatentSkillId;
    usedAtMs: number;
    result: string;
  };
  testimonies: string[];
  augur9: Ch1Augur9State;
  /** Playback logs discovered by story beats but not yet bought with charge. */
  availablePlaybackIds: string[];
  ending?: Ch1Ending;
  hallrChoice?: "let_run" | "hold_stall";
  /** Reserved pack resources and the last applied dungeon-zone consequence. */
  dungeonSurvival?: Ch1DungeonSurvivalState;
  /** Idempotency ledger for native objective -> durable story mutations. */
  appliedObjectiveEffects: string[];
}

export function defaultCh1LiveGateRuntimeState(): Ch1LiveGateRuntimeState {
  return {
    completionFlags: [],
    flags: [],
    tracks: { ...CH1_TRACK_DEFAULTS },
    ledger: ch1EmptyLedger(),
    latentSkills: ch1EmptyLatentSkills(),
    latentSkillLastUsedAtMs: {},
    testimonies: [],
    augur9: ch1Augur9Initial(),
    availablePlaybackIds: [],
    appliedObjectiveEffects: [],
  };
}

function finiteVec3(value: unknown): [number, number, number] | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every((entry) => Number.isFinite(Number(entry)))
  ) {
    return undefined;
  }
  return [Number(value[0]), Number(value[1]), Number(value[2])];
}

/**
 * Old saves do not have a Chapter 1 runtime branch. Normalize instead of
 * trusting the serialized shape so a malformed/stale run can never grant an
 * arbitrary warp destination.
 */
export function normalizeCh1LiveGateRuntimeState(
  raw: unknown
): Ch1LiveGateRuntimeState {
  const defaults = defaultCh1LiveGateRuntimeState();
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const stringOrUndefined = (candidate: unknown) =>
    typeof candidate === "string" && candidate.length > 0
      ? candidate
      : undefined;
  const started = Number(value.activeRunStartedMs);
  const uniqueStrings = (candidate: unknown) =>
    Array.isArray(candidate)
      ? [
          ...new Set(
            candidate.filter(
              (entry): entry is string =>
                typeof entry === "string" && entry.length > 0
            )
          ),
        ]
      : [];
  const rawTracks =
    value.tracks && typeof value.tracks === "object"
      ? (value.tracks as Record<string, unknown>)
      : {};
  const tracks = { ...defaults.tracks };
  for (const [track, rawValue] of Object.entries(rawTracks)) {
    const numeric = Number(rawValue);
    if (Number.isFinite(numeric)) {
      tracks[track] = Math.max(0, Math.min(100, numeric));
    }
  }
  const rawLedger =
    value.ledger && typeof value.ledger === "object"
      ? (value.ledger as Record<string, unknown>)
      : {};
  const knownFragmentIds = new Set(CH1_FRAGMENT_IDS);
  const entries = Array.isArray(rawLedger.entries)
    ? rawLedger.entries
        .map((entry) => {
          if (!entry || typeof entry !== "object") return undefined;
          const row = entry as Record<string, unknown>;
          const fragmentId = String(row.fragmentId ?? "");
          const recoveredAtMs = Number(row.recoveredAtMs);
          if (
            !knownFragmentIds.has(fragmentId) ||
            !Number.isFinite(recoveredAtMs)
          ) {
            return undefined;
          }
          return {
            fragmentId,
            recoveredAtMs,
            revised: row.revised === true,
          };
        })
        .filter(
          (entry): entry is Ch1LedgerState["entries"][number] =>
            entry !== undefined
        )
        .filter(
          (entry, index, all) =>
            all.findIndex(
              (candidate) => candidate.fragmentId === entry.fragmentId
            ) === index
        )
    : [];
  const links: Ch1LedgerState["links"] = Array.isArray(rawLedger.links)
    ? rawLedger.links
        .filter(
          (link): link is [string, string] =>
            Array.isArray(link) &&
            link.length === 2 &&
            knownFragmentIds.has(String(link[0])) &&
            knownFragmentIds.has(String(link[1]))
        )
        .map((link) => [String(link[0]), String(link[1])] as const)
    : [];
  const rawSkills =
    value.latentSkills && typeof value.latentSkills === "object"
      ? (value.latentSkills as Record<string, unknown>)
      : {};
  const knownSkillIds = new Set<string>(CH1_LATENT_SKILL_IDS);
  const unlocked = uniqueStrings(rawSkills.unlocked).filter(
    (skill): skill is Ch1LatentSkillId => knownSkillIds.has(skill)
  );
  const rawSkillUses =
    value.latentSkillLastUsedAtMs &&
    typeof value.latentSkillLastUsedAtMs === "object"
      ? (value.latentSkillLastUsedAtMs as Record<string, unknown>)
      : {};
  const latentSkillLastUsedAtMs: Partial<Record<Ch1LatentSkillId, number>> = {};
  for (const skillId of CH1_LATENT_SKILL_IDS) {
    const usedAtMs = Number(rawSkillUses[skillId]);
    if (Number.isFinite(usedAtMs) && usedAtMs > 0) {
      latentSkillLastUsedAtMs[skillId] = usedAtMs;
    }
  }
  const rawLastSkillUse =
    value.lastLatentSkillUse && typeof value.lastLatentSkillUse === "object"
      ? (value.lastLatentSkillUse as Record<string, unknown>)
      : undefined;
  const lastSkillId = String(rawLastSkillUse?.skillId ?? "");
  const lastSkillUsedAtMs = Number(rawLastSkillUse?.usedAtMs);
  const lastSkillResult = String(rawLastSkillUse?.result ?? "");
  const rawAugur =
    value.augur9 && typeof value.augur9 === "object"
      ? (value.augur9 as Record<string, unknown>)
      : {};
  const charge = Number(rawAugur.charge);
  const ending = CH1_ENDINGS.includes(value.ending as Ch1Ending)
    ? (value.ending as Ch1Ending)
    : undefined;
  const hallrChoice =
    value.hallrChoice === "let_run" || value.hallrChoice === "hold_stall"
      ? value.hallrChoice
      : undefined;
  const dungeonSurvival = normalizeCh1DungeonSurvivalState(
    value.dungeonSurvival
  );
  const activeDungeonInstanceId = stringOrUndefined(
    value.activeDungeonInstanceId
  );
  const activeDungeonPartyId = stringOrUndefined(value.activeDungeonPartyId);
  const chosenName = stringOrUndefined(value.chosenName);
  return {
    activeDungeonRunId: stringOrUndefined(value.activeDungeonRunId),
    ...(activeDungeonInstanceId ? { activeDungeonInstanceId } : {}),
    ...(activeDungeonPartyId ? { activeDungeonPartyId } : {}),
    ...(chosenName ? { chosenName } : {}),
    activeGateId: stringOrUndefined(value.activeGateId),
    activeRunStartedMs: Number.isFinite(started) ? started : undefined,
    returnPosition: finiteVec3(value.returnPosition),
    completionFlags: uniqueStrings(value.completionFlags),
    flags: uniqueStrings(value.flags),
    tracks,
    ledger: {
      entries,
      links,
      linkingUnlocked: rawLedger.linkingUnlocked === true,
      consolidated: rawLedger.consolidated === true,
    },
    latentSkills: { unlocked },
    latentSkillLastUsedAtMs,
    ...(knownSkillIds.has(lastSkillId) &&
    Number.isFinite(lastSkillUsedAtMs) &&
    lastSkillResult
      ? {
          lastLatentSkillUse: {
            skillId: lastSkillId as Ch1LatentSkillId,
            usedAtMs: lastSkillUsedAtMs,
            result: lastSkillResult,
          },
        }
      : {}),
    testimonies: uniqueStrings(value.testimonies),
    augur9: {
      charge: Number.isFinite(charge)
        ? Math.max(0, Math.min(100, charge))
        : defaults.augur9.charge,
      shutDown: rawAugur.shutDown === true,
      playedLogIds: uniqueStrings(rawAugur.playedLogIds).filter((fragmentId) =>
        knownFragmentIds.has(fragmentId)
      ),
    },
    availablePlaybackIds: uniqueStrings(value.availablePlaybackIds).filter(
      (fragmentId) => knownFragmentIds.has(fragmentId)
    ),
    ending,
    hallrChoice,
    ...(dungeonSurvival ? { dungeonSurvival } : {}),
    appliedObjectiveEffects: uniqueStrings(value.appliedObjectiveEffects),
  };
}

export interface Ch1NativeChallengeProgress {
  inProgress: ReadonlySet<number>;
  complete: ReadonlySet<number>;
}

/**
 * Persistent Mouths become available from native challenge progress, not a
 * client toggle. Desert opens once Act 3 has begun (Act 2 is complete); winter
 * opens once Act 5 has begun (Act 4 is complete). Completed later quests keep
 * those persistent gates visible on return visits.
 */
export function ch1ActiveDungeonGateIdsFromNativeChallenges(
  progress: Ch1NativeChallengeProgress
): string[] {
  let highestReachedAct = 0;
  for (const quest of CH1_QUESTS) {
    const challengeId = ch1NativeQuestId(quest.id);
    if (
      challengeId !== undefined &&
      (progress.inProgress.has(challengeId) ||
        progress.complete.has(challengeId))
    ) {
      highestReachedAct = Math.max(highestReachedAct, quest.act);
    }
  }
  const active: string[] = [];
  if (highestReachedAct >= 3) active.push("ch1_gate_desert");
  if (highestReachedAct >= 5) active.push("ch1_gate_winter");
  return active;
}

export type ProvisioningKey =
  | "water"
  | "food"
  | "cooked"
  | "forage"
  | "light"
  | "repair_kit"
  | "bandage"
  | "fuel"
  | "cold_gear"
  | "rope"
  | "iron";

const PROVISIONING_ITEM_MATCHERS: Readonly<
  Record<ProvisioningKey, readonly RegExp[]>
> = {
  water: [/^water$/, /clean_water/, /water_flask/, /canteen/],
  food: [/keeping_bread/, /^bread$/, /trail_ration/, /dried_/, /food_stock/],
  cooked: [
    /worker_meal/,
    /cooked/,
    /roast/,
    /stew/,
    /soup/,
    /burger/,
    /sashimi/,
  ],
  forage: [/forage/, /herb_bundle/, /berr/, /mushroom/, /edible_root/],
  light: [/^torch$/, /_torch$/, /lantern/, /glowstick/],
  repair_kit: [/^repair_kit$/, /road_repair_kit/, /field_repair_kit/],
  bandage: [/^bandage$/, /field_medkit/, /field_medicine/, /medical_kit/],
  fuel: [/^fuel$/, /^coal$/, /charcoal/, /firewood/, /lamp_oil/],
  cold_gear: [/cold_gear/, /cold_weather/, /winter_/, /insulated_/, /fur_coat/],
  rope: [/^rope$/, /_rope$/, /rope_coil/],
  iron: [/^iron$/, /iron_ingot/, /iron_ore/, /iron_stock/, /cold_iron_scrap/],
};

export function ch1ProvisioningKeyForItemId(
  rawItemId: string
): ProvisioningKey | undefined {
  // Live-mode inventory normally projects native stacks back to semantic
  // Harthmere ids. During rolling upgrades and old saves, however, a stack can
  // still be spelled as `b:<BiomesId>`. Resolve that spelling through the
  // checked-in native identity manifest before matching categories; otherwise
  // the same water/coal stack could pass at the gate and disappear from the
  // survival budget after the next native inventory projection.
  const nativeId = harthmereNativeBiomesIdForItemId(rawItemId);
  const itemId = (
    (nativeId !== undefined
      ? harthmereNativeItemIdForBiomesId(nativeId)
      : undefined) ?? rawItemId
  ).toLowerCase();
  for (const [key, matchers] of Object.entries(
    PROVISIONING_ITEM_MATCHERS
  ) as Array<[ProvisioningKey, readonly RegExp[]]>) {
    if (itemId === key || matchers.some((matcher) => matcher.test(itemId))) {
      return key;
    }
  }
}

/**
 * Convert the real server inventory into the narrative provisioning keys used
 * by ch1CheckProvisioning(). Categories are deliberately disjoint enough that
 * one generic item cannot satisfy the entire pack check.
 */
export function ch1ProvisioningCarriedFromInventory(
  items: Readonly<Record<string, number>>
): Record<string, number> {
  const carried: Record<string, number> = {};
  for (const key of Object.keys(
    PROVISIONING_ITEM_MATCHERS
  ) as ProvisioningKey[]) {
    carried[key] = 0;
  }
  for (const [rawItemId, rawCount] of Object.entries(items)) {
    const count = Math.max(0, Math.floor(Number(rawCount) || 0));
    if (count === 0) continue;
    const key = ch1ProvisioningKeyForItemId(rawItemId);
    if (key) carried[key] += count;
  }
  return carried;
}

/**
 * Consume a dungeon-reserved resource from the real persisted inventory.
 * Matching is deterministic so retries and tests remove the same stacks. A
 * partial consume is allowed: the mechanics reducer converts any shortfall to
 * health/stamina loss instead of silently creating supplies.
 */
export function ch1ConsumeProvisioningResourceFromInventory(
  items: Record<string, number>,
  key: Ch1DungeonResourceKey,
  requested: number
) {
  let remaining = Math.max(0, Math.trunc(Number(requested) || 0));
  const consumed: Record<string, number> = {};
  for (const itemId of Object.keys(items).sort()) {
    if (remaining <= 0) break;
    if (ch1ProvisioningKeyForItemId(itemId) !== key) continue;
    const available = Math.max(0, Math.trunc(Number(items[itemId]) || 0));
    const take = Math.min(available, remaining);
    if (take <= 0) continue;
    const next = available - take;
    if (next <= 0) delete items[itemId];
    else items[itemId] = next;
    consumed[itemId] = take;
    remaining -= take;
  }
  return {
    consumed,
    consumedCount: Math.max(0, Math.trunc(requested)) - remaining,
    missingCount: remaining,
  };
}

export function ch1InventoryItemIds(
  items: Readonly<Record<string, number>>
): string[] {
  return Object.entries(items)
    .filter(([, count]) => Number(count) > 0)
    .map(([itemId]) => itemId);
}

/**
 * Dungeon exits retrieve people as well as objects. Person retrievals are
 * durable story facts, not inventory stacks; treating every retrieval as an
 * item made both production exits impossible while the E2E item bypass hid
 * the problem.
 */
export function ch1LiveRetrievalIds(
  runtime: Ch1LiveGateRuntimeState,
  items: Readonly<Record<string, number>>
): string[] {
  const ids = new Set(ch1InventoryItemIds(items));
  const flags = new Set(runtime.flags);
  if (flags.has(CH1_FLAGS.irisRescued)) ids.add("npc_iris_fen");
  if (flags.has(CH1_FLAGS.marrowSaved)) ids.add("npc_marrow");
  if (flags.has(CH1_FLAGS.hasLedger) && flags.has(CH1_FLAGS.sorrelOathGiven)) {
    ids.add("npc_nadia_sorrel");
  }
  return [...ids];
}
