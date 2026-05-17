/*
 * Harthmere live-mode readiness contracts v1.
 *
 * This module does not pretend that the production multiplayer server is already
 * implemented. It defines the authoritative contracts, mutation plans, event
 * feed, idempotency rules, and simulation hooks that the future live server must
 * use when wiring combat/progression into real networking and persistence.
 */

export const HARTHMERE_LIVE_MODE_READINESS_VERSION_V1 = "harthmere-live-mode-readiness-v1";

export type HarthmereLiveModeSubsystemV1 =
  | "combat"
  | "ability"
  | "equipment"
  | "leveling"
  | "skill_progression"
  | "loot"
  | "death"
  | "revive"
  | "respawn"
  | "npc_ai"
  | "boss_encounter"
  | "pvp"
  | "party"
  | "raid"
  | "trainer"
  | "skill_book"
  | "respec"
  | "loadout"
  | "audit"
  | "ui_event"
  | "anti_abuse";

export type HarthmereLiveModeActionKindV1 =
  | "request_attack"
  | "request_ability_cast"
  | "request_equipment_change"
  | "request_xp_reward"
  | "request_skill_progress"
  | "request_loot_roll"
  | "request_loot_claim"
  | "request_death_transition"
  | "request_revive"
  | "request_respawn"
  | "request_npc_ai_tick"
  | "request_boss_tick"
  | "request_pvp_flag_change"
  | "request_pvp_reward"
  | "request_party_raid_credit"
  | "request_trainer_unlock"
  | "request_skill_book_use"
  | "request_respec"
  | "request_loadout_change";

export type HarthmereLiveModeEventKindV1 =
  | "combat_action_resolved"
  | "ability_cast_resolved"
  | "equipment_change_resolved"
  | "xp_reward_resolved"
  | "skill_progress_resolved"
  | "loot_roll_resolved"
  | "loot_claim_resolved"
  | "death_record_created"
  | "revive_resolved"
  | "respawn_resolved"
  | "npc_ai_tick_resolved"
  | "boss_tick_resolved"
  | "pvp_flag_resolved"
  | "pvp_reward_resolved"
  | "party_raid_credit_resolved"
  | "trainer_unlock_resolved"
  | "skill_book_use_resolved"
  | "respec_resolved"
  | "loadout_change_resolved"
  | "audit_log_appended"
  | "anti_abuse_signal_created";

export type HarthmereLiveModeUiEventKindV1 =
  | "floating_combat_text"
  | "combat_log_line"
  | "ability_cooldown_started"
  | "resource_changed"
  | "level_up_toast"
  | "skill_progress_toast"
  | "loot_window_update"
  | "death_recap_opened"
  | "respawn_map_updated"
  | "revive_prompt_updated"
  | "pvp_warning"
  | "party_raid_credit_notice"
  | "equipment_requirement_error"
  | "trainer_unlock_notice"
  | "respec_confirmation"
  | "loadout_blocked_notice"
  | "anti_abuse_warning";

export interface HarthmereLiveModeAuthorityEnvelopeV1 {
  requestId: string;
  idempotencyKey: string;
  actorId: string;
  targetId?: string;
  actionKind: HarthmereLiveModeActionKindV1;
  subsystem: HarthmereLiveModeSubsystemV1;
  source: "client_request" | "server_scheduled_tick" | "server_replay" | "admin_tool";
  clientSentAtMs?: number;
  serverReceivedAtMs: number;
  serverTick: number;
  actorEntityVersion: number;
  targetEntityVersion?: number;
  zoneId: string;
  encounterId?: string;
  partyId?: string;
  raidId?: string;
  pvpContextId?: string;
  payload: Record<string, unknown>;
  clientClaims?: Record<string, unknown>;
}

export interface HarthmereLiveModeValidationResultV1 {
  ok: boolean;
  errors: string[];
  warnings: string[];
  rejectedClientClaims: string[];
}

export interface HarthmereLiveModePipelineDefinitionV1 {
  id: string;
  subsystem: HarthmereLiveModeSubsystemV1;
  liveModeReady: boolean;
  description: string;
  requiredInputs: string[];
  serverValidated: string[];
  persistenceWrites: string[];
  emitsEvents: HarthmereLiveModeEventKindV1[];
  emitsUiEvents: HarthmereLiveModeUiEventKindV1[];
  idempotencyPolicy: string;
  lockKeys: string[];
  auditFields: string[];
  antiAbuseSignals: string[];
  edgeCasesCovered: string[];
}

export interface HarthmereLiveModePersistenceMutationPlanV1 {
  planId: string;
  actionKind: HarthmereLiveModeActionKindV1;
  idempotencyKey: string;
  transactionScope: "single_actor" | "actor_target" | "encounter" | "party" | "raid" | "pvp_match" | "world_zone";
  requiredLocks: string[];
  readModels: string[];
  writeModels: string[];
  appendOnlyLogs: string[];
  rollbackPlan: string[];
  uiEventOutbox: HarthmereLiveModeUiEventKindV1[];
  auditEventOutbox: HarthmereLiveModeEventKindV1[];
}

export interface HarthmereLiveModeEventV1 {
  eventId: string;
  kind: HarthmereLiveModeEventKindV1;
  requestId: string;
  actorId: string;
  targetId?: string;
  zoneId: string;
  serverTick: number;
  createdAtMs: number;
  payload: Record<string, unknown>;
}

