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
const proxyPath = "src/pages/api/glitch/harthmere.ts";
const deployPath = "scripts/glitch/deploy-production-local-redis-smoke-v1.sh";
const bridge = exists(bridgePath) ? read(bridgePath) : "";
const proxy = exists(proxyPath) ? read(proxyPath) : "";
const deploy = exists(deployPath) ? read(deployPath) : "";

const requiredExactKeys = [
  [
    "active user scope",
    "biomes.localDev.harthmere.activeUserScope.v1",
    "src/client/components/challenges/LocalDevHarthmereUserScope.ts",
  ],
  [
    "level/xp state",
    "biomes.localDev.harthmere.levelingState.v1",
    "src/client/components/challenges/LocalDevHarthmereLevelingSystem.tsx",
  ],
  [
    "quest state",
    "biomes.localDev.harthmere.questState.v1",
    "src/client/components/challenges/LocalDevHarthmereQuests.tsx",
  ],
  [
    "snapshot Grove quest state",
    "biomes.localDev.snapshotGroveQuestState.v75",
    "src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx",
  ],
  [
    "snapshot Grove likeability state",
    "biomes.localDev.snapshotGroveLikeability.v75",
    "src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx",
  ],
  [
    "snapshot Road Ahead mission state",
    "biomes.localDev.snapshotMissionState.v73",
    "src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx",
  ],
  [
    "snapshot Road Ahead mission event log",
    "biomes.localDev.snapshotMissionEvents.v73",
    "src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx",
  ],
  [
    "snapshot Road Ahead mission rewards",
    "biomes.localDev.snapshotMissionRewards.v73",
    "src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx",
  ],
  [
    "tracked missions",
    "biomes.localDev.harthmere.trackedMissions.v1",
    "src/client/components/challenges/LocalDevHarthmereMissionSystem.tsx",
  ],
  [
    "mission event log",
    "biomes.localDev.harthmere.missionEvents.v1",
    "src/client/components/challenges/LocalDevHarthmereQuests.tsx",
  ],
  [
    "inventory, equipment, wallet, bank, keyring, material storage",
    "biomes.localDev.harthmere.inventoryState.v1",
    "src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx",
  ],
  [
    "combat state",
    "biomes.localDev.harthmere.combatState.v1",
    "src/client/components/challenges/LocalDevHarthmereCombat.tsx",
  ],
  [
    "death/respawn state",
    "biomes.localDev.harthmere.deathState.v1",
    "src/client/components/challenges/LocalDevHarthmereDeathSystem.tsx",
  ],
  [
    "class and skill state",
    "biomes.localDev.harthmere.classSkillState.v1",
    "src/client/components/challenges/LocalDevHarthmereClassSkillSystem.tsx",
  ],
  [
    "building/property state",
    "biomes.localDev.harthmere.buildingState.v1",
    "src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx",
  ],
  [
    "economy state",
    "biomes.localDev.harthmere.economyState.v1",
    "src/client/components/challenges/LocalDevHarthmereEconomySystem.tsx",
  ],
  [
    "gathering state",
    "biomes.localDev.harthmere.gatheringState.v1",
    "src/client/components/challenges/LocalDevHarthmereGatheringSystem.tsx",
  ],
  [
    "guild state",
    "biomes.localDev.harthmere.guildState.v1",
    "src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx",
  ],
  [
    "quest economy state",
    "biomes.localDev.harthmere.questEconomyState.v1",
    "src/client/components/challenges/LocalDevHarthmereQuestEconomySystem.ts",
  ],
  [
    "reputation state",
    "biomes.localDev.harthmere.reputation.v1",
    "src/client/components/challenges/LocalDevHarthmereReputation.tsx",
  ],
  [
    "hardened economy reputation mirror",
    "biomes.localDev.harthmere.reputationState.v1",
    "src/client/components/challenges/LocalDevHarthmereEconomyHardening.ts",
  ],
  [
    "vendor stock state",
    "biomes.localDev.harthmere.vendorStockState.v1",
    "src/client/components/challenges/LocalDevHarthmereVendorCatalog.ts",
  ],
  [
    "storage/mail/recovery state",
    "biomes.localDev.harthmere.storageMailRecoveryState.v1",
    "src/client/components/challenges/LocalDevHarthmereStorageMailRecoverySystem.tsx",
  ],
  [
    "trade/auction state",
    "biomes.localDev.harthmere.tradeAuctionState.v1",
    "src/client/components/challenges/LocalDevHarthmereTradeAuctionSystem.tsx",
  ],
  [
    "mount/pet collection state",
    "biomes.localDev.harthmere.mountPetCollection.v1",
    "src/client/components/challenges/LocalDevHarthmereMountPetCollections.tsx",
  ],
  [
    "mount/pet recent state",
    "biomes.localDev.harthmere.mountPetCollection.recent.v1",
    "src/client/components/challenges/LocalDevHarthmereMountPetCollections.tsx",
  ],
  [
    "multiplayer combat state",
    "biomes.localDev.harthmere.multiplayerCombatState.v1",
    "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx",
  ],
  [
    "dialogue memory",
    "biomes.localDev.harthmere.dialogueMemory.v1",
    "src/client/components/challenges/LocalDevHarthmereDialogueSystem.tsx",
  ],
  [
    "dialogue safety",
    "biomes.localDev.harthmere.dialogueSafety.v1",
    "src/client/components/challenges/LocalDevHarthmereDialogueSafetySystem.tsx",
  ],
  [
    "food/stamina state",
    "biomes.localDev.harthmere.foodStaminaState.v1",
    "src/client/components/challenges/LocalDevHarthmereFoodStaminaSystem.tsx",
  ],
  [
    "rapid economy action throttle state",
    "biomes.localDev.harthmere.rapidEconomyActions.v1",
    "src/client/components/challenges/LocalDevHarthmereEconomyHardening.ts",
  ],
  [
    "pending vendor trade request state",
    "biomes.localDev.harthmere.pendingVendorTrade.v1",
    "src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx",
  ],
  [
    "NPC AI memory state",
    "biomes.localDev.harthmere.npcAi.memory.v1",
    "src/client/components/challenges/LocalDevHarthmereNpcAiSystem.ts",
  ],
  [
    "NPC AI decision log state",
    "biomes.localDev.harthmere.npcAi.decisionLog.v1",
    "src/client/components/challenges/LocalDevHarthmereNpcAiSystem.ts",
  ],
  [
    "NPC AI debug state",
    "biomes.localDev.harthmere.npcAi.debug.v1",
    "src/client/components/challenges/LocalDevHarthmereNpcAiSystem.ts",
  ],
  [
    "live entity robot energy state",
    "biomes.localDev.liveEntityRobotEnergy.v1",
    "src/client/components/challenges/LocalDevLiveEntityRobotEnergyState.ts",
  ],
  [
    "live entity helper quest state",
    "biomes.localDev.liveEntityHelperQuests.v1",
    "src/shared/harthmere/live_entity_helper_quests_v1.ts",
  ],
  [
    "snapshot combat runtime state",
    "biomes.localDev.snapshotCombatState.v74",
    "src/client/components/challenges/LocalDevSnapshotCombatRuntime.tsx",
  ],
];

