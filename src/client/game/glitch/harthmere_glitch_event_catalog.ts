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
  progression: {
    step_label: "Progression",
    step_description: "The player advances their character.",
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

const ACTION_LABELS: Record<string, string> = {
  start: "Started",
  stop: "Stopped",
  success: "Succeeded",
  fail: "Failed",
  error: "Error",
  guest: "Continued as Guest",
  complete: "Completed",
  screen_view: "Viewed",
  submit: "Submitted",
  click_continue: "Continued",
  keyboard_continue: "Continued by Keyboard",
  keyboard_complete: "Completed by Keyboard",
  change_field: "Changed Character Option",
  change_clothing: "Changed Clothing",
  apply_clothing_preset: "Applied Clothing Preset",
  cloud_restore_auto_apply: "Restored Character",
  continue_to_wakeup: "Continued to Wake Up",
  entered_world: "Entered World",
  open_tab: "Opened Tab",
  close: "Closed",
  select_slot: "Selected Slot",
  use_slot: "Used Slot",
  drop_slot: "Dropped Slot Item",
  remove_slot: "Removed Slot Item",
  state_changed: "State Changed",
  action_click: "Selected Action",
  progress: "Progressed",
  death: "Player Died",
  leveling_changed: "Leveling Changed",
  hidden: "Game Hidden",
  visible: "Game Visible",
  pagehide: "Page Closing",
  click: "Clicked",
  attempt: "Attempted",
};

export function humanizeHarthmereGlitchKey(value: string) {
  return value
    .replace(/^request_/, "")
    .replace(/[:._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

export function resolveHarthmereGlitchEventText(
  stepKey: string,
  actionKey: string,
  override: Partial<HarthmereGlitchEventText> = {}
): HarthmereGlitchEventText {
  const knownStep = STEP_TEXT[stepKey];
  const stepLabel =
    override.step_label ??
    knownStep?.step_label ??
    humanizeHarthmereGlitchKey(stepKey);
  const eventLabel =
    override.event_label ??
    ACTION_LABELS[actionKey] ??
    humanizeHarthmereGlitchKey(actionKey);
  return {
    step_label: stepLabel,
    step_description:
      override.step_description ??
      knownStep?.step_description ??
      `${stepLabel} activity.`,
    event_label: eventLabel,
    event_description:
      override.event_description ?? `${eventLabel} during ${stepLabel}.`,
  };
}