export interface HarthmereLiveModeUiEventV1 {
  uiEventId: string;
  kind: HarthmereLiveModeUiEventKindV1;
  playerId: string;
  requestId: string;
  priority: "low" | "normal" | "high" | "critical";
  dedupeKey: string;
  createdAtMs: number;
  payload: Record<string, unknown>;
}

export interface HarthmereLiveModeReadinessReportV1 {
  ok: boolean;
  version: string;
  readyPipelineCount: number;
  missingPipelines: string[];
  missingSubsystems: string[];
  warnings: string[];
  requiredNextServerHooks: string[];
}

const CLIENT_AUTHORITATIVE_CLAIM_FIELDS_V1 = [
  "clientHitResult",
  "clientFinalDamage",
  "clientTargetHpAfter",
  "clientDeathState",
  "clientXpGranted",
  "clientSkillXpGranted",
  "clientLootGranted",
  "clientLootEligible",
  "clientPvpLegal",
  "clientDistanceAccepted",
  "clientLineOfSightAccepted",
  "clientCooldownBypass",
  "clientResourceBypass",
  "clientRaidCredit",
  "clientPartyCredit",
  "clientRespawnPointAccepted",
  "clientReviveAccepted",
  "clientNpcDecision",
  "clientBossReset",
  "clientQuestProgress",
  "clientReputationDelta",
  "clientLegalDelta",
];

