export interface HarthmereGlitchEventText {
  step_label: string;
  step_description: string;
  event_label: string;
  event_description: string;
}

type StepText = Pick<
  HarthmereGlitchEventText,
  "step_label" | "step_description"
>;

type EventText = Pick<
  HarthmereGlitchEventText,
  "event_label" | "event_description"
>;

export interface HarthmereGlitchFunnelStepDefinition {
  step_key: string;
  label: string;
  description: string;
}

export interface HarthmereGlitchFunnelDefinition {
  name: string;
  description: string;
  steps: HarthmereGlitchFunnelStepDefinition[];
}

const STEP_TEXT: Record<string, StepText> = {
  game_boot: {
    step_label: "Game Boot",
    step_description: "The game starts.",
  },
  glitch_auth: {
    step_label: "Glitch Sign-In",
    step_description: "The game validates the player install.",
  },
  loading: {
    step_label: "Game Loading",
    step_description: "The client loads the playable world.",
  },
  onboarding_intro: {
    step_label: "Onboarding Intro",
    step_description: "The player sees the welcome screen.",
  },
  onboarding_name: {
    step_label: "Choose a Name",
    step_description: "The player chooses a display name.",
  },
  character_builder: {
    step_label: "Character Builder",
    step_description: "The player customizes their character.",
  },
  onboarding_wakeup: {
    step_label: "Wake Up",
    step_description: "The player finishes the opening sequence.",
  },
  gameplay: {
    step_label: "Gameplay",
    step_description: "The player enters the world.",
  },
  first_movement: {
    step_label: "First Movement",
    step_description: "The player moves in the world.",
  },
  movement: {
    step_label: "Player Movement",
    step_description: "The player moves through the world.",
  },
  exploration: {
    step_label: "World Exploration",
    step_description: "The player discovers and enters world environments.",
  },
  npc_dialogue: {
    step_label: "NPC Conversation",
    step_description: "The player starts a conversation.",
  },
  quest_active: {
    step_label: "Quest Accepted",
    step_description: "The player starts a quest.",
  },
  quest_objective: {
    step_label: "Quest Objective",
    step_description: "The player completes an objective.",
  },
  quest_reward: {
    step_label: "Quest Reward",
    step_description: "The player completes a quest.",
  },
  quest_abandon: {
    step_label: "Quest Abandoned",
    step_description: "The player abandons a quest.",
  },
  vendor_open: {
    step_label: "Vendor Opened",
    step_description: "The player opens a shop.",
  },
  crafting_station: {
    step_label: "Crafting Station",
    step_description: "The player opens a crafting station.",
  },
  crafting_complete: {
    step_label: "Craft Completed",
    step_description: "The player completes a craft.",
  },
  equipment_change: {
    step_label: "Equipment Changed",
    step_description: "The player changes equipped gear.",
  },
  inventory_capacity: {
    step_label: "Inventory Full",
    step_description: "An item overflows the inventory.",
  },
  mail_received: {
    step_label: "Mail Received",
    step_description: "The player receives mail.",
  },
  minigame_complete: {
    step_label: "Minigame Completed",
    step_description: "The player finishes a minigame.",
  },
  minigame_exit: {
    step_label: "Minigame Exited",
    step_description: "The player leaves a minigame.",
  },
  biomes_ui: {
    step_label: "Game Menu",
    step_description: "The player uses the main game menu.",
  },
  social_profile: {
    step_label: "Player Profile",
    step_description: "The player views a social profile.",
  },
  social_photo: {
    step_label: "Photo Sharing",
    step_description: "The player captures, views, or shares a photo.",
  },
  travel: {
    step_label: "World Travel",
    step_description: "The player travels or warps to another location.",
  },
  hotbar: {
    step_label: "Hotbar",
    step_description: "The player uses a hotbar slot.",
  },
  inventory: {
    step_label: "Inventory",
    step_description: "The player's inventory changes.",
  },
  economy: {
    step_label: "Economy",
    step_description: "The player's economy state changes.",
  },
  vendor_transaction: {
    step_label: "Vendor Transaction",
    step_description: "The player buys from or sells to a vendor.",
  },
  banking: {
    step_label: "Banking",
    step_description: "The player uses the bank.",
  },
  dialogue: {
    step_label: "Dialogue",
    step_description: "The player talks with a character.",
  },
  quest: {
    step_label: "Quest",
    step_description: "A quest changes state.",
  },
  mission: {
    step_label: "Mission",
    step_description: "A mission makes progress.",
  },
  combat: {
    step_label: "Combat",
    step_description: "The player is in combat.",
  },
  combat_action: {
    step_label: "Combat Action",
    step_description: "The player attacks a combat target.",
  },
  combat_ability: {
    step_label: "Ability Cast",
    step_description: "The player casts a combat ability.",
  },
  environment_damage: {
    step_label: "Environmental Damage",
    step_description: "The player takes damage from the environment.",
  },
  player_death: {
    step_label: "Player Death",
    step_description: "The player enters the death state.",
  },
  player_revive: {
    step_label: "Player Revived",
    step_description: "The player is revived after death.",
  },
  player_respawn: {
    step_label: "Player Respawned",
    step_description: "The player returns to play after death.",
  },
  progression: {
    step_label: "Progression",
    step_description: "The player advances their character.",
  },
  progression_xp: {
    step_label: "Experience Progress",
    step_description: "The player earns experience toward progression.",
  },
  progression_skill: {
    step_label: "Skill Progress",
    step_description: "The player advances a skill.",
  },
  class_progression: {
    step_label: "Class Progression",
    step_description: "The player's class or skill state changes.",
  },
  building: {
    step_label: "Building",
    step_description: "The player builds or changes property in the world.",
  },
  gathering: {
    step_label: "Gathering",
    step_description: "The player gathers resources from the world.",
  },
  guild: {
    step_label: "Guild",
    step_description: "The player participates in guild activity.",
  },
  quest_economy: {
    step_label: "Quest Economy",
    step_description: "Quest rewards or costs change the player's economy.",
  },
  reputation: {
    step_label: "Reputation",
    step_description: "The player's law or reputation state changes.",
  },
  storage_mail: {
    step_label: "Storage and Mail Recovery",
    step_description: "The player's stored items or recovery mail changes.",
  },
  trade_auction: {
    step_label: "Trade and Auction",
    step_description: "The player participates in trade or auction activity.",
  },
  multiplayer_combat: {
    step_label: "Multiplayer Combat",
    step_description: "The player's multiplayer combat state changes.",
  },
  survival: {
    step_label: "Food and Stamina",
    step_description: "The player's food or stamina state changes.",
  },
  companion: {
    step_label: "Companion Activity",
    step_description: "A player companion's state changes.",
  },
  helper_quest: {
    step_label: "Companion Quest",
    step_description: "The player advances a companion quest.",
  },
  world_interaction: {
    step_label: "World Interaction",
    step_description: "The player physically interacts with a world object.",
  },
  robot: {
    step_label: "Robot Interaction",
    step_description: "The player interacts with a robot field.",
  },
  onboarding_nux: {
    step_label: "Guided Tutorial",
    step_description: "The player advances a guided tutorial.",
  },
  onboarding_practice: {
    step_label: "Tutorial Practice",
    step_description: "The player practices a guided gameplay action.",
  },
  interface: {
    step_label: "Game Interface",
    step_description: "The player uses a game control.",
  },
  session: {
    step_label: "Play Session",
    step_description: "The play session changes state.",
  },
};

