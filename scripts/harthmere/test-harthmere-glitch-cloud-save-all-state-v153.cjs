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

const bridgePath = "src/client/game/glitch/harthmere_glitch_bridge.ts";
const proxyPath = "src/pages/api/glitch/harthmere.ts";
const deployPath = "scripts/glitch/deploy-production-local-redis-smoke-v1.sh";
const bridge = exists(bridgePath) ? read(bridgePath) : "";
const proxy = exists(proxyPath) ? read(proxyPath) : "";
const deploy = exists(deployPath) ? read(deployPath) : "";

const requiredExactKeys = [
  ["active user scope", "biomes.localDev.harthmere.activeUserScope.v1", "src/client/components/challenges/LocalDevHarthmereUserScope.ts"],
  ["level/xp state", "biomes.localDev.harthmere.levelingState.v1", "src/client/components/challenges/LocalDevHarthmereLevelingSystem.tsx"],
  ["quest state", "biomes.localDev.harthmere.questState.v1", "src/client/components/challenges/LocalDevHarthmereQuests.tsx"],
  ["tracked missions", "biomes.localDev.harthmere.trackedMissions.v1", "src/client/components/challenges/LocalDevHarthmereMissionSystem.tsx"],
  ["mission event log", "biomes.localDev.harthmere.missionEvents.v1", "src/client/components/challenges/LocalDevHarthmereQuests.tsx"],
  ["inventory, equipment, wallet, bank, keyring, material storage", "biomes.localDev.harthmere.inventoryState.v1", "src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx"],
  ["combat state", "biomes.localDev.harthmere.combatState.v1", "src/client/components/challenges/LocalDevHarthmereCombat.tsx"],
  ["death/respawn state", "biomes.localDev.harthmere.deathState.v1", "src/client/components/challenges/LocalDevHarthmereDeathSystem.tsx"],
  ["class and skill state", "biomes.localDev.harthmere.classSkillState.v1", "src/client/components/challenges/LocalDevHarthmereClassSkillSystem.tsx"],
  ["building/property state", "biomes.localDev.harthmere.buildingState.v1", "src/client/components/challenges/LocalDevHarthmereBuildingSystem.tsx"],
  ["economy state", "biomes.localDev.harthmere.economyState.v1", "src/client/components/challenges/LocalDevHarthmereEconomySystem.tsx"],
  ["gathering state", "biomes.localDev.harthmere.gatheringState.v1", "src/client/components/challenges/LocalDevHarthmereGatheringSystem.tsx"],
  ["guild state", "biomes.localDev.harthmere.guildState.v1", "src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx"],
  ["quest economy state", "biomes.localDev.harthmere.questEconomyState.v1", "src/client/components/challenges/LocalDevHarthmereQuestEconomySystem.ts"],
  ["reputation state", "biomes.localDev.harthmere.reputation.v1", "src/client/components/challenges/LocalDevHarthmereReputation.tsx"],
  ["hardened economy reputation mirror", "biomes.localDev.harthmere.reputationState.v1", "src/client/components/challenges/LocalDevHarthmereEconomyHardening.ts"],
  ["vendor stock state", "biomes.localDev.harthmere.vendorStockState.v1", "src/client/components/challenges/LocalDevHarthmereVendorCatalog.ts"],
  ["storage/mail/recovery state", "biomes.localDev.harthmere.storageMailRecoveryState.v1", "src/client/components/challenges/LocalDevHarthmereStorageMailRecoverySystem.tsx"],
  ["trade/auction state", "biomes.localDev.harthmere.tradeAuctionState.v1", "src/client/components/challenges/LocalDevHarthmereTradeAuctionSystem.tsx"],
  ["mount/pet collection state", "biomes.localDev.harthmere.mountPetCollection.v1", "src/client/components/challenges/LocalDevHarthmereMountPetCollections.tsx"],
  ["mount/pet recent state", "biomes.localDev.harthmere.mountPetCollection.recent.v1", "src/client/components/challenges/LocalDevHarthmereMountPetCollections.tsx"],
  ["multiplayer combat state", "biomes.localDev.harthmere.multiplayerCombatState.v1", "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx"],
  ["dialogue memory", "biomes.localDev.harthmere.dialogueMemory.v1", "src/client/components/challenges/LocalDevHarthmereDialogueSystem.tsx"],
  ["dialogue safety", "biomes.localDev.harthmere.dialogueSafety.v1", "src/client/components/challenges/LocalDevHarthmereDialogueSafetySystem.tsx"],
];

const requiredScopedPrefixes = [
  ["scoped face customization", "biomes.localDev.harthmere.playerFace.v2.user.", "src/shared/harthmere/voxel_faces.ts"],
  ["scoped body customization", "biomes.localDev.harthmere.playerBody.v2.user.", "src/shared/harthmere/voxel_faces.ts"],
  ["scoped clothing customization", "biomes.localDev.harthmere.playerClothing.v1.user.", "src/shared/harthmere/voxel_faces.ts"],
];

const requiredRestoreEvents = [
  "biomes:harthmere-glitch-cloud-save-restored-v153",
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
];