export const HARTHMERE_LIVE_MODE_REQUIRED_PIPELINES_V1: HarthmereLiveModePipelineDefinitionV1[] = [
  {
    id: "attack_resolution_live_pipeline",
    subsystem: "combat",
    liveModeReady: true,
    description: "Server receives attack request, validates actor/target/range/line-of-sight/facing/cooldown/resources, resolves hit and damage, updates threat, contribution, death, rewards, logs, and UI outbox.",
    requiredInputs: ["requestId", "idempotencyKey", "actorId", "targetId", "abilityId", "actorEntityVersion", "targetEntityVersion", "zoneId", "serverTick"],
    serverValidated: ["can_act", "target_exists_alive_attackable", "safe_zone", "pvp_legality", "range", "line_of_sight", "facing", "hit_result", "damage", "death_state", "threat", "contribution", "xp_credit", "loot_credit"],
    persistenceWrites: ["combat_state", "hp_resource_delta", "cooldown", "threat", "contribution", "death_record_if_needed", "combat_audit_log", "ui_event_outbox"],
    emitsEvents: ["combat_action_resolved", "death_record_created", "audit_log_appended", "anti_abuse_signal_created"],
    emitsUiEvents: ["floating_combat_text", "combat_log_line", "ability_cooldown_started", "resource_changed", "death_recap_opened"],
    idempotencyPolicy: "requestId and idempotencyKey must be unique; duplicate requests replay previous result without applying damage twice",
    lockKeys: ["actor_entity", "target_entity", "encounter_contribution", "idempotency_key"],
    auditFields: ["attacker", "target", "ability", "hit_result", "damage", "pvp_flag_state", "position", "timestamp", "kill_credit", "loot_credit", "death_cause", "threat_events"],
    antiAbuseSignals: ["range_hack_attempt", "line_of_sight_spoof", "duplicate_attack_request", "safe_zone_attack_attempt", "low_level_grief_attack"],
    edgeCasesCovered: ["target_dies_before_attack_lands", "attacker_dies_before_projectile_lands", "simultaneous_death", "damage_reflection_loop", "healing_damage_same_tick"],
  },
  {
    id: "ability_cast_live_pipeline",
    subsystem: "ability",
    liveModeReady: true,
    description: "Server validates ability catalog requirements, target rules, cast time, interrupt state, resource cost, cooldown, zone policy, PvP modifiers, effect execution, and event outbox.",
    requiredInputs: ["actorId", "abilityId", "loadoutAbilityIds", "knownAbilities", "classId", "specializationId", "skills", "equipment", "resources", "cooldowns"],
    serverValidated: ["known_ability", "equipped_in_loadout", "class_requirement", "specialization_requirement", "skill_requirement", "required_weapon", "resource_cost", "cooldown", "cast_time", "interrupt_rule", "target_type", "ground_target_validity", "zone_policy"],
    persistenceWrites: ["resource_delta", "cooldown", "active_cast", "status_effects", "combat_log", "ui_event_outbox"],
    emitsEvents: ["ability_cast_resolved", "combat_action_resolved", "audit_log_appended", "anti_abuse_signal_created"],
    emitsUiEvents: ["ability_cooldown_started", "resource_changed", "combat_log_line", "equipment_requirement_error", "pvp_warning"],
    idempotencyPolicy: "double-cast from lag is rejected by active cast/version/cooldown lock",
    lockKeys: ["actor_entity", "actor_cooldown", "actor_resource", "active_cast", "idempotency_key"],
    auditFields: ["ability", "requirements", "resource_cost", "cooldown", "cast_time", "target_type", "pvp_modifier", "interrupted_by"],
    antiAbuseSignals: ["ability_double_casts_from_lag", "ability_hits_through_wall", "player_changes_gear_mid_cast", "illegal_ability_in_town"],
    edgeCasesCovered: ["disconnecting_during_cast", "player_uses_ability_without_required_weapon", "player_changes_gear_mid_cast", "ability_kills_target_after_player_dies", "aoe_target_cap"],
  },
  {
    id: "equipment_change_live_pipeline",
    subsystem: "equipment",
    liveModeReady: true,
    description: "Server validates item ownership, level/class/skill requirements, slot conflicts, two-hand/offhand rules, durability, combat lockout, and stat recomputation.",
    requiredInputs: ["playerId", "itemInstanceId", "slot", "inventoryLocation", "classId", "level", "skills", "combatState", "serverEntityVersion"],
    serverValidated: ["item_ownership", "item_exists", "not_locked_or_escrowed", "level_requirement", "class_requirement", "skill_requirement", "slot_validity", "two_handed_weapon_disables_offhand", "durability", "blocked_during_combat_or_cast"],
    persistenceWrites: ["equipment_slots", "inventory_location", "combat_stats_snapshot", "audit_log", "ui_event_outbox"],
    emitsEvents: ["equipment_change_resolved", "audit_log_appended"],
    emitsUiEvents: ["equipment_requirement_error", "combat_log_line"],
    idempotencyPolicy: "same equipment request with same entity version returns same result; stale version is rejected",
    lockKeys: ["player_equipment", "item_instance", "actor_entity", "idempotency_key"],
    auditFields: ["player", "item", "slot", "before_equipment", "after_equipment", "blocked_reason"],
    antiAbuseSignals: ["equip_duplication_attempt", "gear_swap_mid_cast", "combat_stat_spoof"],
    edgeCasesCovered: ["broken_weapon_cannot_attack_normally", "wrong_level_item", "wrong_class_item", "two_handed_weapon_disables_offhand", "equipment_changes_blocked_in_combat"],
  },
  {
    id: "xp_level_skill_live_pipeline",
    subsystem: "leveling",
    liveModeReady: true,
    description: "Server validates XP source, level difference, contribution, anti-farming, rested XP, level-up mutation, unlocks, and notification batching.",
    requiredInputs: ["playerId", "xpSource", "sourceLevel", "playerLevel", "contributionScore", "antiFarmCounters", "restedXpPool"],
    serverValidated: ["xp_source_legality", "level_difference_modifier", "contribution_threshold", "anti_farm_modifier", "rested_xp_cap", "level_cap", "unlock_milestones"],
    persistenceWrites: ["player_xp", "player_level", "rested_xp_pool", "ability_unlocks", "skill_unlocks", "audit_log", "ui_event_outbox"],
    emitsEvents: ["xp_reward_resolved", "audit_log_appended", "anti_abuse_signal_created"],
    emitsUiEvents: ["level_up_toast", "combat_log_line"],
    idempotencyPolicy: "quest/kill/event reward has source id and claim transaction; repeated claim is replayed not duplicated",
    lockKeys: ["player_progression", "reward_source", "idempotency_key"],
    auditFields: ["xp_source", "base_xp", "modifiers", "level_before", "level_after", "unlocks"],
    antiAbuseSignals: ["enemy_10_plus_levels_lower_no_xp", "repeated_farming_no_xp", "afk_public_event_leeching", "high_level_carry_reduced_xp"],
    edgeCasesCovered: ["quest_reward_claim_twice", "same_player_repeated_kill", "training_dummy_abuse", "level_cap_overflow", "party_member_too_far_for_xp"],
  },
  {
    id: "skill_progress_live_pipeline",
    subsystem: "skill_progression",
    liveModeReady: true,
    description: "Server validates meaningful action, difficulty, relevance, success, anti-abuse modifier, trainer/book requirements, milestone unlocks, and journal notifications.",
    requiredInputs: ["playerId", "skillId", "actionId", "difficulty", "successState", "targetId", "dailyProgressCount"],
    serverValidated: ["skill_exists", "action_relevant", "difficulty_modifier", "success_modifier", "anti_abuse_modifier", "daily_cap", "target_not_trivial", "milestone_unlock"],
    persistenceWrites: ["skill_xp", "skill_level", "known_abilities", "known_recipes", "skill_journal", "audit_log", "ui_event_outbox"],
    emitsEvents: ["skill_progress_resolved", "trainer_unlock_resolved", "skill_book_use_resolved", "audit_log_appended", "anti_abuse_signal_created"],
    emitsUiEvents: ["skill_progress_toast", "trainer_unlock_notice", "combat_log_line"],
    idempotencyPolicy: "action instance id prevents repeating the same meaningful action result for duplicate skill XP",
    lockKeys: ["player_skills", "skill_action_source", "idempotency_key"],
    auditFields: ["skill", "action", "difficulty", "success", "xp_delta", "milestone", "anti_abuse_modifier"],
    antiAbuseSignals: ["trivial_action_zero_progress", "grey_content_no_skill_progress", "training_dummy_after_daily_cap", "afk_skill_loop"],
    edgeCasesCovered: ["skill_xp_exploit_through_trivial_actions", "player_learns_same_ability_twice", "book_consumed_after_success_only", "trainer_requirement_changed_mid_request"],
  },
  {
    id: "loot_drop_claim_live_pipeline",
    subsystem: "loot",
    liveModeReady: true,
    description: "Server validates drop table, contribution, group eligibility, personal loot, inventory space, overflow recovery, raid kick safeguards, and anti-farming suppression.",
    requiredInputs: ["encounterId", "targetId", "lootTableId", "participantContribution", "groupMembershipSnapshot", "inventoryCapacity", "antiFarmCounters"],
    serverValidated: ["loot_table", "target_level", "player_level", "meaningful_contribution", "group_membership_at_kill", "raid_kick_after_contribution_keeps_eligibility", "inventory_overflow", "bound_or_quest_item_protection", "hardcore_drop_rules"],
    persistenceWrites: ["loot_instance", "loot_claim", "item_instance", "overflow_recovery", "encounter_lockout", "audit_log", "ui_event_outbox"],
    emitsEvents: ["loot_roll_resolved", "loot_claim_resolved", "audit_log_appended", "anti_abuse_signal_created"],
    emitsUiEvents: ["loot_window_update", "party_raid_credit_notice", "combat_log_line"],
    idempotencyPolicy: "loot claim transaction locks item instance and claim id; repeated claim cannot duplicate item",
    lockKeys: ["loot_container", "player_inventory", "item_instance", "encounter_lockout", "idempotency_key"],
    auditFields: ["loot_table", "drop_roll", "eligible_players", "claimant", "item_instance", "overflow", "raid_membership_snapshot"],
    antiAbuseSignals: ["loot_dispute", "raid_leader_kicks_before_loot", "boss_loot_not_awarded_on_wipe", "repeat_spawn_farm_loot_suppressed"],
    edgeCasesCovered: ["inventory_full_reward_routed_to_overflow_recovery", "player_dies_while_looting", "party_member_kicked_after_boss_contribution", "hardcore_pvp_drops_only_allowed_goods"],
  },
  {
    id: "death_revive_respawn_live_pipeline",
    subsystem: "death",
    liveModeReady: true,
    description: "Server locks death transition, creates death recap, validates revive/respawn, applies penalties/protection, supports forced/wave respawn, and prevents duplicate death penalties.",
    requiredInputs: ["damageEventId", "playerId", "currentHp", "deathCause", "position", "zoneId", "availableRespawnPoints", "partyReviveState"],
    serverValidated: ["fatal_damage_valid", "death_state_lock", "duplicate_death_ignored", "revive_eligibility", "respawn_point_safety", "faction_phase_zone", "forced_respawn_timer", "wave_respawn_slot", "penalty_policy", "respawn_protection"],
    persistenceWrites: ["death_record", "death_recap", "durability_penalty", "resurrection_sickness", "respawn_state", "protection_until", "quest_reputation_legal_effects", "audit_log", "ui_event_outbox"],
    emitsEvents: ["death_record_created", "revive_resolved", "respawn_resolved", "audit_log_appended", "anti_abuse_signal_created"],
    emitsUiEvents: ["death_recap_opened", "respawn_map_updated", "revive_prompt_updated", "combat_log_line"],
    idempotencyPolicy: "death state lock prevents duplicate fatal damage penalties; revive/respawn race processes first valid transition only",
    lockKeys: ["player_death_state", "player_entity", "respawn_point", "idempotency_key"],
    auditFields: ["death_id", "killer", "damage_summary", "corpse_position", "available_respawns", "penalties", "protection_until", "forced_respawn_at"],
    antiAbuseSignals: ["spawn_camping", "safe_zone_abuse_after_attack", "duplicate_death", "revive_respawn_race", "unfair_death_no_harsh_penalty"],
    edgeCasesCovered: ["player_dies_twice_from_duplicate_damage", "revived_at_same_time_as_forced_respawn", "dies_while_trading", "dies_while_crafting", "dies_while_mounted", "disconnect_due_to_server_issue"],
  },
  {
    id: "npc_boss_ai_live_pipeline",
    subsystem: "npc_ai",
    liveModeReady: true,
    description: "Server owns NPC/boss decisions, aggro, leash, evade, phase changes, telegraphs, adds, wipe reset, respawn records, and encounter lockouts.",
    requiredInputs: ["npcId", "combatProfileId", "threatTable", "position", "spawnPoint", "encounterState", "serverTick"],
    serverValidated: ["npc_alive", "profile_exists", "aggro_range", "leash_range", "line_of_sight", "path_reachable", "phase_rules", "telegraph_timers", "wipe_detection", "respawn_validation"],
    persistenceWrites: ["npc_state", "threat_table", "boss_phase", "encounter_state", "npc_respawn_record", "audit_log", "ui_event_outbox"],
    emitsEvents: ["npc_ai_tick_resolved", "boss_tick_resolved", "audit_log_appended", "anti_abuse_signal_created"],
    emitsUiEvents: ["combat_log_line", "pvp_warning"],
    idempotencyPolicy: "scheduled server tick id is deterministic; repeated tick replays same decision for same state version",
    lockKeys: ["npc_entity", "encounter_state", "spawn_group", "idempotency_key"],
    auditFields: ["npc", "target", "ability", "phase", "telegraph", "leash", "evade", "wipe_reset", "respawn_time"],
    antiAbuseSignals: ["boss_dragged_out_of_arena", "npc_pathfinding_exploit", "npc_dead_but_attacking", "respawn_camping_farm"],
    edgeCasesCovered: ["boss_pulled_before_ready", "boss_dragged_out_of_arena", "player_reenters_boss_arena_after_death", "npc_respawn_invalid_spawn_point", "civilian_flees_or_calls_guards"],
  },
  {
    id: "pvp_party_raid_live_pipeline",
    subsystem: "pvp",
    liveModeReady: true,
    description: "Server validates PvP flags, relationships, brackets, level sync, gear normalization, contribution, reward suppression, objectives, party/raid membership, vote-kick safeguards, and lockouts.",
    requiredInputs: ["actorId", "targetId", "relationshipState", "pvpFlagState", "partyId", "raidId", "bracket", "contributionSnapshot", "objectiveState"],
    serverValidated: ["pvp_flag_status", "faction_relationship", "safe_zone_status", "attack_legality", "gear_scaling", "level_sync", "meaningful_contribution", "repeat_kill_status", "afk_status", "win_trading_history", "spawn_camping", "party_membership", "raid_membership", "raid_lockout"],
    persistenceWrites: ["pvp_flag_state", "pvp_score", "objective_credit", "party_raid_credit", "raid_lockout", "mentor_reward", "audit_log", "ui_event_outbox"],
    emitsEvents: ["pvp_flag_resolved", "pvp_reward_resolved", "party_raid_credit_resolved", "audit_log_appended", "anti_abuse_signal_created"],
    emitsUiEvents: ["pvp_warning", "party_raid_credit_notice", "combat_log_line", "anti_abuse_warning"],
    idempotencyPolicy: "PvP reward and raid credit use encounter/match ids plus contribution snapshot so rewards cannot be claimed twice",
    lockKeys: ["pvp_match", "player_pvp_state", "party_raid_snapshot", "raid_lockout", "idempotency_key"],
    auditFields: ["pvp_flag_state", "party_raid_id", "zone", "position", "kill_credit", "loot_credit", "objective_credit", "death_cause", "crowd_control_duration", "interrupts"],
    antiAbuseSignals: ["low_level_grief_reward_suppressed", "repeated_kill_farming_suppressed", "no_meaningful_pvp_contribution", "win_trading_suspected", "spawn_camping", "afk_public_event_leeching"],
    edgeCasesCovered: ["safe_zone_abuse_after_attack", "player_logs_out_during_pvp", "player_is_crowd_controlled_forever", "raid_leader_kicks_before_loot", "vote_kick_during_loot_roll_blocked"],
  },
  {
    id: "trainer_book_respec_loadout_live_pipeline",
    subsystem: "trainer",
    liveModeReady: true,
    description: "Server validates class quest unlocks, trainer access, book use, recipe learning, respec restrictions, cooldown bypass prevention, and loadout changes.",
    requiredInputs: ["playerId", "classId", "specializationId", "level", "skills", "reputation", "legalStanding", "townServiceId", "itemInstanceId", "combatState", "cooldowns", "loadout"],
    serverValidated: ["trainer_requirement", "secret_trainer_discovered", "book_known_warning", "book_consumed_on_success", "respec_not_in_combat", "respec_cannot_bypass_cooldowns", "loadout_not_in_combat", "gear_class_skill_validation"],
    persistenceWrites: ["known_abilities", "known_recipes", "talents", "attributes", "specialization", "loadout", "currency_cost", "item_consumption", "audit_log", "ui_event_outbox"],
    emitsEvents: ["trainer_unlock_resolved", "skill_book_use_resolved", "respec_resolved", "loadout_change_resolved", "audit_log_appended", "anti_abuse_signal_created"],
    emitsUiEvents: ["trainer_unlock_notice", "respec_confirmation", "loadout_blocked_notice", "skill_progress_toast", "combat_log_line"],
    idempotencyPolicy: "learn/respec/loadout mutations use player progression version and idempotency key to avoid duplicate unlocks or cooldown abuse",
    lockKeys: ["player_progression", "player_wallet", "item_instance", "loadout", "idempotency_key"],
    auditFields: ["trainer", "book", "ability", "talent", "respec_type", "cost", "cooldowns_preserved", "loadout_before", "loadout_after"],
    antiAbuseSignals: ["player_learns_same_ability_twice", "player_respecs_while_ability_on_cooldown", "player_switches_loadout_in_combat", "class_change_abuse"],
    edgeCasesCovered: ["already_known_book_warning", "missing_gold_for_training", "illegal_trainer_requires_secret_access", "loadout_exceeds_slot_limit", "respec_requested_while_dead_or_downed"],
  },
  {
    id: "combat_audit_ui_outbox_live_pipeline",
    subsystem: "audit",
    liveModeReady: true,
    description: "Every authoritative mutation appends audit log entries and queues UI events through a server outbox so clients display, never decide, results.",
    requiredInputs: ["requestId", "actorId", "eventKind", "serverTick", "payload", "auditFields", "recipientPlayerIds"],
    serverValidated: ["event_schema", "recipient_visibility", "dedupe_key", "privacy_scope", "outbox_order", "replay_safety"],
    persistenceWrites: ["combat_audit_log", "anti_abuse_review_queue", "ui_event_outbox", "server_event_stream_checkpoint"],
    emitsEvents: ["audit_log_appended", "anti_abuse_signal_created"],
    emitsUiEvents: ["floating_combat_text", "combat_log_line", "level_up_toast", "skill_progress_toast", "loot_window_update", "death_recap_opened", "respawn_map_updated", "pvp_warning", "anti_abuse_warning"],
    idempotencyPolicy: "event id and dedupe key prevent duplicate UI toasts/log lines during reconnect/replay",
    lockKeys: ["event_stream_checkpoint", "ui_outbox", "idempotency_key"],
    auditFields: ["attacker", "target", "ability", "damage_healing", "buff_debuff", "pvp_flag_state", "party_raid_id", "zone", "position", "timestamp", "objective_credit", "boss_mechanic_failures"],
    antiAbuseSignals: ["toxicity_report_context", "exploit_detection", "balance_review", "pvp_dispute", "raid_analysis"],
    edgeCasesCovered: ["client_reconnect_replays_events", "duplicate_ui_event_dedupe", "private_party_log_visibility", "admin_replay_consistency"],
  },
];

