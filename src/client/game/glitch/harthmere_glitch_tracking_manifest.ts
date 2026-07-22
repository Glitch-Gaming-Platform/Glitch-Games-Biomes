import type { GardenHoseEvent } from "@/client/events/api";
import type { HarthmereLiveModeActionKind } from "@/shared/harthmere/live_mode_readiness";

export interface HarthmereGlitchBehaviorDefinition {
  stepKey: string;
  actionKey: string;
  throttleMs?: number;
  once?: boolean;
}

export interface HarthmereGlitchLiveActionDefinition {
  stepKey: string;
  label: string;
  description: string;
  sampleIntervalMs?: number;
  playerBehavior: boolean;
}

const behavior = (
  stepKey: string,
  actionKey: string,
  options: Pick<HarthmereGlitchBehaviorDefinition, "throttleMs" | "once"> = {}
): HarthmereGlitchBehaviorDefinition => ({ stepKey, actionKey, ...options });

// GardenHose is the game's central client-side logical event stream. Keeping
// this Record exhaustive means a newly added GardenHose behavior causes a type
// error until its Glitch tracking policy is deliberately selected.
export const HARTHMERE_GLITCH_GARDEN_HOSE_BEHAVIORS = {
  bootstrap: behavior("game_boot", "bootstrap", { once: true }),
  player_init: behavior("gameplay", "player_initialized", { once: true }),
  inventory_change: behavior("inventory", "state_changed", {
    throttleMs: 12_000,
  }),
  local_inventory_selection_change: behavior("inventory", "select_slot", {
    throttleMs: 2_000,
  }),
  selection_change: behavior("hotbar", "select_slot", {
    throttleMs: 2_000,
  }),
  place_voxel: behavior("building", "place_voxel"),
  open_shop: behavior("vendor_open", "screen_view"),
  close_shop: behavior("vendor_open", "close"),
  open_pause: behavior("biomes_ui", "open_pause"),
  inventory_overflow_item_received: behavior("inventory_capacity", "overflow"),
  inventory_overflow_opened: behavior("inventory_capacity", "opened"),
  block_inventory_throw: behavior("inventory", "throw_item"),
  enter_water: behavior("exploration", "enter_water", { throttleMs: 10_000 }),
  enter_cave: behavior("exploration", "enter_cave", { throttleMs: 10_000 }),
  close_pause: behavior("biomes_ui", "close_pause"),
  display_pdp: behavior("social_profile", "screen_view"),
  hide_pdp: behavior("social_profile", "close"),
  click_photo_message: behavior("social_photo", "open_photo"),
  photo_post_attempt: behavior("social_photo", "post_attempt"),
  photo_post: behavior("social_photo", "post_success"),
  photo_post_error: behavior("social_photo", "post_fail"),
  inspect_frame: behavior("social_photo", "inspect_frame"),
  wake_up_complete: behavior("onboarding_wakeup", "complete", { once: true }),
  warp_post: behavior("travel", "warp_to_post"),
  warp_group: behavior("travel", "warp_to_group"),
  craft: behavior("crafting_complete", "complete"),
  move: behavior("first_movement", "complete", { once: true }),
  jump: behavior("movement", "jump", { throttleMs: 5_000 }),
  destroy: behavior("gathering", "destroy_block", { throttleMs: 1_000 }),
  challenge_unlock: behavior("quest_active", "accepted"),
  challenge_complete: behavior("quest_reward", "complete"),
  challenge_abandon: behavior("quest_abandon", "complete"),
  challenge_step_begin: behavior("quest_objective", "start"),
  challenge_step_complete: behavior("quest_objective", "complete"),
  challenge_step_progress: behavior("quest_objective", "progress", {
    throttleMs: 5_000,
  }),
  flag_complete: behavior("progression", "flag_complete"),
  equip: behavior("equipment_change", "success"),
  nux_complete: behavior("onboarding_nux", "complete"),
  place_placeable: behavior("building", "place_object"),
  open_tab: behavior("biomes_ui", "open_tab"),
  close_tab: behavior("biomes_ui", "close_tab"),
  show_post_capture: behavior("social_photo", "show_capture"),
  hide_post_capture: behavior("social_photo", "hide_capture"),
  warped: behavior("travel", "warp_complete"),
  take_damage: behavior("combat", "take_damage", { throttleMs: 3_000 }),
  die: behavior("combat", "death"),
  beam_dismiss: behavior("interface", "dismiss_navigation"),
  talk_npc: behavior("npc_dialogue", "start"),
  nux_advance: behavior("onboarding_nux", "progress"),
  open_station: behavior("crafting_station", "screen_view"),
  minigame_simple_race_finish: behavior("minigame_complete", "complete"),
  minigame_simple_race_quit: behavior("minigame_exit", "quit"),
  minigame_quit: behavior("minigame_exit", "quit"),
  start_collide_placeable: behavior("world_interaction", "touch_object", {
    throttleMs: 15_000,
  }),
  stop_collide_placeable: behavior("world_interaction", "leave_object", {
    throttleMs: 15_000,
  }),
  start_collide_entity: behavior("world_interaction", "touch_entity", {
    throttleMs: 15_000,
  }),
  stop_collide_entity: behavior("world_interaction", "leave_entity", {
    throttleMs: 15_000,
  }),
  start_ground_collide_entity: behavior(
    "world_interaction",
    "stand_on_entity",
    { throttleMs: 15_000 }
  ),
  stop_ground_collide_entity: behavior(
    "world_interaction",
    "leave_entity_surface",
    { throttleMs: 15_000 }
  ),
  enter_robot_field: behavior("robot", "enter_field", {
    throttleMs: 10_000,
  }),
  blueprint_complete: behavior("building", "blueprint_complete"),
  boost_placement: behavior("building", "boost_placement"),
  mail_received: behavior("mail_received", "complete"),
  snapshot_grove_practice_action: behavior(
    "onboarding_practice",
    "practice_action"
  ),
} satisfies Record<GardenHoseEvent["kind"], HarthmereGlitchBehaviorDefinition>;

