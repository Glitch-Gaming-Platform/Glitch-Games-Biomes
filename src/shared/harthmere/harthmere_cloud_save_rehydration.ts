// HARTHMERE_CLOUD_SAVE_REHYDRATION
//
// Why players lose everything on deployment, and the fix.
//
// EVIDENCE (HAR, 2026-07-25 session): the live client reads quest/leveling/
// status state from the SERVER — `/api/harthmere/live_mode_quest_state` was
// polled 54 times, `live_mode_player_status_state` 120 times, all keyed by
// actor `glitch:43af071c-…` in Redis. The Glitch bridge (`/api/glitch/
// harthmere`, 301 calls) restores the latest cloud save ON BOOT — but only
// into the BROWSER's localStorage compatibility cache
// (harthmere_glitch_bridge.ts applySnapshot()). Nothing pushes that restored
// snapshot back into the freshly-reset server Redis. Server-authoritative
// reads then return empty state, the HUD and journal render a fresh player,
// and the restored localStorage is treated as stale. The cloud save exists
// the whole time; the player just never sees it again.
//
// FIX: server-side rehydration. When a live-mode read or write finds NO
// player record for a resolved actor, and the actor is login-backed (not a
// guest — Glitch returns GUEST_NOT_ALLOWED for guest saves), the server
// fetches the latest valid cloud save through the existing title-token path
// (src/pages/api/glitch/harthmere.ts already lists and decodes saves) and
// seeds the Redis player record from the snapshot BEFORE serving the read.
// This honors the documented authority model: "Glitch Cloud Save is the
// durable player record; Redis is resettable" — by making Redis actually
// rebuild itself from the durable record instead of merely allowing the
// browser cache to.
//
// This module is the pure, testable core: the rehydration decision, the
// snapshot -> player-record projection, and the safety rails. The server
// endpoint calls these inside its existing WATCH/MULTI transaction (per the
// v200 lost-update lesson: per-request duplicated tx connection).

export const HARTHMERE_CLOUD_SAVE_REHYDRATION_VERSION =
  "harthmere-cloud-save-rehydration-v1" as const;

/**
 * Payload versions observed in production. The `-v1` spelling was shipped
 * before the current stable name and still exists in real player saves; a
 * restore path that accepts only the newest spelling silently strands those
 * saves after a deployment.
 */
export const HARTHMERE_CLOUD_SAVE_PAYLOAD_VERSIONS = new Set([
  "harthmere-glitch-save",
  "harthmere-glitch-save-v1",
]);

/** localStorage keys inside the save payload that carry server-owned state. */
export const HARTHMERE_REHYDRATION_SOURCE_KEYS = {
  questState: "biomes.localDev.harthmere.questState",
  snapshotGroveQuestState: "biomes.localDev.snapshotGroveQuestState",
  snapshotMissionState: "biomes.localDev.snapshotMissionState",
  levelingState: "biomes.localDev.harthmere.levelingState",
  inventoryState: "biomes.localDev.harthmere.inventoryState",
  economyState: "biomes.localDev.harthmere.economyState",
  reputationState: "biomes.localDev.harthmere.reputationState",
} as const;

export interface HarthmereRehydrationDecisionInput {
  /** Does Redis already hold a player record for this actor? */
  playerRecordExists: boolean;
  /** Is the record non-trivial (any quest, xp, or inventory content)? */
  playerRecordHasProgress: boolean;
  /** Guest installs have no cloud saves (GUEST_NOT_ALLOWED). */
  isGuest: boolean;
  /** Decoded latest cloud save, if the fetch succeeded. */
  cloudSave?: {
    version: number;
    payloadVersion: string;
    schemaVersion?: string;
    storage: Readonly<Record<string, string>>;
    serverPlayerState?: Readonly<Record<string, unknown>>;
  };
  /**
   * Marker written into the player record after a successful rehydration so
   * a record that is legitimately empty (brand-new player who saved once,
   * then reset their own progress) is not endlessly re-seeded.
   */
  alreadyRehydratedFromVersion?: number;
}

export type HarthmereRehydrationDecision =
  | { rehydrate: true; fromVersion: number }
  | { rehydrate: false; reason: string };

const ACCEPTED_SCHEMA_VERSIONS = new Set([
  "harthmere-glitch-save",
  "harthmere-glitch-save-all-state",
  "harthmere-glitch-save-all-state-v153",
]);

export function isAcceptedHarthmereCloudSavePayloadVersion(value: unknown) {
  return (
    typeof value === "string" &&
    HARTHMERE_CLOUD_SAVE_PAYLOAD_VERSIONS.has(value)
  );
}

/**
 * Rehydrate only when it cannot destroy anything: the record must be missing
 * or empty, the actor must be login-backed, and the save must be valid and
 * not already applied. Live progress always wins over an old snapshot —
 * this is a disaster-recovery path, not a sync channel.
 */