export const HARTHMERE_LIVE_MODE_REQUIRED_SUBSYSTEMS_V1: HarthmereLiveModeSubsystemV1[] = [
  "combat",
  "ability",
  "equipment",
  "leveling",
  "skill_progression",
  "loot",
  "death",
  "revive",
  "respawn",
  "npc_ai",
  "boss_encounter",
  "pvp",
  "party",
  "raid",
  "trainer",
  "skill_book",
  "respec",
  "loadout",
  "audit",
  "ui_event",
  "anti_abuse",
];

export function getHarthmereLiveModeRequiredPipelinesV1() {
  return HARTHMERE_LIVE_MODE_REQUIRED_PIPELINES_V1.slice();
}

function liveModeHasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

export function validateHarthmereLiveModeAuthorityEnvelopeV1(envelope: HarthmereLiveModeAuthorityEnvelopeV1): HarthmereLiveModeValidationResultV1 {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rejectedClientClaims: string[] = [];
  const requiredFields: Array<keyof HarthmereLiveModeAuthorityEnvelopeV1> = ["requestId", "idempotencyKey", "actorId", "actionKind", "subsystem", "source", "serverReceivedAtMs", "serverTick", "actorEntityVersion", "zoneId", "payload"];

  for (const field of requiredFields) {
    if (!liveModeHasValue(envelope[field])) errors.push(`missing_${String(field)}`);
  }

  if (envelope.source === "client_request" && !liveModeHasValue(envelope.clientSentAtMs)) {
    warnings.push("client_request_missing_client_sent_time");
  }

  const claims = envelope.clientClaims ?? {};
  for (const field of CLIENT_AUTHORITATIVE_CLAIM_FIELDS_V1) {
    if (Object.prototype.hasOwnProperty.call(claims, field) || Object.prototype.hasOwnProperty.call(envelope.payload, field)) {
      rejectedClientClaims.push(field);
    }
  }

  if (envelope.actorEntityVersion < 0 || (envelope.targetEntityVersion ?? 0) < 0) errors.push("negative_entity_version_rejected");
  if (envelope.serverTick < 0) errors.push("negative_server_tick_rejected");
  if (envelope.actionKind.includes("pvp") && !envelope.pvpContextId && envelope.subsystem === "pvp") warnings.push("pvp_context_missing_for_pvp_action");
  if (envelope.actionKind.includes("raid") && !envelope.raidId) warnings.push("raid_action_missing_raid_id");

  return {
    ok: errors.length === 0 && rejectedClientClaims.length === 0,
    errors,
    warnings,
    rejectedClientClaims,
  };
}