console.log("== Harthmere Glitch Cloud Save all-state guardrail v153 ==");
console.log(`Root: ${root}\n`);

check("Glitch bridge source exists", !!bridge);
check("Glitch server proxy source exists", !!proxy);
check("bridge declares v153 save schema marker", bridge.includes("harthmere-glitch-save-all-state-v153"));
check("bridge stores the v153 schema marker in each save snapshot", bridge.includes("schemaAuditVersion: HARTHMERE_GLITCH_SAVE_SCHEMA_VERSION_V153"));
check("bridge declares required exact save-key manifest", bridge.includes("HARTHMERE_GLITCH_REQUIRED_SAVE_KEYS_V153"));
check("bridge declares required scoped customization-prefix manifest", bridge.includes("HARTHMERE_GLITCH_REQUIRED_SAVE_KEY_PREFIXES_V153"));
check("bridge declares restore event manifest", bridge.includes("HARTHMERE_GLITCH_RESTORE_EVENTS_V153"));

const exactManifest = sectionBetween(bridge, "HARTHMERE_GLITCH_REQUIRED_SAVE_KEYS_V153", "] as const;");
for (const [label, key, sourcePath] of requiredExactKeys) {
  const source = exists(sourcePath) ? read(sourcePath) : "";
  check(`${label} source file exists`, exists(sourcePath));
  check(`${label} declares storage key ${key}`, source.includes(key));
  check(`${label} is listed in Glitch save-key manifest`, exactManifest.includes(key));
}

const prefixManifest = sectionBetween(bridge, "HARTHMERE_GLITCH_REQUIRED_SAVE_KEY_PREFIXES_V153", "] as const;");
for (const [label, keyPrefix, sourcePath] of requiredScopedPrefixes) {
  const source = exists(sourcePath) ? read(sourcePath) : "";
  check(`${label} source file exists`, exists(sourcePath));
  check(`${label} declares scoped storage prefix ${keyPrefix}`, source.includes(keyPrefix));
  check(`${label} prefix is listed in Glitch save-key prefix manifest`, prefixManifest.includes(keyPrefix));
}

check("bank data is part of inventory save state", read("src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx").includes("bank:") && read("src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx").includes("transferToBank") && exactManifest.includes("biomes.localDev.harthmere.inventoryState.v1"));
check("guild bank data is part of guild save state", read("src/client/components/challenges/LocalDevHarthmereGuildSystem.tsx").includes("bankTabs") && exactManifest.includes("biomes.localDev.harthmere.guildState.v1"));

check("snapshot collector scans all Harthmere localStorage keys", bridge.includes("function collectHarthmereStorage") && bridge.includes("window.localStorage.length") && bridge.includes("startsWith(HARTHMERE_STORAGE_PREFIX)"));
check("snapshot type stores localStorage key/value dictionary", bridge.includes("localStorage: Record<string, string>"));
check("createSnapshot includes title/install/identity metadata and localStorage", includesAll(bridge, ["function createSnapshot", "collectHarthmereStorage()", "titleId: config.titleId", "installId: config.installId", "identity: readHarthmereGlitchIdentity()", "localStorage,"]));
check("metadata derives player level, quests, inventory, combat and playtime", includesAll(bridge, ["function deriveMetadata", "levelingState.v1", "questState.v1", "inventoryState.v1", "combatState.v1", "playtimeSeconds", "completedQuestCount", "inventoryItems", "defeatedEnemies"]));

const applySnapshot = sectionBetween(bridge, "function applySnapshot", "function hasMeaningfulLocalProgress");
check("restore rejects non-Harthmere save schema", applySnapshot.includes('parsed.version !== "harthmere-glitch-save-v1"'));
check("restore writes only Harthmere-prefixed keys", applySnapshot.includes("key.startsWith(HARTHMERE_STORAGE_PREFIX)") && applySnapshot.includes("window.localStorage.setItem(key, value)"));
check("restore dispatches the v153 all-system refresh events", applySnapshot.includes("dispatchHarthmereCloudRestoreEventsV153();"));

const restoreManifest = sectionBetween(bridge, "HARTHMERE_GLITCH_RESTORE_EVENTS_V153", "] as const;");
for (const eventName of requiredRestoreEvents) {
  check(`restore event manifest includes ${eventName}`, restoreManifest.includes(eventName));
}
check("restore event dispatcher loops over the manifest", bridge.includes("function dispatchHarthmereCloudRestoreEventsV153") && bridge.includes("for (const eventName of HARTHMERE_GLITCH_RESTORE_EVENTS_V153)") && bridge.includes("window.dispatchEvent(new CustomEvent(eventName))"));

const restoreLatest = sectionBetween(bridge, "async restoreLatest()", "async saveNow");
check("restoreLatest loads saves from Glitch", restoreLatest.includes("const response = await this.listSaves()"));
check("restoreLatest only applies Harthmere cloud-save snapshots", restoreLatest.includes('decoded_payload?.version === "harthmere-glitch-save-v1"'));
check("restoreLatest picks latest version and applies snapshot", restoreLatest.includes("Number(b.version ?? 0) - Number(a.version ?? 0)") && restoreLatest.includes("applySnapshot(latest.decoded_payload)"));
check("restoreLatest advances base_version after load", restoreLatest.includes("this.baseVersion") && restoreLatest.includes("Number(latest.version ?? 0)"));
check("restoreLatestIfEmpty prevents stale local overwrite on first boot", bridge.includes("async restoreLatestIfEmpty") && bridge.includes("hasMeaningfulLocalProgress(localStorage)"));

