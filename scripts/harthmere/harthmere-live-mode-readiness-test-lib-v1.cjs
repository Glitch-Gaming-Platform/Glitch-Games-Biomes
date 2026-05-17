#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`OK ${message}`);
}

function assert(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

function readLiveModule(root) {
  const file = path.join(root, "src/shared/harthmere/live_mode_readiness_v1.ts");
  assert(fs.existsSync(file), "live mode readiness module exists");
  return fs.readFileSync(file, "utf8");
}

function readOptional(root, rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function includesAll(text, label, values) {
  for (const value of values) {
    assert(text.includes(value), `${label} includes ${value}`);
  }
}

function countOccurrences(text, pattern) {
  const matches = text.match(new RegExp(pattern, "g"));
  return matches ? matches.length : 0;
}

function assertLiveModeContracts(root) {
  const text = readLiveModule(root);
  includesAll(text, "version/contracts", [
    "HARTHMERE_LIVE_MODE_READINESS_VERSION_V1",
    "HarthmereLiveModeAuthorityEnvelopeV1",
    "HarthmereLiveModePipelineDefinitionV1",
    "HarthmereLiveModePersistenceMutationPlanV1",
    "HarthmereLiveModeEventV1",
    "HarthmereLiveModeUiEventV1",
    "HarthmereLiveModeReadinessReportV1",
    "validateHarthmereLiveModeAuthorityEnvelopeV1",
    "validateHarthmereLiveModeReadinessV1",
  ]);
  includesAll(text, "client authoritative claim rejection", [
    "clientHitResult",
    "clientFinalDamage",
    "clientTargetHpAfter",
    "clientDeathState",
    "clientXpGranted",
    "clientSkillXpGranted",
    "clientLootGranted",
    "clientPvpLegal",
    "clientRaidCredit",
    "clientRespawnPointAccepted",
    "clientNpcDecision",
    "clientBossReset",
  ]);
  includesAll(text, "live action kinds", [
    "request_attack",
    "request_ability_cast",
    "request_equipment_change",
    "request_xp_reward",
    "request_skill_progress",
    "request_loot_roll",
    "request_loot_claim",
    "request_death_transition",
    "request_revive",
    "request_respawn",
    "request_npc_ai_tick",
    "request_boss_tick",
    "request_pvp_reward",
    "request_party_raid_credit",
    "request_trainer_unlock",
    "request_skill_book_use",
    "request_respec",
    "request_loadout_change",
  ]);
}

function assertLiveModeActionPipelines(root) {
  const text = readLiveModule(root);
  const pipelineCount = countOccurrences(text, "id: \\\"[a-z0-9_]+_live_pipeline\\\"");
  assert(pipelineCount >= 10, "10+ live-mode action pipelines defined");
  includesAll(text, "required pipelines", [
    "attack_resolution_live_pipeline",
    "ability_cast_live_pipeline",
    "equipment_change_live_pipeline",
    "xp_level_skill_live_pipeline",
    "skill_progress_live_pipeline",
    "loot_drop_claim_live_pipeline",
    "death_revive_respawn_live_pipeline",
    "npc_boss_ai_live_pipeline",
    "pvp_party_raid_live_pipeline",
    "trainer_book_respec_loadout_live_pipeline",
    "combat_audit_ui_outbox_live_pipeline",
  ]);
  includesAll(text, "pipeline fields", [
    "requiredInputs",
    "serverValidated",
    "persistenceWrites",
    "emitsEvents",
    "emitsUiEvents",
    "idempotencyPolicy",
    "lockKeys",
    "auditFields",
    "antiAbuseSignals",
    "edgeCasesCovered",
  ]);
  includesAll(text, "requirements from sheets", [
    "class_requirement",
    "specialization_requirement",
    "skill_requirement",
    "required_weapon",
    "loot_table",
    "meaningful_contribution",
    "raid_kick_after_contribution_keeps_eligibility",
    "death_state_lock",
    "forced_respawn_timer",
    "wave_respawn_slot",
    "boss_dragged_out_of_arena",
    "pvp_flag_status",
    "level_sync",
    "gear_scaling",
    "vote_kick_during_loot_roll_blocked",
  ]);
}

function assertPersistenceIdempotency(root) {
  const text = readLiveModule(root);
  includesAll(text, "persistence/idempotency", [
    "buildHarthmereLiveModePersistenceMutationPlanV1",
    "validateHarthmereLiveModeIdempotencyReplayV1",
    "idempotencyKey",
    "requiredLocks",
    "readModels",
    "writeModels",
    "appendOnlyLogs",
    "rollbackPlan",
    "uiEventOutbox",
    "auditEventOutbox",
    "duplicate",
    "replayPreviousResult",
    "rollback_state_delta",
    "cancel_ui_outbox_events",
    "append_rollback_audit_log",
    "release_locks",
  ]);
  includesAll(text, "transaction scopes", [
    "single_actor",
    "actor_target",
    "encounter",
    "party",
    "raid",
    "pvp_match",
    "world_zone",
  ]);
  includesAll(text, "locks", [
    "actor_entity",
    "target_entity",
    "player_progression",
    "player_inventory",
    "player_death_state",
    "respawn_point",
    "npc_entity",
    "encounter_state",
    "raid_lockout",
    "event_stream_checkpoint",
    "ui_outbox",
  ]);
}

function assertUiEvents(root) {
  const text = readLiveModule(root);
  includesAll(text, "UI event outbox", [
    "createHarthmereLiveModeUiEventV1",
    "floating_combat_text",
    "combat_log_line",
    "ability_cooldown_started",
    "resource_changed",
    "level_up_toast",
    "skill_progress_toast",
    "loot_window_update",
    "death_recap_opened",
    "respawn_map_updated",
    "revive_prompt_updated",
    "pvp_warning",
    "party_raid_credit_notice",
    "equipment_requirement_error",
    "trainer_unlock_notice",
    "respec_confirmation",
    "loadout_blocked_notice",
    "anti_abuse_warning",
    "dedupeKey",
  ]);
  includesAll(text, "death recap UI", [
    "buildHarthmereDeathRecapUiPayloadV1",
    "killerName",
    "damageSummary",
    "availableRespawns",
    "reviveAvailable",
    "forcedRespawnAtMs",
    "penaltySummary",
    "death_recap",
    "killer_cause",
    "respawn_options",
    "party_revive_status",
    "penalty_information",
    "respawn_map",
    "danger_warning",
  ]);
}

function assertEndToEndScenarios(root) {
  const text = readLiveModule(root);
  includesAll(text, "end-to-end scenario", [
    "simulateHarthmereLiveModeEndToEndScenarioV1",
    "req-live-attack-001",
    "req-live-death-001",
    "req-live-respawn-001",
    "validateHarthmereLiveModeAuthorityEnvelopeV1(attackEnvelope)",
    "buildHarthmereLiveModePersistenceMutationPlanV1(attackEnvelope)",
    "createHarthmereLiveModeEventV1",
    "createHarthmereLiveModeUiEventV1",
    "death_record_created",
    "respawn_resolved",
    "Bandit Captain",
    "North Field Shrine",
    "Harthmere Temple",
  ]);
  includesAll(text, "forced/wave respawn", [
    "resolveHarthmereWaveRespawnSlotV1",
    "nextRespawnAtMs",
    "wave_respawn",
  ]);
  includesAll(text, "test manifest", [
    "HARTHMERE_LIVE_MODE_TDD_TESTS_V1",
    "test-harthmere-live-mode-readiness-contracts-v1.cjs",
    "test-harthmere-live-mode-action-pipelines-v1.cjs",
    "test-harthmere-live-mode-persistence-idempotency-v1.cjs",
    "test-harthmere-live-mode-ui-events-v1.cjs",
    "test-harthmere-live-mode-end-to-end-scenarios-v1.cjs",
    "test-harthmere-live-mode-production-hardening-v1.cjs",
  ]);
}

function assertProductionHardening(root) {
  const text = readLiveModule(root);
  const combat = readOptional(root, "src/shared/harthmere/combat_system_v1.ts");
  const progression = readOptional(root, "src/shared/harthmere/complete_combat_progression_v1.ts");
  const contracts = readOptional(root, "src/client/components/challenges/LocalDevHarthmereServerAuthorityContracts.tsx");

  assert(combat.includes("resolveHarthmereCombatAction"), "combat_system_v1 is installed before live-mode readiness");
  assert(progression.includes("HARTHMERE_COMPLETE_COMBAT_PROGRESSION_VERSION_V1"), "complete combat/progression module is installed before live-mode readiness");
  includesAll(text, "production hooks", [
    "wire_network_requests_to_validateHarthmereLiveModeAuthorityEnvelopeV1",
    "persist_buildHarthmereLiveModePersistenceMutationPlanV1_inside_database_transaction",
    "publish_createHarthmereLiveModeEventV1_to_server_event_stream",
    "deliver_createHarthmereLiveModeUiEventV1_from_server_outbox",
    "reject_CLIENT_AUTHORITATIVE_CLAIM_FIELDS_V1_before_any_mutation",
    "route_real_attacks_abilities_xp_loot_death_respawn_through_shared_rules",
  ]);
  includesAll(text, "anti-abuse hardening", [
    "range_hack_attempt",
    "line_of_sight_spoof",
    "duplicate_attack_request",
    "safe_zone_attack_attempt",
    "low_level_grief_attack",
    "ability_double_casts_from_lag",
    "spawn_camping",
    "win_trading_suspected",
    "afk_public_event_leeching",
    "toxicity_report_context",
    "exploit_detection",
    "balance_review",
  ]);
  if (contracts) {
    assert(contracts.includes("combatAction") && contracts.includes("combatDeathRespawn") && contracts.includes("combatContribution"), "server authority UI contracts still expose combat/death/contribution models");
  }
}

module.exports = {
  assertLiveModeContracts,
  assertLiveModeActionPipelines,
  assertPersistenceIdempotency,
  assertUiEvents,
  assertEndToEndScenarios,
  assertProductionHardening,
};