export function buildHarthmereLiveModePersistenceMutationPlanV1(envelope: HarthmereLiveModeAuthorityEnvelopeV1): HarthmereLiveModePersistenceMutationPlanV1 {
  const pipeline = HARTHMERE_LIVE_MODE_REQUIRED_PIPELINES_V1.find((item) => item.subsystem === envelope.subsystem || item.emitsEvents.some((event) => event.includes(envelope.subsystem)));
  const fallbackWrite = `${envelope.subsystem}_state`;
  const transactionScope: HarthmereLiveModePersistenceMutationPlanV1["transactionScope"] = envelope.raidId
    ? "raid"
    : envelope.partyId
      ? "party"
      : envelope.pvpContextId
        ? "pvp_match"
        : envelope.encounterId
          ? "encounter"
          : envelope.targetId
            ? "actor_target"
            : "single_actor";

  return {
    planId: `live-plan:${envelope.actionKind}:${envelope.requestId}`,
    actionKind: envelope.actionKind,
    idempotencyKey: envelope.idempotencyKey,
    transactionScope,
    requiredLocks: pipeline?.lockKeys ?? ["actor_entity", "idempotency_key"],
    readModels: ["actor_entity", envelope.targetId ? "target_entity" : "world_zone", "player_progression", "combat_catalogs"],
    writeModels: pipeline?.persistenceWrites ?? [fallbackWrite, "audit_log", "ui_event_outbox"],
    appendOnlyLogs: ["combat_audit_log", "anti_abuse_review_queue", "server_event_stream_checkpoint"],
    rollbackPlan: ["rollback_state_delta", "cancel_ui_outbox_events", "append_rollback_audit_log", "release_locks"],
    uiEventOutbox: pipeline?.emitsUiEvents ?? ["combat_log_line"],
    auditEventOutbox: pipeline?.emitsEvents ?? ["audit_log_appended"],
  };
}