const ACTION_TEXT: Record<string, EventText> = {
  start: {
    event_label: "Started",
    event_description: "The player started this stage or activity.",
  },
  stop: {
    event_label: "Stopped",
    event_description: "The player stopped this stage or activity.",
  },
  success: {
    event_label: "Succeeded",
    event_description: "The player's requested action succeeded.",
  },
  fail: {
    event_label: "Failed",
    event_description: "The player's requested action failed.",
  },
  error: {
    event_label: "Error",
    event_description: "An error interrupted the player's activity.",
  },
  guest: {
    event_label: "Continued as Guest",
    event_description: "The player continued with a guest session.",
  },
  complete: {
    event_label: "Completed",
    event_description: "The player completed this stage or activity.",
  },
  screen_view: {
    event_label: "Viewed",
    event_description: "The player viewed this screen or location.",
  },
  submit: {
    event_label: "Submitted",
    event_description: "The player submitted the requested information.",
  },
  click_continue: {
    event_label: "Continued",
    event_description: "The player selected the continue control.",
  },
  keyboard_continue: {
    event_label: "Continued by Keyboard",
    event_description: "The player continued with a keyboard control.",
  },
  keyboard_complete: {
    event_label: "Completed by Keyboard",
    event_description:
      "The player completed the stage with a keyboard control.",
  },
  change_field: {
    event_label: "Changed Character Option",
    event_description: "The player changed a character customization option.",
  },
  change_clothing: {
    event_label: "Changed Clothing",
    event_description: "The player changed a clothing item.",
  },
  apply_clothing_preset: {
    event_label: "Applied Clothing Preset",
    event_description: "The player applied a clothing preset.",
  },
  cloud_restore_auto_apply: {
    event_label: "Restored Character",
    event_description: "The game restored the player's saved character.",
  },
  continue_to_wakeup: {
    event_label: "Continued to Wake Up",
    event_description:
      "The player continued from character creation to wake up.",
  },
  entered_world: {
    event_label: "Entered World",
    event_description: "The player entered the playable world.",
  },
  open_tab: {
    event_label: "Opened Tab",
    event_description: "The player opened a game menu tab.",
  },
  close: {
    event_label: "Closed",
    event_description: "The player closed this screen or activity.",
  },
  select_slot: {
    event_label: "Selected Slot",
    event_description: "The player selected an inventory or hotbar slot.",
  },
  use_slot: {
    event_label: "Used Slot",
    event_description: "The player used the selected hotbar slot.",
  },
  drop_slot: {
    event_label: "Dropped Slot Item",
    event_description: "The player dropped the item in a hotbar slot.",
  },
  remove_slot: {
    event_label: "Removed Slot Item",
    event_description: "The player removed the item from a hotbar slot.",
  },
  state_changed: {
    event_label: "State Changed",
    event_description: "The player's state changed in this gameplay system.",
  },
  action_click: {
    event_label: "Selected Action",
    event_description: "The player selected an available action.",
  },
  progress: {
    event_label: "Progressed",
    event_description: "The player made progress in this stage or activity.",
  },
  death: {
    event_label: "Player Died",
    event_description: "The player entered the death state.",
  },
  leveling_changed: {
    event_label: "Leveling Changed",
    event_description: "The player's level or experience changed.",
  },
  hidden: {
    event_label: "Game Hidden",
    event_description: "The game moved to the background.",
  },
  visible: {
    event_label: "Game Visible",
    event_description: "The game returned to the foreground.",
  },
  pagehide: {
    event_label: "Page Closing",
    event_description: "The game page began closing or navigating away.",
  },
  click: {
    event_label: "Clicked",
    event_description: "The player clicked a game control.",
  },
  attempt: {
    event_label: "Attempted",
    event_description: "The player attempted the requested action.",
  },
};

