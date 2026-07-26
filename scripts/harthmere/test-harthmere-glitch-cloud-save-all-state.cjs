#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));
let failures = 0;
function check(name, condition) {
  if (condition) {
    console.log(`OK ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name}`);
  }
}
function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}
function sectionBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  if (start < 0) return "";
  const end = source.indexOf(endToken, start + startToken.length);
  return source.slice(start, end < 0 ? undefined : end);
}
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}
function isIsoDateString(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
function isUuidLike(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

const bridgePath = "src/client/game/glitch/harthmere_glitch_bridge.ts";
const harthmereEventsPath =
  "src/client/components/challenges/harthmereEvents.ts";
const proxyPath = "src/pages/api/glitch/harthmere.ts";
const payloadPath = "src/server/harthmere/glitch_cloud_save_payload.ts";
const rehydrationPath = "src/server/harthmere/glitch_cloud_save_rehydration.ts";
const kvTransportPath =
  "src/client/util/storage/glitch_cloud_save_transport.ts";
const wakePath = "src/client/components/WakeUpScreen.tsx";
const deployPath = "scripts/glitch/deploy-production-local-redis-smoke.sh";
const bridge = exists(bridgePath) ? read(bridgePath) : "";
const harthmereEvents = exists(harthmereEventsPath)
  ? read(harthmereEventsPath)
  : "";
const proxy = exists(proxyPath) ? read(proxyPath) : "";
const payloadRules = exists(payloadPath) ? read(payloadPath) : "";
const rehydration = exists(rehydrationPath) ? read(rehydrationPath) : "";
const kvTransport = exists(kvTransportPath) ? read(kvTransportPath) : "";
const wake = exists(wakePath) ? read(wakePath) : "";
const deploy = exists(deployPath) ? read(deployPath) : "";

const canonicalEventContracts = new Map([
  ["biomes:harthmere-inventory-changed", "HARTHMERE_INVENTORY_EVENT"],
]);

function includesEventContract(source, eventName) {
  if (source.includes(eventName)) return true;
  const contractName = canonicalEventContracts.get(eventName);
  return Boolean(
    contractName &&
      source.includes(contractName) &&
      harthmereEvents.includes(`export const ${contractName}`) &&
      harthmereEvents.includes(`"${eventName}"`)
  );
}

const requiredExactKeys = [
  [
    "active user scope",
    "biomes.localDev.harthmere.activeUserScope",
    "src/client/components/challenges/LocalDevHarthmereUserScope.ts",
  ],
  [
    "level/xp state",
    "biomes.localDev.harthmere.levelingState",
    "src/client/components/challenges/LocalDevHarthmereLevelingSystem.tsx",
  ],
  [
    "quest state",
    "biomes.localDev.harthmere.questState",
    "src/client/components/challenges/LocalDevHarthmereQuests.tsx",
  ],
  [
    "snapshot Grove quest state",
    "biomes.localDev.snapshotGroveQuestState",
    "src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx",
  ],
  [
    "snapshot Grove likeability state",
    "biomes.localDev.snapshotGroveLikeability",
    "src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx",
  ],
  [
    "snapshot Road Ahead mission state",
    "biomes.localDev.snapshotMissionState",
    "src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx",
  ],
  [
    "snapshot Road Ahead mission event log",
    "biomes.localDev.snapshotMissionEvents",
    "src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx",
  ],
  [
    "snapshot Road Ahead mission rewards",
    "biomes.localDev.snapshotMissionRewards",
    "src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx",
  ],
  [
    "tracked missions",
    "biomes.localDev.harthmere.trackedMissions",
    "src/client/components/challenges/LocalDevHarthmereMissionSystem.tsx",
  ],
  [
    "mission event log",
    "biomes.localDev.harthmere.missionEvents",
    "src/client/components/challenges/LocalDevHarthmereQuests.tsx",
  ],
  [
    "inventory, equipment, wallet, bank, keyring, material storage",
    "biomes.localDev.harthmere.inventoryState",
    "src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx",
  ],
  [
    "combat state",
    "biomes.localDev.harthmere.combatState",
    "src/client/components/challenges/LocalDevHarthmereCombat.tsx",
  ],
  [
    "death/respawn state",
    "biomes.localDev.harthmere.deathState",
    "src/client/components/challenges/LocalDevHarthmereDeathSystem.tsx",
  ],
  [
    "class and skill state",
    "biomes.localDev.harthmere.classSkillState",
    "src/client/components/challenges/LocalDevHarthmereClassSkillSystem.tsx",
  ],
  [
    "building/property state",
    "biomes.localDev.harthmere.buildingState",
    "src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx",
  ],
  [
    "economy state",
    "biomes.localDev.harthmere.economyState",
    "src/client/components/challenges/LocalDevHarthmereEconomySystem.tsx",
  ],
  [
    "gathering state",
    "biomes.localDev.harthmere.gatheringState",
    "src/client/components/challenges/LocalDevHarthmereGatheringSystem.tsx",
  ],
  [
    "guild state",
    "biomes.localDev.harthmere.guildState",
    "src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx",
  ],
  [
    "quest economy state",
    "biomes.localDev.harthmere.questEconomyState",
    "src/client/components/challenges/LocalDevHarthmereQuestEconomySystem.ts",
  ],
  [
    "reputation state",
    "biomes.localDev.harthmere.reputation",
    "src/client/components/challenges/LocalDevHarthmereReputation.tsx",
  ],
  [
    "hardened economy reputation mirror",
    "biomes.localDev.harthmere.reputationState",
    "src/client/components/challenges/LocalDevHarthmereEconomyHardening.ts",
  ],
  [
    "vendor stock state",
    "biomes.localDev.harthmere.vendorStockState",
    "src/client/components/challenges/LocalDevHarthmereVendorCatalog.ts",
  ],
  [
    "storage/mail/recovery state",
    "biomes.localDev.harthmere.storageMailRecoveryState",
    "src/client/components/challenges/LocalDevHarthmereStorageMailRecoverySystem.tsx",
  ],
  [
    "trade/auction state",
    "biomes.localDev.harthmere.tradeAuctionState",
    "src/client/components/challenges/LocalDevHarthmereTradeAuctionSystem.tsx",
  ],
  [
    "mount/pet collection state",
    "biomes.localDev.harthmere.mountPetCollection",
    "src/client/components/challenges/LocalDevHarthmereMountPetCollections.tsx",
  ],
  [
    "mount/pet recent state",
    "biomes.localDev.harthmere.mountPetCollection.recent",
    "src/client/components/challenges/LocalDevHarthmereMountPetCollections.tsx",
  ],
  [
    "multiplayer combat state",
    "biomes.localDev.harthmere.multiplayerCombatState",
    "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx",
  ],
  [
    "dialogue memory",
    "biomes.localDev.harthmere.dialogueMemory",
    "src/client/components/challenges/LocalDevHarthmereDialogueSystem.tsx",
  ],
  [
    "dialogue safety",
    "biomes.localDev.harthmere.dialogueSafety",
    "src/client/components/challenges/LocalDevHarthmereDialogueSafetySystem.tsx",
  ],
  [
    "food/stamina state",
    "biomes.localDev.harthmere.foodStaminaState",
    "src/client/components/challenges/LocalDevHarthmereFoodStaminaSystem.tsx",
  ],
  [
    "rapid economy action throttle state",
    "biomes.localDev.harthmere.rapidEconomyActions",
    "src/client/components/challenges/LocalDevHarthmereEconomyHardening.ts",
  ],
  [
    "pending vendor trade request state",
    "biomes.localDev.harthmere.pendingVendorTrade",
    "src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx",
  ],
  [
    "NPC AI memory state",
    "biomes.localDev.harthmere.npcAi.memory",
    "src/client/components/challenges/LocalDevHarthmereNpcAiSystem.ts",
  ],
  [
    "NPC AI decision log state",
    "biomes.localDev.harthmere.npcAi.decisionLog",
    "src/client/components/challenges/LocalDevHarthmereNpcAiSystem.ts",
  ],
  [
    "NPC AI debug state",
    "biomes.localDev.harthmere.npcAi.debug",
    "src/client/components/challenges/LocalDevHarthmereNpcAiSystem.ts",
  ],
  [
    "live entity robot energy state",
    "biomes.localDev.liveEntityRobotEnergy",
    "src/client/components/challenges/LocalDevLiveEntityRobotEnergyState.ts",
  ],
  [
    "live entity helper quest state",
    "biomes.localDev.liveEntityHelperQuests",
    "src/shared/harthmere/live_entity_helper_quests.ts",
  ],
  [
    "snapshot combat runtime state",
    "biomes.localDev.snapshotCombatState",
    "src/client/components/challenges/LocalDevSnapshotCombatRuntime.tsx",
  ],
];

const requiredScopedPrefixes = [
  [
    "scoped face customization",
    "biomes.localDev.harthmere.playerFace.user.",
    "src/shared/harthmere/voxel_faces.ts",
  ],
  [
    "scoped body customization",
    "biomes.localDev.harthmere.playerBody.user.",
    "src/shared/harthmere/voxel_faces.ts",
  ],
  [
    "scoped clothing customization",
    "biomes.localDev.harthmere.playerClothing.user.",
    "src/shared/harthmere/voxel_faces.ts",
  ],
  [
    "scoped food/stamina state",
    "biomes.localDev.harthmere.foodStaminaState.user.",
    "src/client/components/challenges/LocalDevHarthmereFoodStaminaSystem.tsx",
  ],
  [
    "scoped live entity robot energy state",
    "biomes.localDev.liveEntityRobotEnergy.user.",
    "src/client/components/challenges/LocalDevLiveEntityRobotEnergyState.ts",
  ],
  [
    "scoped live entity helper quest state",
    "biomes.localDev.liveEntityHelperQuests.user.",
    "src/shared/harthmere/live_entity_helper_quests.ts",
  ],
  [
    "scoped snapshot complete port state",
    "biomes.localDev.snapshotCompletePortState.snapshot-per-player-mission-state.",
    "src/client/components/challenges/LocalDevSnapshotCompletePort.tsx",
  ],
  [
    "scoped snapshot photo proofs",
    "biomes.localDev.snapshotPhotoProofs.snapshot-per-player-mission-state.",
    "src/client/components/challenges/LocalDevSnapshotCompletePort.tsx",
  ],
  [
    "scoped snapshot cleared muck",
    "biomes.localDev.snapshotClearedMuck.snapshot-per-player-mission-state.",
    "src/client/components/challenges/LocalDevSnapshotCompletePort.tsx",
  ],
  [
    "scoped snapshot production pending mutations",
    "biomes.snapshot.pendingMutations.snapshot-per-player-mission-state.",
    "src/client/components/challenges/SnapshotProductionPort.tsx",
  ],
  [
    "scoped snapshot production backend sync state",
    "biomes.snapshot.lastBackendSync.snapshot-per-player-mission-state.",
    "src/client/components/challenges/SnapshotProductionPort.tsx",
  ],
];

const requiredRestoreEvents = [
  "biomes:harthmere-glitch-cloud-save-restored",
  "biomes:local-dev-snapshot-grove-quest-state",
  "biomes:local-dev-snapshot-mission-state",
  "biomes:local-dev-snapshot-combat-state",
  "biomes:local-dev-snapshot-complete-port",
  "biomes:snapshot-production-port",
  "biomes:harthmere-leveling-changed",
  "biomes:harthmere-combat-changed",
  "biomes:harthmere-death-changed",
  "biomes:harthmere-inventory-changed",
  "biomes:harthmere-quest-state-changed",
  "biomes:harthmere-mission-event",
  "biomes:harthmere-mission-tracking-changed",
  "biomes:harthmere-class-skill-changed",
  "biomes:harthmere-building-changed",
  "biomes:harthmere-economy-changed",
  "biomes:harthmere-gathering-changed",
  "biomes:harthmere-guild-changed",
  "biomes:harthmere-quest-economy-changed",
  "biomes:harthmere-reputation-changed",
  "biomes:harthmere-storage-mail-recovery-changed",
  "biomes:harthmere-trade-auction-changed",
  "biomes:harthmere-dialogue-changed",
  "biomes:harthmere-multiplayer-combat-changed",
  "biomes:harthmere-food-stamina-changed",
  "biomes:live-entity-robot-energy",
  "biomes:live-entity-helper-quest",
];

const requiredCloudSaveRequestFields = [
  ["slot_index", "number"],
  ["payload", "string"],
  ["checksum", "string"],
  ["base_version", "number"],
  ["save_type", "string"],
  ["client_timestamp", "string"],
  ["slot_name", "string"],
  ["metadata", "object"],
  ["device_id", "string"],
  ["platform", "string"],
  ["game_version", "string"],
  ["last_played_at", "string"],
  ["play_duration_seconds", "number"],
];

const requiredDecodedPayloadFields = [
  ["version", "string"],
  ["schemaAuditVersion", "string"],
  ["savedAt", "string"],
  ["titleId", "string"],
  ["installId", "string"],
  ["identity", "object"],
  ["metadata", "object"],
  ["localStorage", "object"],
];

const requiredPayloadMetadataFields = [
  ["level", "number"],
  ["xpCurrent", "number"],
  ["completedQuestCount", "number"],
  ["gold", "number"],
  ["inventoryItems", "number"],
  ["defeatedEnemies", "number"],
  ["playtimeSeconds", "number"],
  ["storageKeyCount", "number"],
  ["storageAuthority", "string"],
];

const requiredIdentityFields = [
  ["source", "string"],
  ["titleId", "string"],
  ["installId", "string"],
  ["sessionId", "string"],
  ["serverSessionId", "string"],
  ["gameUserId", "string"],
  ["glitchUserId", "string"],
  ["userName", "string"],
  ["validatedAt", "string"],
];

console.log("== Harthmere Glitch Cloud Save all-state guardrail current ==");
console.log(`Root: ${root}\n`);

check("Glitch bridge source exists", !!bridge);
check("Glitch server proxy source exists", !!proxy);
check(
  "bridge declares current save schema marker",
  bridge.includes("harthmere-glitch-save-all-state")
);
check(
  "bridge stores the current schema marker in each save snapshot",
  bridge.includes("schemaAuditVersion: HARTHMERE_GLITCH_SAVE_SCHEMA_VERSION")
);
check(
  "bridge declares required exact save-key manifest",
  bridge.includes("HARTHMERE_GLITCH_REQUIRED_SAVE_KEYS")
);
check(
  "bridge declares required scoped customization-prefix manifest",
  bridge.includes("HARTHMERE_GLITCH_REQUIRED_SAVE_KEY_PREFIXES")
);
check(
  "bridge declares restore event manifest",
  bridge.includes("HARTHMERE_GLITCH_RESTORE_EVENTS")
);

const exactManifest = sectionBetween(
  bridge,
  "HARTHMERE_GLITCH_REQUIRED_SAVE_KEYS",
  "] as const;"
);
for (const [label, key, sourcePath] of requiredExactKeys) {
  const source = exists(sourcePath) ? read(sourcePath) : "";
  check(`${label} source file exists`, exists(sourcePath));
  check(`${label} declares storage key ${key}`, source.includes(key));
  check(
    `${label} is listed in Glitch save-key manifest`,
    exactManifest.includes(key)
  );
}

const prefixManifest = sectionBetween(
  bridge,
  "HARTHMERE_GLITCH_REQUIRED_SAVE_KEY_PREFIXES",
  "] as const;"
);
for (const [label, keyPrefix, sourcePath] of requiredScopedPrefixes) {
  const source = exists(sourcePath) ? read(sourcePath) : "";
  const sourceNeedle = keyPrefix
    .replace(/\.user\.$/, "")
    .replace(/\.snapshot-per-player-mission-state\.$/, "");
  check(`${label} source file exists`, exists(sourcePath));
  check(
    `${label} declares scoped storage base for ${keyPrefix}`,
    source.includes(sourceNeedle)
  );
  check(
    `${label} prefix is listed in Glitch save-key prefix manifest`,
    prefixManifest.includes(keyPrefix)
  );
}

check(
  "bank data is part of inventory save state",
  read(
    "src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx"
  ).includes("bank:") &&
    read(
      "src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx"
    ).includes("transferToBank") &&
    exactManifest.includes("biomes.localDev.harthmere.inventoryState")
);
check(
  "guild bank data is part of guild save state",
  read(
    "src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx"
  ).includes("bankTabs") &&
    exactManifest.includes("biomes.localDev.harthmere.guildState")
);

check(
  "snapshot collector scans all allowed Harthmere mission localStorage keys",
  bridge.includes("function collectHarthmereStorage") &&
    bridge.includes("window.localStorage.length") &&
    bridge.includes("isHarthmereCloudSaveStorageKey(key)")
);
check(
  "cloud snapshots exclude bridge status, local install, and session identity keys",
  includesAll(bridge, [
    "HARTHMERE_GLITCH_VOLATILE_SAVE_KEYS",
    "BRIDGE_STATE_KEY",
    "LOCAL_INSTALL_ID_KEY",
    "HARTHMERE_GLITCH_IDENTITY_KEY",
    "HARTHMERE_GLITCH_VOLATILE_SAVE_KEYS.has(key)",
  ])
);
check(
  "cloud saves fingerprint durable state and skip unchanged automatic writes",
  includesAll(bridge, [
    "function cloudSaveContentFingerprint",
    "lastSavedContentFingerprint",
    'reason !== "manual"',
    "contentFingerprint === this.lastSavedContentFingerprint",
    "this.lastSavedContentFingerprint = contentFingerprint",
  ])
);
check(
  "state-change cloud saves have a minimum write interval",
  includesAll(bridge, [
    "STATE_CHANGE_AUTOSAVE_MIN_INTERVAL_MS",
    "lastSuccessfulCloudSaveAt",
    "nextAllowedSaveAt",
    "delayMs",
  ])
);
check(
  "snapshot type stores localStorage key/value dictionary",
  bridge.includes("localStorage: Record<string, string>")
);
check(
  "createSnapshot includes title/install/identity metadata and localStorage",
  includesAll(bridge, [
    "function createSnapshot",
    "collectHarthmereStorage()",
    "titleId: config.titleId",
    "installId: config.installId",
    "identity: readHarthmereGlitchIdentity()",
    "localStorage,",
  ])
);
check(
  "metadata derives player level, quests, snapshot missions, inventory, combat, playtime and Glitch Cloud Save authority",
  includesAll(bridge, [
    "function deriveMetadata",
    "levelingState",
    "questState",
    "snapshotGroveQuestState",
    "snapshotMissionState",
    "inventoryState",
    "combatState",
    "playtimeSeconds",
    "completedQuestCount",
    "inventoryItems",
    "defeatedEnemies",
    'storageAuthority: "glitchCloudSave"',
  ])
);

const applySnapshot = sectionBetween(
  bridge,
  "function applySnapshot",
  "function hasMeaningfulLocalProgress"
);
check(
  "restore rejects non-Harthmere save schema",
  applySnapshot.includes("isAcceptedHarthmereCloudSavePayloadVersion")
);
check(
  "restore writes only allowed Harthmere mission save keys",
  applySnapshot.includes("isHarthmereCloudSaveStorageKey(key)") &&
    applySnapshot.includes("window.localStorage.setItem(") &&
    applySnapshot.includes("key,")
);
check(
  "restore preserves current Biomes user scope instead of old install scope",
  includesAll(bridge, [
    "function currentCloudSaveRestoreScope",
    "key === ACTIVE_USER_SCOPE_KEY",
    "currentCloudSaveRestoreScope() ?? value",
  ])
);
check(
  "restore migrates old user-scoped outfit/state keys to current Biomes scope",
  includesAll(bridge, [
    "function migrateCloudSaveStorageKeyToCurrentScope",
    "function currentCloudSaveCustomizationScope",
    'prefix.endsWith(".user.")',
    "const nextScope =",
    "return `${prefix}${nextScope}`",
    "migrateCloudSaveStorageKeyToCurrentScope(key)",
    "migrateLegacyVersionedCloudSaveKeyToCurrentScope(key)",
    "window.localStorage.setItem(migratedKey, candidate.value)",
  ])
);
check(
  "restore dispatches the current all-system refresh events",
  applySnapshot.includes("dispatchHarthmereCloudRestoreEvents({") &&
    applySnapshot.includes("hasCharacterCustomization") &&
    applySnapshot.includes("cloudSaveVersion")
);

const restoreManifest = sectionBetween(
  bridge,
  "HARTHMERE_GLITCH_RESTORE_EVENTS",
  "] as const;"
);
check(
  "bridge imports canonical Harthmere event contracts for Cloud Save refresh",
  bridge.includes("HARTHMERE_INVENTORY_EVENT") &&
    harthmereEvents.includes("export const HARTHMERE_INVENTORY_EVENT") &&
    harthmereEvents.includes('"biomes:harthmere-inventory-changed"')
);
for (const eventName of requiredRestoreEvents) {
  check(
    `restore event manifest includes ${eventName}`,
    includesEventContract(restoreManifest, eventName)
  );
}
check(
  "restore event dispatcher loops over the manifest",
  bridge.includes("function dispatchHarthmereCloudRestoreEvents") &&
    bridge.includes(
      "for (const eventName of HARTHMERE_GLITCH_RESTORE_EVENTS)"
    ) &&
    bridge.includes(
      "window.dispatchEvent(new CustomEvent(eventName, { detail }))"
    )
);
check(
  "wake-up builder reloads face/body/clothing after cloud restore",
  includesAll(wake, [
    "HARTHMERE_GLITCH_CLOUD_SAVE_RESTORED_EVENT",
    'reloadFromStorage("cloud-save")',
    "setHarthmereFace(nextFace)",
    "setHarthmereBody(nextBody)",
    "setHarthmereClothing(nextClothing)",
  ])
);
check(
  "wake-up flow auto-applies restored cloud character instead of asking for name/body again",
  includesAll(wake, [
    "hasCurrentHarthmereCharacterCustomization",
    "detail?.hasCharacterCustomization === true",
    "cloud_restore_auto_apply",
    "events.publish(new PlayerInitEvent({ id: userId }))",
    "window.setTimeout(() => onWakeup(), 0)",
  ])
);

const restoreLatest = sectionBetween(
  bridge,
  "async restoreLatest()",
  "async saveNow"
);
check(
  "restoreLatest loads saves from Glitch",
  restoreLatest.includes("const response = await this.listSaves()")
);
check(
  "restoreLatest only applies Harthmere cloud-save snapshots",
  restoreLatest.includes("isAcceptedHarthmereCloudSavePayloadVersion")
);
check(
  "restoreLatest picks latest version and applies snapshot",
  restoreLatest.includes("Number(b.version ?? 0) - Number(a.version ?? 0)") &&
    restoreLatest.includes("applySnapshot(") &&
    restoreLatest.includes("latest.decoded_payload")
);
check(
  "restoreLatest advances and persists base_version after load",
  restoreLatest.includes("this.rememberCloudSaveVersion(latest.version") &&
    bridge.includes("writeStoredCloudSaveVersion")
);
check(
  "restoreLatestIfEmpty treats Glitch Cloud Save as durable player truth",
  bridge.includes("async restoreLatestIfEmpty") &&
    bridge.includes("shouldApplyHarthmereCloudSave") &&
    !bridge.includes(["hasBackend", "AuthorityState"].join("")) &&
    bridge.includes("latestCloudVersion: latestVersion") &&
    bridge.includes(
      "hasMeaningfulLocalProgress: hasMeaningfulLocalProgress(localStorage)"
    ) &&
    bridge.includes("applySnapshot(latest.decoded_payload, latestVersion)")
);
check(
  "bridge initializes baseVersion from stored cloud save version",
  includesAll(bridge, [
    "readStoredCloudSaveVersion(this.config)",
    "status?.lastCloudSaveVersion",
    "this.baseVersion = Math.max",
  ])
);
check(
  "bridge debounces state-change cloud saves after inventory/gathering updates",
  includesAll(bridge, [
    "HARTHMERE_GLITCH_STATE_CHANGE_SAVE_EVENTS",
    "biomes:harthmere-gathering-changed",
    "stateChangeSaveHandler",
    "STATE_CHANGE_AUTOSAVE_DELAY_MS",
    'this.saveNow("state_changed")',
  ]) &&
    includesEventContract(
      sectionBetween(
        bridge,
        "HARTHMERE_GLITCH_STATE_CHANGE_SAVE_EVENTS",
        "] as const;"
      ),
      "biomes:harthmere-inventory-changed"
    )
);
check(
  "bridge attempts a cloud save on pagehide reload/navigation",
  bridge.includes("private readonly pageHideHandler") &&
    bridge.includes('this.saveNow("pagehide")')
);

const saveNow = sectionBetween(
  bridge,
  "async saveNow",
  "async submitProgression"
);
check(
  "saveNow coalesces concurrent saves to avoid duplicate base_version conflicts",
  includesAll(saveNow, ["saveInFlight", "savePending", "followup"])
);
check(
  "storeSave request sends snapshot metadata and current base_version",
  includesAll(saveNow, [
    'requestGlitch<any>("storeSave"',
    "snapshot,",
    "metadata:",
    "base_version: this.baseVersion",
    "slot_index: CLOUD_SAVE_SLOT_INDEX",
    "play_duration_seconds: playtimeSeconds",
  ])
);
check(
  "save response updates persisted baseVersion",
  includesAll(bridge, [
    "function cloudSaveVersionFromResponse",
    "this.rememberCloudSaveVersion(responseVersion",
    "writeStoredCloudSaveVersion",
  ])
);
check(
  "409 conflicts pause autosave instead of blind retry",
  includesAll(bridge, [
    "function cloudSaveConflictFromError",
    "extractHttpStatusFromError(error) !== 409",
    "pauseCloudSavesForConflict",
    "this.cloudSaveConflictPaused",
    "this.savePending = false",
  ])
);
check(
  "performSave catches 409 and returns without retrying",
  includesAll(saveNow, [
    "catch (error)",
    "const conflict = cloudSaveConflictFromError(error)",
    "this.pauseCloudSavesForConflict(conflict, reason)",
    "return;",
  ])
);

check(
  "server listSaves requests payloads from Glitch",
  proxy.includes('new URLSearchParams({ include_payload: "1" })') ||
    proxy.includes("include_payload")
);
check(
  "server listSaves decodes returned save payloads",
  proxy.includes("decoded_payload: decodeSavePayload(save)")
);
check(
  "server decodeSavePayload base64-decodes then JSON parses",
  includesAll(proxy, [
    "function decodeSavePayload",
    'Buffer.from(save.payload, "base64")',
    "JSON.parse(text)",
  ])
);
check(
  "server storeSave encodes structured snapshots and preserves pre-encoded KV payloads",
  includesAll(proxy, [
    'if (op === "storeSave")',
    "usesPreEncodedPayload",
    "enrichHarthmereGlitchSnapshotWithServerState",
    "makeHarthmereCloudSavePayload(snapshot)",
    "validateHarthmerePreEncodedCloudSavePayload",
    "payload: encoded.payload",
    "checksum: encoded.checksum",
  ])
);
check(
  "server listSaves rehydrates an empty actor from the decoded Glitch save",
  includesAll(proxy, [
    "authenticatedCloudSaveActor(req, installId)",
    "rehydrateHarthmereActorFromGlitchSaves",
    "save_version: rehydration.saveVersion",
  ])
);
check(
  "server cloud save access is authorized by Biomes and targets the live gameplay actor",
  includesAll(proxy, [
    "function authenticatedCloudSaveActor",
    "verifyAuthenticatedRequest",
    "harthmereLiveModeInstallLinkKey(installId)",
    "harthmereLiveModeInstallGameUserLinkKey(installId)",
    "planHarthmereLiveModeActorKey",
    "actorId: actorPlan.actorId",
    "adoptHarthmereActorStateIfTargetEmpty",
    "CLOUD_SAVE_INSTALL_ACTOR_MISMATCH",
  ])
);
check(
  "server adopts meaningful legacy actor progress only into an empty stable actor",
  includesAll(rehydration, [
    "function adoptHarthmereActorStateIfTargetEmpty",
    "target actor has progress; target state always wins",
    "linked source actor has no meaningful progress",
    "authored quest/challenge IDs remain exact",
  ])
);
check(
  "server checksum hashes raw UTF-8 bytes, not the Base64 string",
  includesAll(payloadRules, [
    "function makeHarthmereCloudSavePayload",
    'Buffer.from(JSON.stringify(snapshot ?? {}), "utf8")',
    'crypto.createHash("sha256").update(bytes).digest("hex")',
  ])
);
check(
  "server enforces the live 50 MB decoded limit with Base64 parser headroom",
  payloadRules.includes("50 * 1024 * 1024") &&
    proxy.includes('sizeLimit: "72mb"') &&
    proxy.includes("HarthmereCloudSavePayloadError")
);
check(
  "server and client restore only authoritative slot 0 snapshots",
  rehydration.includes("(save.slot_index ?? 0) === 0") &&
    bridge.includes("(save?.slot_index ?? CLOUD_SAVE_SLOT_INDEX) ===")
);
check(
  "compatibility-slot conflicts pause without silent resolution",
  includesAll(kvTransport, [
    "GlitchCloudSaveConflictError",
    "this.conflictPaused = true",
    "explicit player choice",
  ]) && !kvTransport.includes('choice: "keep_server"')
);
check(
  "server storeSave sends base_version, slot, metadata, save_type and play duration",
  includesAll(proxy, [
    "base_version:",
    "slot_index:",
    "metadata,",
    "save_type:",
    "play_duration_seconds:",
  ])
);
check(
  "server cloud save uses title token proxy route",
  proxy.includes("Authorization: `Bearer ${token}`") &&
    proxy.includes("requireServerConfig()")
);
check(
  "server storeSave is synchronous so returned version reaches client",
  proxy.includes('"storeSave"') &&
    !sectionBetween(proxy, "return new Set([", "]).has(op);").includes(
      '"storeSave"'
    )
);
check(
  "server storeSave forwards Glitch response to client",
  sectionBetween(
    proxy,
    'if (op === "storeSave")',
    'if (op === "submitProgression")'
  ).includes(".json(response.json ?? response)")
);
const autoLoginRoute = sectionBetween(
  proxy,
  'if (op === "autoLogin")',
  'if (op === "claimSession")'
);
const claimSessionRoute = sectionBetween(
  proxy,
  'if (op === "claimSession")',
  'if (op === "heartbeatSession")'
);
check(
  "server autoLogin returns the stable Glitch account user_id as durable cloud game_user_id",
  includesAll(autoLoginRoute, [
    "resolveBiomesAuthForGlitchIdentity",
    "...validationJson(identity)",
    "biomes_user_id: auth.userId",
    "biomes_auth_reused: auth.reused",
  ])
);
check(
  "server claimSession returns the stable Glitch account user_id as durable cloud game_user_id",
  includesAll(claimSessionRoute, [
    "resolveBiomesAuthForGlitchIdentity",
    "claimServerSession",
    "game_user_id: identity.gameUserId",
    "biomes_user_id: auth.userId",
    "biomes_auth_reused: auth.reused",
  ])
);
check(
  "validationJson surfaces the Glitch account user_id as the durable game_user_id",
  proxy.includes("game_user_id: identity.gameUserId")
);
for (const [field] of requiredCloudSaveRequestFields) {
  check(
    `server storeSave request body includes ${field}`,
    proxy.includes(`${field}:`) || proxy.includes(`${field},`)
  );
}

const sampleStorage = Object.fromEntries(
  requiredExactKeys.map(([, key], index) => [
    key,
    JSON.stringify({ key, index, value: `roundtrip-${index}` }),
  ])
);
sampleStorage["biomes.localDev.harthmere.playerFace.user.install_test"] =
  JSON.stringify({ skinTone: "warm_03" });
sampleStorage["biomes.localDev.harthmere.playerBody.user.install_test"] =
  JSON.stringify({ bodyType: "medium" });
sampleStorage["biomes.localDev.harthmere.playerClothing.user.install_test"] =
  JSON.stringify({ torso: "traveler_jacket" });
sampleStorage[
  "biomes.localDev.harthmere.foodStaminaState.user.glitch_user_123"
] = JSON.stringify({ stamina: 75, maxStamina: 100 });
sampleStorage["biomes.localDev.liveEntityRobotEnergy.user.glitch_user_123"] =
  JSON.stringify({ robots: { helper: { energy: 42 } } });
sampleStorage["biomes.localDev.liveEntityHelperQuests.user.glitch_user_123"] =
  JSON.stringify({ active: {}, completed: {} });
sampleStorage[
  "biomes.localDev.snapshotCompletePortState.snapshot-per-player-mission-state.install_test"
] = JSON.stringify({ activeStepIndex: 2 });
sampleStorage[
  "biomes.localDev.snapshotPhotoProofs.snapshot-per-player-mission-state.install_test"
] = JSON.stringify({ proofs: ["muck-photo"] });
sampleStorage[
  "biomes.localDev.snapshotClearedMuck.snapshot-per-player-mission-state.install_test"
] = JSON.stringify({ cleared: ["muck-001"] });
sampleStorage[
  "biomes.snapshot.pendingMutations.snapshot-per-player-mission-state.install_test"
] = JSON.stringify([{ op: "complete_step" }]);
sampleStorage[
  "biomes.snapshot.lastBackendSync.snapshot-per-player-mission-state.install_test"
] = JSON.stringify({ durable: true });
sampleStorage["not.harthmere.should.not.restore"] = JSON.stringify({
  leak: true,
});
sampleStorage["biomes.localDev.harthmereExtra.shouldNotRestore"] =
  JSON.stringify({ leak: "similar-prefix" });
sampleStorage["biomes.localDev.snapshotMissionState.user.install_test"] =
  JSON.stringify({ leak: "wrong-prefix-shape" });
const snapshot = {
  version: "harthmere-glitch-save",
  schemaAuditVersion: "harthmere-glitch-save-all-state",
  savedAt: "2026-05-28T00:00:00.000Z",
  titleId: "42de534c-600f-4228-af9e-b69faef94cce",
  installId: "install-test",
  identity: {
    source: "glitch",
    titleId: "42de534c-600f-4228-af9e-b69faef94cce",
    installId: "8d653ae3-fb47-4fa9-aaaa-b1de746f6f19",
    sessionId: "client-session-1",
    serverSessionId: "server-session-1",
    gameUserId: "glitch:user-123",
    glitchUserId: "user-123",
    userName: "DevPlayer",
    validatedAt: "2026-05-28T00:00:00.000Z",
  },
  metadata: {
    level: 7,
    xpCurrent: 50,
    completedQuestCount: 3,
    gold: 120,
    inventoryItems: 11,
    defeatedEnemies: 2,
    playtimeSeconds: 88,
    storageKeyCount: Object.keys(sampleStorage).length,
    storageAuthority: "glitchCloudSave",
  },
  localStorage: sampleStorage,
};
const saveBody = {
  slot_index: 0,
  payload: "",
  checksum: "",
  base_version: 5,
  save_type: "auto",
  client_timestamp: "2026-05-28T00:00:01.000Z",
  slot_name: "Biomes Autosave",
  metadata: {
    ...snapshot.metadata,
    game_user_id: snapshot.identity.gameUserId,
    glitch_user_id: snapshot.identity.glitchUserId,
    user_name: snapshot.identity.userName,
  },
  device_id: snapshot.identity.installId,
  platform: "web",
  game_version: "harthmere-glitch",
  last_played_at: "2026-05-28T00:00:01.000Z",
  play_duration_seconds: 88,
};
const rawJson = JSON.stringify(snapshot);
const rawBytes = Buffer.from(rawJson, "utf8");
const encoded = rawBytes.toString("base64");
const checksum = crypto.createHash("sha256").update(rawBytes).digest("hex");
saveBody.payload = encoded;
saveBody.checksum = checksum;
const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
const restored = {};
const requiredExactKeySet = new Set(requiredExactKeys.map(([, key]) => key));
for (const [key, value] of Object.entries(decoded.localStorage)) {
  if (
    key.startsWith("biomes.localDev.harthmere.") ||
    requiredExactKeySet.has(key) ||
    requiredScopedPrefixes.some(([, prefix]) => key.startsWith(prefix))
  )
    restored[key] = value;
}
const simulatedCurrentCloudScope = "biomes:2338109331446422";
const simulatedCustomizationScope = simulatedCurrentCloudScope.replace(
  /^biomes:/,
  ""
);
const migratedRestored = { ...restored };
for (const [key, value] of Object.entries(restored)) {
  for (const [, prefix] of requiredScopedPrefixes) {
    if (!key.startsWith(prefix)) continue;
    const isCustomizationKey =
      prefix === "biomes.localDev.harthmere.playerFace.user." ||
      prefix === "biomes.localDev.harthmere.playerBody.user." ||
      prefix === "biomes.localDev.harthmere.playerClothing.user.";
    const nextScope = isCustomizationKey
      ? simulatedCustomizationScope
      : simulatedCurrentCloudScope;
    migratedRestored[`${prefix}${nextScope}`] = value;
  }
}

for (const [field, type] of requiredCloudSaveRequestFields) {
  check(
    `simulated save request ${field} has type ${type}`,
    typeof saveBody[field] === type &&
      (type !== "object" || isPlainObject(saveBody[field]))
  );
}
check(
  "simulated save request slot_index is valid slot 0-99",
  Number.isInteger(saveBody.slot_index) &&
    saveBody.slot_index >= 0 &&
    saveBody.slot_index <= 99
);
check(
  "simulated save request base_version is non-negative integer",
  isNonNegativeInteger(saveBody.base_version)
);
check(
  "simulated save request save_type is allowed",
  ["manual", "auto", "checkpoint", "quicksave"].includes(saveBody.save_type)
);
check(
  "simulated save request client_timestamp is ISO date",
  isIsoDateString(saveBody.client_timestamp)
);
check(
  "simulated save request last_played_at is ISO date",
  isIsoDateString(saveBody.last_played_at)
);
check(
  "simulated save request payload is Base64",
  Buffer.from(saveBody.payload, "base64").toString("base64") ===
    saveBody.payload
);
check(
  "simulated save request checksum is SHA-256 hex",
  /^[a-f0-9]{64}$/.test(saveBody.checksum)
);
check(
  "simulated save request play_duration_seconds is non-negative integer",
  isNonNegativeInteger(saveBody.play_duration_seconds)
);

for (const [field, type] of requiredDecodedPayloadFields) {
  check(
    `decoded payload ${field} has type ${type}`,
    typeof decoded[field] === type &&
      (type !== "object" || isPlainObject(decoded[field]))
  );
}
check("decoded payload titleId is UUID-like", isUuidLike(decoded.titleId));
check("decoded payload savedAt is ISO date", isIsoDateString(decoded.savedAt));
check(
  "decoded payload localStorage is a string dictionary",
  Object.values(decoded.localStorage).every(
    (value) => typeof value === "string"
  )
);
for (const [field, type] of requiredPayloadMetadataFields) {
  check(
    `decoded payload metadata ${field} has type ${type}`,
    typeof decoded.metadata[field] === type
  );
}
check(
  "decoded payload metadata integer counters are non-negative",
  [
    "level",
    "xpCurrent",
    "completedQuestCount",
    "inventoryItems",
    "defeatedEnemies",
    "playtimeSeconds",
    "storageKeyCount",
  ].every((field) => isNonNegativeInteger(decoded.metadata[field]))
);
check(
  "decoded payload metadata level is at least one",
  decoded.metadata.level >= 1
);
check(
  "decoded payload metadata declares Glitch Cloud Save as player authority",
  decoded.metadata.storageAuthority === "glitchCloudSave"
);
for (const [field, type] of requiredIdentityFields) {
  check(
    `decoded identity ${field} has type ${type}`,
    typeof decoded.identity[field] === type
  );
}
check(
  "decoded identity source is allowed",
  ["glitch", "local"].includes(decoded.identity.source)
);
check(
  "decoded identity titleId is UUID-like",
  isUuidLike(decoded.identity.titleId)
);
check(
  "decoded identity validatedAt is ISO date",
  isIsoDateString(decoded.identity.validatedAt)
);
check(
  "simulated Glitch payload decodes back to the same save schema",
  decoded.version === snapshot.version &&
    decoded.schemaAuditVersion === snapshot.schemaAuditVersion
);
check(
  "simulated checksum is 64-char SHA-256 of raw JSON bytes",
  /^[a-f0-9]{64}$/.test(checksum) &&
    checksum === crypto.createHash("sha256").update(rawBytes).digest("hex")
);
check(
  "simulated checksum is not SHA-256 of Base64 text",
  checksum !== crypto.createHash("sha256").update(encoded, "utf8").digest("hex")
);
const unicodeSnapshot = {
  ...snapshot,
  localStorage: {
    ...sampleStorage,
    "biomes.localDev.harthmere.dialogueMemory": JSON.stringify({
      line: "Muck ✓ café",
    }),
  },
};
const unicodeRaw = Buffer.from(JSON.stringify(unicodeSnapshot), "utf8");
const unicodeEncoded = unicodeRaw.toString("base64");
check(
  "unicode payload roundtrips through UTF-8 Base64",
  JSON.parse(
    Buffer.from(unicodeEncoded, "base64").toString("utf8")
  ).localStorage["biomes.localDev.harthmere.dialogueMemory"].includes("café")
);
for (const [, key] of requiredExactKeys) {
  check(`roundtrip restore keeps ${key}`, restored[key] === sampleStorage[key]);
}
for (const [, prefix] of requiredScopedPrefixes) {
  const key = Object.keys(sampleStorage).find((candidate) =>
    candidate.startsWith(prefix)
  );
  check(
    `roundtrip restore keeps scoped prefix ${prefix}`,
    key && restored[key] === sampleStorage[key]
  );
}
check(
  "roundtrip restore migrates saved face to current Biomes customization scope",
  migratedRestored[
    `biomes.localDev.harthmere.playerFace.user.${simulatedCustomizationScope}`
  ] === sampleStorage["biomes.localDev.harthmere.playerFace.user.install_test"]
);
check(
  "roundtrip restore migrates saved body to current Biomes customization scope",
  migratedRestored[
    `biomes.localDev.harthmere.playerBody.user.${simulatedCustomizationScope}`
  ] === sampleStorage["biomes.localDev.harthmere.playerBody.user.install_test"]
);
check(
  "roundtrip restore migrates saved clothing to current Biomes customization scope",
  migratedRestored[
    `biomes.localDev.harthmere.playerClothing.user.${simulatedCustomizationScope}`
  ] ===
    sampleStorage["biomes.localDev.harthmere.playerClothing.user.install_test"]
);
check(
  "roundtrip restore migrates per-user stamina to durable Biomes cloud scope",
  migratedRestored[
    `biomes.localDev.harthmere.foodStaminaState.user.${simulatedCurrentCloudScope}`
  ] ===
    sampleStorage[
      "biomes.localDev.harthmere.foodStaminaState.user.glitch_user_123"
    ]
);
check(
  "roundtrip restore does not write non-allowed keys",
  !("not.harthmere.should.not.restore" in restored)
);
check(
  "roundtrip restore rejects similar non-Harthmere prefix",
  !("biomes.localDev.harthmereExtra.shouldNotRestore" in restored)
);
check(
  "roundtrip restore rejects non-listed user-suffixed snapshot key",
  !("biomes.localDev.snapshotMissionState.user.install_test" in restored)
);
check(
  "invalid schema edge case is rejected",
  { version: "wrong", localStorage: sampleStorage }.version !==
    "harthmere-glitch-save"
);
check(
  "missing localStorage edge case is rejected",
  !isPlainObject({ version: "harthmere-glitch-save" }.localStorage)
);
check("non-string restore values are ignored", typeof 123 !== "string");
check(
  "empty payload edge case does not decode as valid save",
  (() => {
    try {
      JSON.parse(Buffer.from("", "base64").toString("utf8"));
      return false;
    } catch {
      return true;
    }
  })()
);
check(
  "invalid Base64 edge case does not decode as valid save",
  (() => {
    try {
      JSON.parse(Buffer.from("%%%not-base64%%%", "base64").toString("utf8"));
      return false;
    } catch {
      return true;
    }
  })()
);
check(
  "cloud save version extractor supports response.version",
  bridge.includes("normalizeCloudSaveVersion(response?.version)")
);
check(
  "cloud save version extractor supports response.data.version",
  bridge.includes("normalizeCloudSaveVersion(response?.data?.version)")
);
check(
  "cloud save version extractor supports response.data.data.version",
  bridge.includes("normalizeCloudSaveVersion(response?.data?.data?.version)")
);
check(
  "conflict parser handles 409 status",
  bridge.includes("extractHttpStatusFromError(error) !== 409")
);
check(
  "conflict parser captures conflict_id/server_version/message",
  includesAll(bridge, ["conflict_id", "server_version", "message"])
);
check(
  "restoreLatest handles empty save list",
  restoreLatest.includes("if (!latest?.decoded_payload)") &&
    restoreLatest.includes("return false")
);
check(
  "restoreLatest ignores non-Harthmere payloads",
  restoreLatest.includes("isAcceptedHarthmereCloudSavePayloadVersion")
);
check(
  "restoreLatest sorts by highest version",
  restoreLatest.includes("Number(b.version ?? 0) - Number(a.version ?? 0)")
);
check(
  "bridge blocks guest/install-only identities from Cloud Save",
  includesAll(bridge, [
    "function isCloudSaveEligibleIdentity",
    'startsWith("install:")',
    "GUEST_NOT_ALLOWED",
  ])
);
check(
  "bridge promotes biomes_user_id to durable cloud identity before install fallback",
  includesAll(bridge, [
    "const biomesUserId = firstString(response?.biomes_user_id)",
    "biomesUserId ? `biomes:${biomesUserId}` : undefined",
    "firstString(response?.game_user_id)",
  ])
);
check(
  "install bootstrap promotes biomes_user_id before install fallback",
  includesAll(
    read("src/client/game/glitch/harthmere_glitch_install_bootstrap.tsx"),
    [
      "const biomesUserId = firstString(json?.biomes_user_id)",
      "biomes:${biomesUserId}",
      "responseGameUserId",
    ]
  )
);
check(
  "bridge forces cloud restore when validated user scope changes",
  includesAll(bridge, [
    "previousActiveUserScope",
    "forceCloudRestoreForUserSwitch",
    "restoreLatestIfEmpty(forceCloudRestoreForUserSwitch)",
  ])
);
check(
  "bridge keeps unload keepalive to small session calls",
  includesAll(bridge, [
    "keepalive: options.keepalive === true",
    'reason === "hidden" || reason === "pagehide"',
    "releaseSession",
  ])
);
check(
  "server rejects guest-like validate responses for cloud saves",
  includesAll(proxy, [
    "const responseValid =",
    "const valid = responseValid && !guestIdentity",
    "guest_not_allowed",
    "GUEST_NOT_ALLOWED",
  ])
);
check(
  "cloud snapshot documents Glitch Cloud Save as the durable player authority",
  bridge.includes('storageAuthority: "glitchCloudSave"') &&
    decoded.metadata.storageAuthority === "glitchCloudSave"
);

check(
  "deploy production guardrails run all-state cloud save test",
  deploy.includes("test-harthmere-glitch-cloud-save-all-state.cjs")
);

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