export function createHarthmereLiveModeEventV1(input: {
  kind: HarthmereLiveModeEventKindV1;
  envelope: HarthmereLiveModeAuthorityEnvelopeV1;
  payload?: Record<string, unknown>;
}): HarthmereLiveModeEventV1 {
  return {
    eventId: `live-event:${input.envelope.requestId}:${input.kind}:${input.envelope.serverTick}`,
    kind: input.kind,
    requestId: input.envelope.requestId,
    actorId: input.envelope.actorId,
    targetId: input.envelope.targetId,
    zoneId: input.envelope.zoneId,
    serverTick: input.envelope.serverTick,
    createdAtMs: input.envelope.serverReceivedAtMs,
    payload: input.payload ?? {},
  };
}

export function createHarthmereLiveModeUiEventV1(input: {
  kind: HarthmereLiveModeUiEventKindV1;
  envelope: HarthmereLiveModeAuthorityEnvelopeV1;
  playerId?: string;
  priority?: HarthmereLiveModeUiEventV1["priority"];
  payload?: Record<string, unknown>;
}): HarthmereLiveModeUiEventV1 {
  const playerId = input.playerId ?? input.envelope.actorId;
  return {
    uiEventId: `live-ui:${input.envelope.requestId}:${input.kind}:${playerId}`,
    kind: input.kind,
    playerId,
    requestId: input.envelope.requestId,
    priority: input.priority ?? "normal",
    dedupeKey: `${input.envelope.idempotencyKey}:${input.kind}:${playerId}`,
    createdAtMs: input.envelope.serverReceivedAtMs,
    payload: input.payload ?? {},
  };
}