// These browser events represent persisted player-facing state transitions.
// They complement semantic request telemetry and cover local/offline paths.
export const HARTHMERE_GLITCH_STATE_CHANGE_BEHAVIORS = [
  ["biomes:harthmere-inventory-changed", "inventory", "state_changed"],
  ["biomes:harthmere-economy-changed", "economy", "state_changed"],
  ["biomes:harthmere-dialogue-changed", "dialogue", "state_changed"],
  ["biomes:harthmere-quest-state-changed", "quest", "state_changed"],
  ["biomes:harthmere-mission-event", "mission", "progress"],
  ["biomes:harthmere-combat-changed", "combat", "state_changed"],
  ["biomes:harthmere-death-changed", "combat", "death"],
  ["biomes:harthmere-leveling-changed", "progression", "leveling_changed"],
  [
    "biomes:harthmere-class-skill-changed",
    "class_progression",
    "state_changed",
  ],
  ["biomes:harthmere-building-changed", "building", "state_changed"],
  ["biomes:harthmere-gathering-changed", "gathering", "state_changed"],
  ["biomes:harthmere-guild-changed", "guild", "state_changed"],
  ["biomes:harthmere-quest-economy-changed", "quest_economy", "state_changed"],
  ["biomes:harthmere-reputation-changed", "reputation", "state_changed"],
  [
    "biomes:harthmere-storage-mail-recovery-changed",
    "storage_mail",
    "state_changed",
  ],
  ["biomes:harthmere-trade-auction-changed", "trade_auction", "state_changed"],
  [
    "biomes:harthmere-multiplayer-combat-changed",
    "multiplayer_combat",
    "state_changed",
  ],
  ["biomes:harthmere-food-stamina-changed", "survival", "state_changed"],
  ["biomes:live-entity-robot-energy", "companion", "state_changed"],
  ["biomes:live-entity-helper-quest", "helper_quest", "state_changed"],
] as const;

const liveAction = (
  stepKey: string,
  label: string,
  description: string,
  options: Partial<
    Pick<
      HarthmereGlitchLiveActionDefinition,
      "sampleIntervalMs" | "playerBehavior"
    >
  > = {}
): HarthmereGlitchLiveActionDefinition => ({
  stepKey,
  label,
  description,
  sampleIntervalMs: options.sampleIntervalMs,
  playerBehavior: options.playerBehavior ?? true,
});