export function decideHarthmereRehydration(
  input: HarthmereRehydrationDecisionInput
): HarthmereRehydrationDecision {
  if (input.isGuest) {
    return { rehydrate: false, reason: "guest installs have no cloud saves" };
  }
  if (input.playerRecordExists && input.playerRecordHasProgress) {
    return {
      rehydrate: false,
      reason: "live record has progress; live state always wins",
    };
  }
  const save = input.cloudSave;
  if (!save) {
    return { rehydrate: false, reason: "no valid cloud save available" };
  }
  if (!isAcceptedHarthmereCloudSavePayloadVersion(save.payloadVersion)) {
    return {
      rehydrate: false,
      reason: `unknown save payload "${save.payloadVersion}"`,
    };
  }
  if (
    save.schemaVersion !== undefined &&
    !ACCEPTED_SCHEMA_VERSIONS.has(save.schemaVersion) &&
    !save.schemaVersion.startsWith("harthmere-glitch-save-all-state-v")
  ) {
    return {
      rehydrate: false,
      reason: `unknown save schema "${save.schemaVersion}"`,
    };
  }
  if (
    input.alreadyRehydratedFromVersion !== undefined &&
    input.alreadyRehydratedFromVersion >= save.version
  ) {
    return {
      rehydrate: false,
      reason:
        "this save version was already applied; an empty record after that " +
        "is the player's own doing",
    };
  }
  if (
    !harthmereServerPlayerStateHasMeaningfulProgress(save.serverPlayerState) &&
    !harthmereSnapshotHasMeaningfulProgress(save.storage)
  ) {
    return { rehydrate: false, reason: "cloud save holds no progress" };
  }
  return { rehydrate: true, fromVersion: save.version };
}

function cloudSaveStorageKeyMatches(key: string, exactKey: string) {
  if (!key.startsWith(exactKey)) return false;
  const suffix = key.slice(exactKey.length);
  return (
    suffix === "" ||
    /^\.user\..+$/.test(suffix) ||
    /^\.v\d+(?:\.user\..+)?$/.test(suffix)
  );
}

export function harthmereCloudSaveJsonRecords(
  storage: Readonly<Record<string, string>>,
  key: string
): Array<{ key: string; value: Record<string, unknown> }> {
  const records: Array<{ key: string; value: Record<string, unknown> }> = [];
  for (const [candidateKey, raw] of Object.entries(storage)) {
    if (
      !cloudSaveStorageKeyMatches(candidateKey, key) ||
      typeof raw !== "string" ||
      raw.length === 0
    ) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        records.push({
          key: candidateKey,
          value: parsed as Record<string, unknown>,
        });
      }
    } catch {
      // A corrupt optional section must not make the rest of the save unusable.
    }
  }
  return records;
}

function parseJsonRecord(
  storage: Readonly<Record<string, string>>,
  key: string
): Record<string, unknown> | undefined {
  return harthmereCloudSaveJsonRecords(storage, key)[0]?.value;
}

function recordSize(value: unknown) {
  if (Array.isArray(value)) return value.length;
  return value && typeof value === "object" ? Object.keys(value).length : 0;
}

export function harthmereServerPlayerStateHasMeaningfulProgress(
  value: Readonly<Record<string, unknown>> | undefined
) {
  if (!value) return false;
  const inventory = value.inventory as Record<string, unknown> | undefined;
  const classMagic = value.classMagic as Record<string, unknown> | undefined;
  const skills = classMagic?.skills as Record<string, unknown> | undefined;
  const characterLevel = skills?.character_level as
    | Record<string, unknown>
    | undefined;
  const quests = value.quests as Record<string, unknown> | undefined;
  const activeQuests = quests?.active as Record<string, unknown> | undefined;
  const banking = value.banking as Record<string, unknown> | undefined;
  // NB: annotate the accumulator. `Object.values()` on a Record<string,
  // unknown> gives unknown[], so an unannotated reduce infers `sum: unknown`
  // and every arithmetic use of it fails under strict mode.
  const skillXp = Object.values(skills ?? {}).reduce<number>(
    (sum, skill) =>
      sum +
      Math.max(
        0,
        Number((skill as Record<string, unknown> | undefined)?.xp ?? 0) || 0
      ),
    0
  );
  const activeQuestProgress = Object.values(activeQuests ?? {}).some(
    (quest) =>
      Math.max(
        0,
        Number(
          (quest as Record<string, unknown> | undefined)?.progress ?? 0
        ) || 0
      ) > 0
  );
  return (
    recordSize(inventory?.items) > 0 ||
    recordSize(inventory?.bank) > 0 ||
    recordSize(inventory?.equipment) > 0 ||
    Number(inventory?.gold ?? 0) > 0 ||
    Number(characterLevel?.level ?? 1) > 1 ||
    Number(characterLevel?.xp ?? 0) > 0 ||
    skillXp > 0 ||
    recordSize(quests?.completed) > 0 ||
    recordSize(quests?.active) > 2 ||
    activeQuestProgress ||
    recordSize(banking?.materialStorage) > 0 ||
    recordSize(
      (value.collections as Record<string, unknown> | undefined)?.discovered
    ) > 0 ||
    recordSize(
      (value.property as Record<string, unknown> | undefined)?.owned
    ) > 0 ||
    recordSize(
      (value.building as Record<string, unknown> | undefined)?.ownedPlots
    ) > 0 ||
    recordSize(
      (value.progression as Record<string, unknown> | undefined)
        ?.completedMilestones
    ) > 0 ||
    recordSize(
      (value.daily as Record<string, unknown> | undefined)?.completedTasks
    ) > 0
  );
}