export function buildHarthmereDeathRecapUiPayloadV1(input: {
  killerName: string;
  cause: string;
  damageSummary: Array<{ source: string; ability: string; damage: number; type: string }>;
  availableRespawns: Array<{ id: string; label: string; distanceMeters: number; dangerLevel: "safe" | "guarded" | "dangerous"; unavailableReason?: string }>;
  reviveAvailable: boolean;
  forcedRespawnAtMs?: number;
  penaltySummary: string[];
}) {
  const totalDamage = input.damageSummary.reduce((sum, hit) => sum + Math.max(0, hit.damage), 0);
  const topHit = input.damageSummary.slice().sort((a, b) => b.damage - a.damage)[0];
  return {
    cause: input.cause,
    killerName: input.killerName,
    damageSummary: input.damageSummary,
    totalDamage,
    suggestedCause: topHit ? `${topHit.ability} from ${topHit.source}` : input.cause,
    availableRespawns: input.availableRespawns,
    reviveAvailable: input.reviveAvailable,
    forcedRespawnAtMs: input.forcedRespawnAtMs,
    penaltySummary: input.penaltySummary,
    uiSections: ["death_recap", "killer_cause", "respawn_options", "party_revive_status", "penalty_information", "respawn_map", "danger_warning"],
  };
}

export function resolveHarthmereWaveRespawnSlotV1(input: { deathAtMs: number; intervalSeconds: number; offsetMs?: number }) {
  const intervalMs = Math.max(1, input.intervalSeconds) * 1000;
  const offset = input.offsetMs ?? 0;
  const nextSlot = Math.ceil((input.deathAtMs - offset) / intervalMs) * intervalMs + offset;
  return { nextRespawnAtMs: nextSlot, intervalMs, mode: "wave_respawn" as const };
}

export function validateHarthmereLiveModeIdempotencyReplayV1(input: { idempotencyKey: string; seenKeys: string[]; previousResultHash?: string }) {
  const duplicate = input.seenKeys.includes(input.idempotencyKey);
  return {
    ok: !duplicate,
    duplicate,
    replayPreviousResult: duplicate,
    previousResultHash: duplicate ? input.previousResultHash ?? "previous_result_required" : undefined,
  };
}

export function validateHarthmereLiveModeReadinessV1(input?: { pipelines?: HarthmereLiveModePipelineDefinitionV1[]; installedModules?: string[] }): HarthmereLiveModeReadinessReportV1 {
  const pipelines = input?.pipelines ?? HARTHMERE_LIVE_MODE_REQUIRED_PIPELINES_V1;
  const pipelineIds = new Set(pipelines.filter((pipeline) => pipeline.liveModeReady).map((pipeline) => pipeline.id));
  const subsystemSet = new Set<HarthmereLiveModeSubsystemV1>();
  for (const pipeline of pipelines) {
    if (pipeline.liveModeReady) subsystemSet.add(pipeline.subsystem);
    if (pipeline.id.includes("death_revive_respawn")) {
      subsystemSet.add("revive");
      subsystemSet.add("respawn");
    }
    if (pipeline.id.includes("npc_boss")) subsystemSet.add("boss_encounter");
    if (pipeline.id.includes("pvp_party_raid")) {
      subsystemSet.add("party");
      subsystemSet.add("raid");
    }
    if (pipeline.id.includes("trainer_book_respec_loadout")) {
      subsystemSet.add("skill_book");
      subsystemSet.add("respec");
      subsystemSet.add("loadout");
    }
    if (pipeline.id.includes("audit_ui_outbox")) {
      subsystemSet.add("ui_event");
      subsystemSet.add("anti_abuse");
    }
    for (const event of pipeline.emitsEvents) {
      if (event.includes("respawn")) subsystemSet.add("respawn");
      if (event.includes("revive")) subsystemSet.add("revive");
      if (event.includes("raid")) subsystemSet.add("raid");
      if (event.includes("party")) subsystemSet.add("party");
      if (event.includes("boss")) subsystemSet.add("boss_encounter");
    }
  }
  const missingPipelines = HARTHMERE_LIVE_MODE_REQUIRED_PIPELINES_V1.filter((pipeline) => !pipelineIds.has(pipeline.id)).map((pipeline) => pipeline.id);
  const missingSubsystems = HARTHMERE_LIVE_MODE_REQUIRED_SUBSYSTEMS_V1.filter((subsystem) => !subsystemSet.has(subsystem));
  const installedModules = input?.installedModules ?? ["combat_system_v1", "complete_combat_progression_v1", "live_mode_readiness_v1"];
  const warnings: string[] = [];
  if (!installedModules.includes("combat_system_v1")) warnings.push("combat_system_v1_missing");
  if (!installedModules.includes("complete_combat_progression_v1")) warnings.push("complete_combat_progression_v1_missing");

  return {
    ok: missingPipelines.length === 0 && missingSubsystems.length === 0 && warnings.length === 0,
    version: HARTHMERE_LIVE_MODE_READINESS_VERSION_V1,
    readyPipelineCount: pipelines.filter((pipeline) => pipeline.liveModeReady).length,
    missingPipelines,
    missingSubsystems,
    warnings,
    requiredNextServerHooks: [
      "wire_network_requests_to_validateHarthmereLiveModeAuthorityEnvelopeV1",
      "persist_buildHarthmereLiveModePersistenceMutationPlanV1_inside_database_transaction",
      "publish_createHarthmereLiveModeEventV1_to_server_event_stream",
      "deliver_createHarthmereLiveModeUiEventV1_from_server_outbox",
      "reject_CLIENT_AUTHORITATIVE_CLAIM_FIELDS_V1_before_any_mutation",
      "route_real_attacks_abilities_xp_loot_death_respawn_through_shared_rules",
    ],
  };
}