// Exhaustive coverage for every server-supported live action kind. NPC and
// boss ticks are marked as automation rather than player behavior; every other
// action produces semantic attempt/outcome events. Fast combat/environment
// actions are sampled while every failure is still reported.
export const HARTHMERE_GLITCH_LIVE_ACTION_BEHAVIORS = {
  request_attack: liveAction(
    "combat_action",
    "Combat Action",
    "The player attacks a combat target.",
    { playerBehavior: true, sampleIntervalMs: 5_000 }
  ),
  request_ability_cast: liveAction(
    "combat_ability",
    "Ability Cast",
    "The player casts a combat ability.",
    { playerBehavior: true, sampleIntervalMs: 5_000 }
  ),
  request_equipment_change: liveAction(
    "equipment_change",
    "Equipment Changed",
    "The player changes equipped gear."
  ),
  request_xp_reward: liveAction(
    "progression_xp",
    "Experience Earned",
    "The player earns experience toward progression."
  ),
  request_skill_progress: liveAction(
    "progression_skill",
    "Skill Progress",
    "The player advances a skill."
  ),
  request_loot_roll: liveAction(
    "loot_roll",
    "Loot Earned",
    "The player earns loot from gameplay.",
    { playerBehavior: true, sampleIntervalMs: 3_000 }
  ),
  request_loot_claim: liveAction(
    "loot_claim",
    "Loot Claimed",
    "The player claims a loot reward."
  ),
  request_death_transition: liveAction(
    "player_death",
    "Player Death",
    "The player enters the death state."
  ),
  request_environment_damage: liveAction(
    "environment_damage",
    "Environmental Damage",
    "The player takes damage from the environment.",
    { playerBehavior: true, sampleIntervalMs: 5_000 }
  ),
  request_revive: liveAction(
    "player_revive",
    "Player Revived",
    "The player is revived after death."
  ),
  request_respawn: liveAction(
    "player_respawn",
    "Player Respawned",
    "The player returns to play after death."
  ),
  request_npc_ai_tick: liveAction(
    "npc_automation",
    "NPC Automation Tick",
    "The server advances autonomous NPC behavior.",
    { playerBehavior: false }
  ),
  request_boss_tick: liveAction(
    "boss_automation",
    "Boss Automation Tick",
    "The server advances autonomous boss behavior.",
    { playerBehavior: false }
  ),
  request_pvp_flag_change: liveAction(
    "pvp",
    "PvP Activity",
    "The player participates in player-versus-player activity."
  ),
  request_pvp_reward: liveAction(
    "pvp",
    "PvP Activity",
    "The player participates in player-versus-player activity."
  ),
  request_party_raid_credit: liveAction(
    "party_raid",
    "Party or Raid Credit",
    "The player earns party or raid participation credit."
  ),
  request_trainer_unlock: liveAction(
    "progression_unlock",
    "Progression Unlocked",
    "The player unlocks an ability from a trainer."
  ),
  request_skill_book_use: liveAction(
    "skill_book",
    "Skill Book Used",
    "The player uses a skill book."
  ),
  request_respec: liveAction(
    "respec",
    "Character Respecialized",
    "The player changes their character specialization."
  ),
  request_loadout_change: liveAction(
    "loadout",
    "Loadout Changed",
    "The player changes their active loadout."
  ),
  request_inventory_mutation: liveAction(
    "inventory",
    "Inventory",
    "The player's inventory changes."
  ),
  request_inventory_item_action: liveAction(
    "inventory_item",
    "Inventory Item Used",
    "The player performs an action on an inventory item."
  ),
  request_container_transfer: liveAction(
    "container_transfer",
    "Container Transfer",
    "The player transfers an item between containers."
  ),
  request_vendor_transaction: liveAction(
    "vendor_transaction",
    "Vendor Transaction",
    "The player buys from or sells to a vendor."
  ),
  request_auction_post: liveAction(
    "auction_post",
    "Auction Listed",
    "The player lists an item at auction."
  ),
  request_auction_settle: liveAction(
    "auction_settle",
    "Auction Settled",
    "The player settles an auction transaction."
  ),
  request_auction_cancel: liveAction(
    "auction_cancel",
    "Auction Cancelled",
    "The player cancels an auction listing."
  ),
  request_auction_recover: liveAction(
    "auction_recover",
    "Auction Recovered",
    "The player recovers an auction item or proceeds."
  ),
  request_auction_expire: liveAction(
    "auction_expire",
    "Auction Expired",
    "An auction listing reaches its expiration flow."
  ),
  request_pay_fine: liveAction(
    "fine_payment",
    "Fine Paid",
    "The player pays an outstanding fine."
  ),
  request_clear_bounty: liveAction(
    "bounty_clear",
    "Bounty Cleared",
    "The player clears an outstanding bounty."
  ),
  request_bank_transaction: liveAction(
    "banking",
    "Banking",
    "The player uses the bank."
  ),
  request_mail_transaction: liveAction(
    "mail",
    "Mail Transaction",
    "The player sends, receives, or claims mail."
  ),
  request_guild_mutation: liveAction(
    "guild",
    "Guild",
    "The player participates in guild activity."
  ),
  request_economy_mutation: liveAction(
    "economy",
    "Economy",
    "The player's economy state changes."
  ),
  request_jobs_board_mutation: liveAction(
    "jobs_board",
    "Jobs Board Activity",
    "The player accepts, advances, or completes a board job."
  ),
  request_law_reputation_mutation: liveAction(
    "reputation",
    "Reputation",
    "The player's law or reputation state changes."
  ),
  request_magic_progress: liveAction(
    "magic",
    "Magic Progress",
    "The player advances magical progression."
  ),
  request_quest_state_update: liveAction(
    "quest",
    "Quest",
    "A quest changes state."
  ),
  request_property_building_mutation: liveAction(
    "building",
    "Building",
    "The player builds or changes property in the world."
  ),
  request_home_decoration: liveAction(
    "home_decorate",
    "Home Decoration",
    "The player changes decoration state in their home."
  ),
  request_world_placement: liveAction(
    "world_placement",
    "World Placement",
    "The player places an object in the world."
  ),
  request_crafting: liveAction(
    "crafting",
    "Crafting Activity",
    "The player crafts an item."
  ),
  request_farming_action: liveAction(
    "farming",
    "Farming or Food Activity",
    "The player farms, gathers, cooks, or consumes food."
  ),
  request_medical_action: liveAction(
    "medical",
    "Medical Activity",
    "The player performs a medical action."
  ),
  request_care_loop_action: liveAction(
    "care",
    "Care Activity",
    "The player performs a daily, care, or world interaction action."
  ),
} satisfies Record<
  HarthmereLiveModeActionKind,
  HarthmereGlitchLiveActionDefinition