const requiredScopedPrefixes = [
  [
    "scoped face customization",
    "biomes.localDev.harthmere.playerFace.v2.user.",
    "src/shared/harthmere/voxel_faces.ts",
  ],
  [
    "scoped body customization",
    "biomes.localDev.harthmere.playerBody.v2.user.",
    "src/shared/harthmere/voxel_faces.ts",
  ],
  [
    "scoped clothing customization",
    "biomes.localDev.harthmere.playerClothing.v1.user.",
    "src/shared/harthmere/voxel_faces.ts",
  ],
  [
    "scoped food/stamina state",
    "biomes.localDev.harthmere.foodStaminaState.v1.user.",
    "src/client/components/challenges/LocalDevHarthmereFoodStaminaSystem.tsx",
  ],
  [
    "scoped live entity robot energy state",
    "biomes.localDev.liveEntityRobotEnergy.v1.user.",
    "src/client/components/challenges/LocalDevLiveEntityRobotEnergyState.ts",
  ],
  [
    "scoped live entity helper quest state",
    "biomes.localDev.liveEntityHelperQuests.v1.user.",
    "src/shared/harthmere/live_entity_helper_quests_v1.ts",
  ],
  [
    "scoped snapshot complete port state",
    "biomes.localDev.snapshotCompletePortState.v76.snapshot-per-player-mission-state-v78.",
    "src/client/components/challenges/LocalDevSnapshotCompletePortV76.tsx",
  ],
  [
    "scoped snapshot photo proofs",
    "biomes.localDev.snapshotPhotoProofs.v76.snapshot-per-player-mission-state-v78.",
    "src/client/components/challenges/LocalDevSnapshotCompletePortV76.tsx",
  ],
  [
    "scoped snapshot cleared muck",
    "biomes.localDev.snapshotClearedMuck.v76.snapshot-per-player-mission-state-v78.",
    "src/client/components/challenges/LocalDevSnapshotCompletePortV76.tsx",
  ],
  [
    "scoped snapshot production pending mutations",
    "biomes.snapshot.pendingMutations.v77.snapshot-per-player-mission-state-v78.",
    "src/client/components/challenges/SnapshotProductionPortV77.tsx",
  ],
  [
    "scoped snapshot production backend sync state",
    "biomes.snapshot.lastBackendSync.v77.snapshot-per-player-mission-state-v78.",
    "src/client/components/challenges/SnapshotProductionPortV77.tsx",
  ],
];