export function simulateHarthmereLiveModeEndToEndScenarioV1() {
  const attackEnvelope: HarthmereLiveModeAuthorityEnvelopeV1 = {
    requestId: "req-live-attack-001",
    idempotencyKey: "idem-live-attack-001",
    actorId: "player-warrior-001",
    targetId: "npc-bandit-001",
    actionKind: "request_attack",
    subsystem: "combat",
    source: "client_request",
    clientSentAtMs: 1000,
    serverReceivedAtMs: 1018,
    serverTick: 44,
    actorEntityVersion: 7,
    targetEntityVersion: 3,
    zoneId: "harthmere_north_fields",
    encounterId: "enc-bandit-001",
    payload: { abilityId: "power_strike", clientAnimationOnly: "sword_slash_v3" },
    clientClaims: {},
  };

  const deathEnvelope: HarthmereLiveModeAuthorityEnvelopeV1 = {
    ...attackEnvelope,
    requestId: "req-live-death-001",
    idempotencyKey: "idem-live-death-001",
    actionKind: "request_death_transition",
    subsystem: "death",
    payload: { damageEventId: "dmg-001", cause: "npc_attack" },
  };

  const respawnEnvelope: HarthmereLiveModeAuthorityEnvelopeV1 = {
    ...attackEnvelope,
    requestId: "req-live-respawn-001",
    idempotencyKey: "idem-live-respawn-001",
    actionKind: "request_respawn",
    subsystem: "respawn",
    targetId: undefined,
    payload: { respawnPointId: "harthmere_temple", selectedByPlayer: true },
  };

  const attackValidation = validateHarthmereLiveModeAuthorityEnvelopeV1(attackEnvelope);
  const deathValidation = validateHarthmereLiveModeAuthorityEnvelopeV1(deathEnvelope);
  const respawnValidation = validateHarthmereLiveModeAuthorityEnvelopeV1(respawnEnvelope);
  const attackPlan = buildHarthmereLiveModePersistenceMutationPlanV1(attackEnvelope);
  const deathPlan = buildHarthmereLiveModePersistenceMutationPlanV1(deathEnvelope);
  const respawnPlan = buildHarthmereLiveModePersistenceMutationPlanV1(respawnEnvelope);
  const deathRecap = buildHarthmereDeathRecapUiPayloadV1({
    killerName: "Bandit Captain",
    cause: "npc_attack",
    damageSummary: [
      { source: "Bandit Captain", ability: "Heavy Slash", damage: 312, type: "slashing" },
      { source: "Bleed", ability: "Deep Wound", damage: 48, type: "bleed" },
    ],
    availableRespawns: [
      { id: "north_field_shrine", label: "North Field Shrine", distanceMeters: 180, dangerLevel: "guarded" },
      { id: "harthmere_temple", label: "Harthmere Temple", distanceMeters: 600, dangerLevel: "safe" },
    ],
    reviveAvailable: true,
    forcedRespawnAtMs: 4018,
    penaltySummary: ["5% durability loss", "no resurrection sickness if revived by ally"],
  });

  const uiEvents = [
    createHarthmereLiveModeUiEventV1({ kind: "floating_combat_text", envelope: attackEnvelope, payload: { text: "312", result: "normal_hit" } }),
    createHarthmereLiveModeUiEventV1({ kind: "death_recap_opened", envelope: deathEnvelope, priority: "critical", payload: deathRecap }),
    createHarthmereLiveModeUiEventV1({ kind: "respawn_map_updated", envelope: respawnEnvelope, priority: "high", payload: { respawnPointId: "harthmere_temple" } }),
  ];

  return {
    ok: attackValidation.ok && deathValidation.ok && respawnValidation.ok,
    validations: [attackValidation, deathValidation, respawnValidation],
    mutationPlans: [attackPlan, deathPlan, respawnPlan],
    events: [
      createHarthmereLiveModeEventV1({ kind: "combat_action_resolved", envelope: attackEnvelope }),
      createHarthmereLiveModeEventV1({ kind: "death_record_created", envelope: deathEnvelope, payload: deathRecap }),
      createHarthmereLiveModeEventV1({ kind: "respawn_resolved", envelope: respawnEnvelope }),
    ],
    uiEvents,
    deathRecap,
    readiness: validateHarthmereLiveModeReadinessV1(),
  };
}

export const HARTHMERE_LIVE_MODE_TDD_TESTS_V1 = [
  "test-harthmere-live-mode-readiness-contracts-v1.cjs",
  "test-harthmere-live-mode-action-pipelines-v1.cjs",
  "test-harthmere-live-mode-persistence-idempotency-v1.cjs",
  "test-harthmere-live-mode-ui-events-v1.cjs",
  "test-harthmere-live-mode-end-to-end-scenarios-v1.cjs",
  "test-harthmere-live-mode-production-hardening-v1.cjs",
];