>;

// Business-facing names for important operation-level stages. Unknown
// operations still receive a stable machine key and a humanized display label.
export const HARTHMERE_GLITCH_LIVE_OPERATION_BEHAVIORS: Record<
  string,
  Pick<HarthmereGlitchLiveActionDefinition, "stepKey" | "label" | "description">
> = {
  bible_quest_accept: {
    stepKey: "quest_accept",
    label: "Quest Accepted",
    description: "The player accepts a story quest.",
  },
  bible_quest_advance: {
    stepKey: "quest_objective",
    label: "Quest Objective",
    description: "The player completes an objective.",
  },
  bible_quest_complete: {
    stepKey: "quest_complete",
    label: "Quest Completed",
    description: "The player completes a story quest.",
  },
  accept_job: {
    stepKey: "job_accept",
    label: "Job Accepted",
    description: "The player accepts a board job.",
  },
  complete_job: {
    stepKey: "job_complete",
    label: "Job Completed",
    description: "The player completes a board job.",
  },
  complete_job_quest: {
    stepKey: "job_reward",
    label: "Job Reward Claimed",
    description: "The player claims a job reward.",
  },
  abandon_job: {
    stepKey: "job_abandon",
    label: "Job Abandoned",
    description: "The player abandons a board job.",
  },
  claim_loot_drop: {
    stepKey: "loot_claim",
    label: "Loot Claimed",
    description: "The player claims a loot reward.",
  },
  daily_check_in: {
    stepKey: "daily_check_in",
    label: "Daily Check-In",
    description: "The player claims a daily activity.",
  },
  cook_enqueue: {
    stepKey: "cooking_start",
    label: "Cooking Started",
    description: "The player starts a cooking job.",
  },
  cook_collect: {
    stepKey: "cooking_complete",
    label: "Cooking Collected",
    description: "The player collects cooked food.",
  },
  plant: {
    stepKey: "farming_plant",
    label: "Crop Planted",
    description: "The player plants a crop.",
  },
  water: {
    stepKey: "farming_water",
    label: "Crop Watered",
    description: "The player waters a crop.",
  },
  harvest: {
    stepKey: "farming_harvest",
    label: "Crop Harvested",
    description: "The player harvests a crop.",
  },
  eat_food: {
    stepKey: "food_consumed",
    label: "Food Consumed",
    description: "The player eats food.",
  },
  claim_plot: {
    stepKey: "property_claim",
    label: "Property Claimed",
    description: "The player claims a property plot.",
  },
  start_construction: {
    stepKey: "building_start",
    label: "Construction Started",
    description: "The player starts construction.",
  },
  place_decoration: {
    stepKey: "home_decorate",
    label: "Home Decoration",
    description: "The player changes decoration state in their home.",
  },
};