const requiredRestoreEvents = [
  "biomes:harthmere-glitch-cloud-save-restored-v153",
  "biomes:local-dev-snapshot-grove-quest-state-v75",
  "biomes:local-dev-snapshot-mission-state-v73",
  "biomes:local-dev-snapshot-combat-state-v74",
  "biomes:local-dev-snapshot-complete-port-v76",
  "biomes:snapshot-production-port-v77",
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
  "biomes:live-entity-robot-energy-v1",
  "biomes:live-entity-helper-quest-v1",
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

console.log("== Harthmere Glitch Cloud Save all-state guardrail v153 ==");
console.log(`Root: ${root}\n`);

check("Glitch bridge source exists", !!bridge);
check("Glitch server proxy source exists", !!proxy);
check(
  "bridge declares v153 save schema marker",
  bridge.includes("harthmere-glitch-save-all-state-v153")
);
check(
  "bridge stores the v153 schema marker in each save snapshot",
  bridge.includes(
    "schemaAuditVersion: HARTHMERE_GLITCH_SAVE_SCHEMA_VERSION_V153"
  )
);
check(
  "bridge declares required exact save-key manifest",
  bridge.includes("HARTHMERE_GLITCH_REQUIRED_SAVE_KEYS_V153")
);
check(
  "bridge declares required scoped customization-prefix manifest",
  bridge.includes("HARTHMERE_GLITCH_REQUIRED_SAVE_KEY_PREFIXES_V153")
);
check(
  "bridge declares restore event manifest",
  bridge.includes("HARTHMERE_GLITCH_RESTORE_EVENTS_V153")
);

const exactManifest = sectionBetween(
  bridge,
  "HARTHMERE_GLITCH_REQUIRED_SAVE_KEYS_V153",
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
  "HARTHMERE_GLITCH_REQUIRED_SAVE_KEY_PREFIXES_V153",
  "] as const;"
);
for (const [label, keyPrefix, sourcePath] of requiredScopedPrefixes) {
  const source = exists(sourcePath) ? read(sourcePath) : "";
  const sourceNeedle = keyPrefix
    .replace(/\.user\.$/, "")
    .replace(/\.snapshot-per-player-mission-state-v78\.$/, "");
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
    exactManifest.includes("biomes.localDev.harthmere.inventoryState.v1")
);
check(
  "guild bank data is part of guild save state",
  read(
    "src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx"
  ).includes("bankTabs") &&
    exactManifest.includes("biomes.localDev.harthmere.guildState.v1")
);

check(
  "snapshot collector scans all allowed Harthmere mission localStorage keys",
  bridge.includes("function collectHarthmereStorage") &&
    bridge.includes("window.localStorage.length") &&
    bridge.includes("isHarthmereCloudSaveStorageKeyV153(key)")
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
  "metadata derives player level, quests, snapshot missions, inventory, combat, playtime and localStorage authority",
  includesAll(bridge, [
    "function deriveMetadata",
    "levelingState.v1",
    "questState.v1",
    "snapshotGroveQuestState.v75",
    "snapshotMissionState.v73",
    "inventoryState.v1",
    "combatState.v1",
    "playtimeSeconds",
    "completedQuestCount",
    "inventoryItems",
    "defeatedEnemies",
    'storageAuthority: "localStorage"',
  ])
);

const applySnapshot = sectionBetween(
  bridge,
  "function applySnapshot",
  "function hasMeaningfulLocalProgress"
);
check(
  "restore rejects non-Harthmere save schema",
  applySnapshot.includes('parsed.version !== "harthmere-glitch-save-v1"')
);
check(
  "restore writes only allowed Harthmere mission save keys",
  applySnapshot.includes("isHarthmereCloudSaveStorageKeyV153(key)") &&
    applySnapshot.includes("window.localStorage.setItem(key, value)")
);
check(
  "restore dispatches the v153 all-system refresh events",
  applySnapshot.includes("dispatchHarthmereCloudRestoreEventsV153();")
);

const restoreManifest = sectionBetween(
  bridge,
  "HARTHMERE_GLITCH_RESTORE_EVENTS_V153",
  "] as const;"
);
for (const eventName of requiredRestoreEvents) {
  check(
    `restore event manifest includes ${eventName}`,
    restoreManifest.includes(eventName)
  );
}
check(
  "restore event dispatcher loops over the manifest",
  bridge.includes("function dispatchHarthmereCloudRestoreEventsV153") &&
    bridge.includes(
      "for (const eventName of HARTHMERE_GLITCH_RESTORE_EVENTS_V153)"
    ) &&
    bridge.includes("window.dispatchEvent(new CustomEvent(eventName))")
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
  restoreLatest.includes(
    'decoded_payload?.version === "harthmere-glitch-save-v1"'
  )
);
check(
  "restoreLatest picks latest version and applies snapshot",
  restoreLatest.includes("Number(b.version ?? 0) - Number(a.version ?? 0)") &&
    restoreLatest.includes("applySnapshot(latest.decoded_payload)")
);
check(
  "restoreLatest advances and persists base_version after load",
  restoreLatest.includes("this.rememberCloudSaveVersion(latest.version") &&
    bridge.includes("writeStoredCloudSaveVersion")
);
check(
  "restoreLatestIfEmpty prevents stale local overwrite on first boot",
  bridge.includes("async restoreLatestIfEmpty") &&
    bridge.includes("hasMeaningfulLocalProgress(localStorage)")
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
    "HARTHMERE_GLITCH_STATE_CHANGE_SAVE_EVENTS_V153",
    "biomes:harthmere-inventory-changed",
    "biomes:harthmere-gathering-changed",
    "stateChangeSaveHandler",
    "STATE_CHANGE_AUTOSAVE_DELAY_MS",
    'this.saveNow("state_changed")',
  ])
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
  "server storeSave encodes snapshot with checksum",
  includesAll(proxy, [
    'if (op === "storeSave")',
    "makeSavePayload(body.snapshot",
    "payload: encoded.payload",
    "checksum: encoded.checksum",
  ])
);
check(
  "server checksum hashes raw UTF-8 bytes, not the Base64 string",
  includesAll(proxy, [
    "function makeSavePayload",
    'Buffer.from(json, "utf8")',
    'crypto.createHash("sha256").update(bytes).digest("hex")',
  ])
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
sampleStorage["biomes.localDev.harthmere.playerFace.v2.user.install_test"] =
  JSON.stringify({ skinTone: "warm_03" });
sampleStorage["biomes.localDev.harthmere.playerBody.v2.user.install_test"] =
  JSON.stringify({ bodyType: "medium" });
sampleStorage["biomes.localDev.harthmere.playerClothing.v1.user.install_test"] =
  JSON.stringify({ torso: "traveler_jacket" });
sampleStorage[
  "biomes.localDev.harthmere.foodStaminaState.v1.user.glitch_user_123"
] = JSON.stringify({ stamina: 75, maxStamina: 100 });
sampleStorage["biomes.localDev.liveEntityRobotEnergy.v1.user.glitch_user_123"] =
  JSON.stringify({ robots: { helper: { energy: 42 } } });
sampleStorage[
  "biomes.localDev.liveEntityHelperQuests.v1.user.glitch_user_123"
] = JSON.stringify({ active: {}, completed: {} });
sampleStorage[
  "biomes.localDev.snapshotCompletePortState.v76.snapshot-per-player-mission-state-v78.install_test"
] = JSON.stringify({ activeStepIndex: 2 });
sampleStorage[
  "biomes.localDev.snapshotPhotoProofs.v76.snapshot-per-player-mission-state-v78.install_test"
] = JSON.stringify({ proofs: ["muck-photo"] });
sampleStorage[
  "biomes.localDev.snapshotClearedMuck.v76.snapshot-per-player-mission-state-v78.install_test"
] = JSON.stringify({ cleared: ["muck-001"] });
sampleStorage[
  "biomes.snapshot.pendingMutations.v77.snapshot-per-player-mission-state-v78.install_test"
] = JSON.stringify([{ op: "complete_step" }]);
sampleStorage[
  "biomes.snapshot.lastBackendSync.v77.snapshot-per-player-mission-state-v78.install_test"
] = JSON.stringify({ durable: true });
sampleStorage["not.harthmere.should.not.restore"] = JSON.stringify({
  leak: true,
});
sampleStorage["biomes.localDev.harthmereExtra.shouldNotRestore"] =
  JSON.stringify({ leak: "similar-prefix" });
sampleStorage["biomes.localDev.snapshotMissionState.v73.user.install_test"] =
  JSON.stringify({ leak: "wrong-prefix-shape" });
const snapshot = {
  version: "harthmere-glitch-save-v1",
  schemaAuditVersion: "harthmere-glitch-save-all-state-v153",
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
    storageAuthority: "localStorage",
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
  game_version: "harthmere-glitch-v70",
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
  "decoded payload metadata declares localStorage as save authority",
  decoded.metadata.storageAuthority === "localStorage"
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
    "biomes.localDev.harthmere.dialogueMemory.v1": JSON.stringify({
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
  ).localStorage["biomes.localDev.harthmere.dialogueMemory.v1"].includes("café")
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
  "roundtrip restore does not write non-allowed keys",
  !("not.harthmere.should.not.restore" in restored)
);
check(
  "roundtrip restore rejects similar non-Harthmere prefix",
  !("biomes.localDev.harthmereExtra.shouldNotRestore" in restored)
);
check(
  "roundtrip restore rejects non-listed user-suffixed snapshot key",
  !("biomes.localDev.snapshotMissionState.v73.user.install_test" in restored)
);
check(
  "invalid schema edge case is rejected",
  { version: "wrong", localStorage: sampleStorage }.version !==
    "harthmere-glitch-save-v1"
);
check(
  "missing localStorage edge case is rejected",
  !isPlainObject({ version: "harthmere-glitch-save-v1" }.localStorage)
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
  restoreLatest.includes(
    'decoded_payload?.version === "harthmere-glitch-save-v1"'
  )
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
  "cloud snapshot documents localStorage authority so production Redis divergence is visible",
  bridge.includes('storageAuthority: "localStorage"') &&
    decoded.metadata.storageAuthority === "localStorage"
);

check(
  "deploy production guardrails run all-state cloud save test",
  deploy.includes("test-harthmere-glitch-cloud-save-all-state-v153.cjs")
);

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