export function humanizeHarthmereGlitchKey(value: string) {
  const acronyms: Record<string, string> = {
    ai: "AI",
    api: "API",
    id: "ID",
    npc: "NPC",
    nux: "NUX",
    pvp: "PvP",
    ui: "UI",
    xp: "XP",
  };
  return value
    .replace(/^request_/, "")
    .replace(/[:._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      acronyms[word.toLowerCase()]
        ? acronyms[word.toLowerCase()]
        : `${word.charAt(0).toUpperCase()}${word.slice(1)}`
    )
    .join(" ");
}

export function normalizeHarthmereGlitchKey(
  value: string | undefined,
  fallback: string
) {
  const cleaned = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:.\-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
  return cleaned || fallback;
}

function displayText(value: string | undefined, maxLength: number) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

export function resolveHarthmereGlitchEventText(
  stepKey: string,
  actionKey: string,
  override: Partial<HarthmereGlitchEventText> = {}
): HarthmereGlitchEventText {
  const knownStep = STEP_TEXT[stepKey];
  const knownEvent = ACTION_TEXT[actionKey];
  const stepLabel = displayText(
    override.step_label ??
      knownStep?.step_label ??
      humanizeHarthmereGlitchKey(stepKey),
    255
  )!;
  const eventLabel = displayText(
    override.event_label ??
      knownEvent?.event_label ??
      humanizeHarthmereGlitchKey(actionKey),
    255
  )!;
  return {
    step_label: stepLabel,
    step_description: displayText(
      override.step_description ??
        knownStep?.step_description ??
        `${stepLabel} player activity.`,
      2_000
    )!,
    event_label: eventLabel,
    // Glitch stores this canonically per action_key, so the default must not
    // vary by step_key. Step-specific context belongs in step_description.
    event_description: displayText(
      override.event_description ??
        knownEvent?.event_description ??
        `The player performed the ${eventLabel.toLowerCase()} action.`,
      2_000
    )!,
  };
}

function funnelStep(stepKey: string): HarthmereGlitchFunnelStepDefinition {
  const text = resolveHarthmereGlitchEventText(stepKey, "complete");
  return {
    step_key: stepKey,
    label: text.step_label,
    description: text.step_description,
  };
}

// These objects match the documented POST /behavioral-funnels request shape.
// They are definitions only: creating them requires an admin JWT and must stay
// in a developer/admin workflow rather than the shipped game client.
export const HARTHMERE_GLITCH_DASHBOARD_FUNNELS: HarthmereGlitchFunnelDefinition[] =
  [
    {
      name: "New Player Onboarding",
      description:
        "Game boot through sign-in, loading, character creation, world entry, and first movement.",
      steps: [
        "game_boot",
        "glitch_auth",
        "loading",
        "onboarding_intro",
        "onboarding_name",
        "character_builder",
        "onboarding_wakeup",
        "gameplay",
        "first_movement",
      ].map(funnelStep),
    },
    {
      name: "First Quest Completion",
      description:
        "World entry through NPC conversation, quest acceptance, objective progress, and reward.",
      steps: [
        "gameplay",
        "npc_dialogue",
        "quest_active",
        "quest_objective",
        "quest_reward",
      ].map(funnelStep),
    },
    {
      name: "First Craft",
      description:
        "World entry through opening a crafting station and completing a craft.",
      steps: ["gameplay", "crafting_station", "crafting_complete"].map(
        funnelStep
      ),
    },
    {
      name: "First Vendor Transaction",
      description:
        "World entry through opening a vendor and completing an economy transaction.",
      steps: ["gameplay", "vendor_open", "vendor_transaction"].map(funnelStep),
    },
    {
      name: "Death and Recovery",
      description: "Combat through player death and return via respawn.",
      steps: ["combat", "player_death", "player_respawn"].map(funnelStep),
    },
  ];