const saveNow = sectionBetween(bridge, "async saveNow", "async submitProgression");
check("saveNow coalesces concurrent saves to avoid duplicate base_version conflicts", includesAll(saveNow, ["saveInFlight", "savePending", "followup"]));
check("storeSave request sends snapshot metadata and current base_version", includesAll(saveNow, ["requestGlitch<any>(\"storeSave\"", "snapshot,", "metadata:", "base_version: this.baseVersion", "slot_index: 0", "play_duration_seconds: playtimeSeconds"]));
check("save response updates local baseVersion", saveNow.includes("this.baseVersion = Number(response.version)") || saveNow.includes("this.baseVersion = Number(response.data.version)"));

check("server listSaves requests payloads from Glitch", proxy.includes('new URLSearchParams({ include_payload: "1" })') || proxy.includes("include_payload"));
check("server listSaves decodes returned save payloads", proxy.includes("decoded_payload: decodeSavePayload(save)"));
check("server decodeSavePayload base64-decodes then JSON parses", includesAll(proxy, ["function decodeSavePayload", 'Buffer.from(save.payload, "base64")', "JSON.parse(text)"]));
check("server storeSave encodes snapshot with checksum", includesAll(proxy, ["if (op === \"storeSave\")", "makeSavePayload(body.snapshot", "payload: encoded.payload", "checksum: encoded.checksum"]));
check("server checksum hashes raw UTF-8 bytes, not the Base64 string", includesAll(proxy, ["function makeSavePayload", 'Buffer.from(json, "utf8")', "crypto.createHash(\"sha256\").update(bytes).digest(\"hex\")"]));
check("server storeSave sends base_version, slot, metadata, save_type and play duration", includesAll(proxy, ["base_version:", "slot_index:", "metadata,", "save_type:", "play_duration_seconds:"]));
check("server cloud save uses title token proxy route", proxy.includes("Authorization: `Bearer ${token}`") && proxy.includes("requireServerConfig()"));

const sampleStorage = Object.fromEntries(
  requiredExactKeys.map(([, key], index) => [key, JSON.stringify({ key, index, value: `roundtrip-${index}` })])
);
sampleStorage["biomes.localDev.harthmere.playerFace.v2.user.install_test"] = JSON.stringify({ skinTone: "warm_03" });
sampleStorage["biomes.localDev.harthmere.playerBody.v2.user.install_test"] = JSON.stringify({ bodyType: "medium" });
sampleStorage["biomes.localDev.harthmere.playerClothing.v1.user.install_test"] = JSON.stringify({ torso: "traveler_jacket" });
sampleStorage["not.harthmere.should.not.restore"] = JSON.stringify({ leak: true });
const snapshot = {
  version: "harthmere-glitch-save-v1",
  schemaAuditVersion: "harthmere-glitch-save-all-state-v153",
  savedAt: "2026-05-28T00:00:00.000Z",
  titleId: "42de534c-600f-4228-af9e-b69faef94cce",
  installId: "install-test",
  metadata: { level: 7, xpCurrent: 50, completedQuestCount: 3, gold: 120, inventoryItems: 11, defeatedEnemies: 2, playtimeSeconds: 88, storageKeyCount: Object.keys(sampleStorage).length },
  localStorage: sampleStorage,
};
const rawJson = JSON.stringify(snapshot);
const rawBytes = Buffer.from(rawJson, "utf8");
const encoded = rawBytes.toString("base64");
const checksum = crypto.createHash("sha256").update(rawBytes).digest("hex");
const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
const restored = {};
for (const [key, value] of Object.entries(decoded.localStorage)) {
  if (key.startsWith("biomes.localDev.harthmere.")) restored[key] = value;
}
check("simulated Glitch payload decodes back to the same save schema", decoded.version === snapshot.version && decoded.schemaAuditVersion === snapshot.schemaAuditVersion);
check("simulated checksum is 64-char SHA-256 of raw JSON bytes", /^[a-f0-9]{64}$/.test(checksum) && checksum === crypto.createHash("sha256").update(rawBytes).digest("hex"));
for (const [, key] of requiredExactKeys) {
  check(`roundtrip restore keeps ${key}`, restored[key] === sampleStorage[key]);
}
for (const [, prefix] of requiredScopedPrefixes) {
  const key = Object.keys(sampleStorage).find((candidate) => candidate.startsWith(prefix));
  check(`roundtrip restore keeps scoped prefix ${prefix}`, key && restored[key] === sampleStorage[key]);
}
check("roundtrip restore does not write non-Harthmere keys", !("not.harthmere.should.not.restore" in restored));

check("deploy production guardrails run all-state cloud save test", deploy.includes("test-harthmere-glitch-cloud-save-all-state-v153.cjs"));

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