export function harthmereSnapshotHasMeaningfulProgress(
  storage: Readonly<Record<string, string>>
): boolean {
  const questRecords = harthmereCloudSaveJsonRecords(
    storage,
    HARTHMERE_REHYDRATION_SOURCE_KEYS.questState
  ).map((entry) => entry.value);
  const groveRecords = harthmereCloudSaveJsonRecords(
    storage,
    HARTHMERE_REHYDRATION_SOURCE_KEYS.snapshotGroveQuestState
  ).map((entry) => entry.value);
  const levelingRecords = harthmereCloudSaveJsonRecords(
    storage,
    HARTHMERE_REHYDRATION_SOURCE_KEYS.levelingState
  ).map((entry) => entry.value);
  const inventoryRecords = harthmereCloudSaveJsonRecords(
    storage,
    HARTHMERE_REHYDRATION_SOURCE_KEYS.inventoryState
  ).map((entry) => entry.value);
  const questCount =
    questRecords.reduce(
      (sum, quests) =>
        sum + recordSize(quests.active) + recordSize(quests.completed),
      0
    ) +
    groveRecords.reduce(
      (sum, grove) =>
        sum +
        recordSize(grove.acceptedQuestIds) +
        recordSize(grove.completedQuestIds) +
        recordSize(grove.completedObjectiveIds),
      0
    );
  const xp = Math.max(
    0,
    ...levelingRecords.map((leveling) => Number(leveling.xpCurrent ?? 0))
  );
  const level = Math.max(
    1,
    ...levelingRecords.map((leveling) => Number(leveling.level ?? 1))
  );
  const inventoryCount = inventoryRecords.reduce((sum, inventory) => {
    const backpack = inventory.backpack as { items?: unknown[] } | undefined;
    const questPouch = inventory.questPouch as unknown[] | undefined;
    return (
      sum +
      (Array.isArray(backpack?.items) ? backpack.items.length : 0) +
      (Array.isArray(questPouch) ? questPouch.length : 0) +
      recordSize(inventory.materialStorage) +
      Number(
        (inventory.wallet as Record<string, unknown> | undefined)?.gold ?? 0
      )
    );
  }, 0);
  return questCount > 0 || xp > 0 || level > 1 || inventoryCount > 0;
}

// ---------------------------------------------------------------------------
// Projection: cloud snapshot -> live-mode player record seed
// ---------------------------------------------------------------------------

export interface HarthmereRehydratedPlayerSeed {
  /** Raw JSON strings, keyed by the live-mode record field they seed. */
  questState?: Record<string, unknown>;
  snapshotGroveQuestState?: Record<string, unknown>;
  snapshotMissionState?: Record<string, unknown>;
  levelingState?: Record<string, unknown>;
  inventoryState?: Record<string, unknown>;
  economyState?: Record<string, unknown>;
  reputationState?: Record<string, unknown>;
  /** Version marker preventing repeat application. */
  rehydratedFromCloudSaveVersion: number;
  rehydratedAtMs: number;
}

/**
 * Projects the snapshot into a seed. Unparseable sections are dropped rather
 * than failing the whole rehydration — a corrupt reputation blob must not
 * cost the player their quest log.
 */
export function projectHarthmereCloudSaveToPlayerSeed(args: {
  storage: Readonly<Record<string, string>>;
  saveVersion: number;
  nowMs: number;
}): HarthmereRehydratedPlayerSeed {
  const k = HARTHMERE_REHYDRATION_SOURCE_KEYS;
  return {
    questState: parseJsonRecord(args.storage, k.questState),
    snapshotGroveQuestState: parseJsonRecord(
      args.storage,
      k.snapshotGroveQuestState
    ),
    snapshotMissionState: parseJsonRecord(args.storage, k.snapshotMissionState),
    levelingState: parseJsonRecord(args.storage, k.levelingState),
    inventoryState: parseJsonRecord(args.storage, k.inventoryState),
    economyState: parseJsonRecord(args.storage, k.economyState),
    reputationState: parseJsonRecord(args.storage, k.reputationState),
    rehydratedFromCloudSaveVersion: args.saveVersion,
    rehydratedAtMs: args.nowMs,
  };
}

/**
 * Chapter 1 note: ch1 flags/tracks/ledger ride inside questState (they are
 * plain records under the `ch1_` prefix), so rehydration carries the new
 * chapter automatically. This helper is used by tests to prove that.
 */
export function harthmereSeedCarriesChapter1(
  seed: HarthmereRehydratedPlayerSeed
): boolean {
  const quests = seed.questState;
  if (!quests) {
    return false;
  }
  const flags = (quests.ch1Flags as string[] | undefined) ?? [];
  const ledger = quests.ch1Ledger as { entries?: unknown[] } | undefined;
  return flags.length > 0 || (ledger?.entries?.length ?? 0) > 0;
}
