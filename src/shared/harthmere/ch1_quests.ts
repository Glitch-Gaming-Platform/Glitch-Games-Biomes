// CHAPTER_1_QUEST_CATALOG
//
// Every authored quest in Chapter 1 ("Identity"), across six acts plus the
// existing prologue chain (Road Ahead -> Busted -> Get the Muck Out ->
// Muck vs. Machine).
//
// Chapter 1 is a LINEAR TRAGEDY and we are choosing that on purpose. What we
// owe the player in exchange for taking their agency at the climax is that the
// game never tricks them into it: they are told exactly what they are doing,
// they are reminded of the oath they swore, and they do it anyway.
//
// See docs/harthmere/CHAPTER_1_IDENTITY_WRITERS_JOURNAL.md §7.

import { CH1_FLAGS, CH1_TRACKS } from "@/shared/harthmere/ch1_ids";

export const CH1_QUESTS_VERSION = 1 as const;

export type Ch1StepTrigger =
  | "talk_npc"
  | "near_location"
  | "destroy"
  | "collect"
  | "place"
  | "use_item"
  | "interact"
  | "escort"
  | "defeat"
  | "minigame"
  | "dialogue_choice"
  | "sleep"
  | "give_item";

export interface Ch1QuestStep {
  id: string;
  title: string;
  objective: string;
  trigger: Ch1StepTrigger;
  targetLabel?: string;
  mapHint?: string;
  /** Fragment recovered on completing this step. */
  fragmentId?: string;
  /** Latent skill unlocked on completing this step. */
  latentSkillId?: string;
  /** Cutscene played on completing this step. */
  cutsceneId?: string;
  /** Items granted. */
  grants?: readonly string[];
  /** Native inventory evidence required before the objective can complete. */
  inventoryRequirements?: readonly {
    itemId: string;
    count: number;
    label: string;
  }[];
  /** Consume the inventory requirements in the same exactly-once transaction. */
  consumeInventoryRequirements?: boolean;
  /** Flags set. */
  setsFlags?: readonly string[];
  /** Writer-facing note. Never shipped. */
  note?: string;
}

export interface Ch1TrackDelta {
  track: string;
  delta: number;
}

export interface Ch1QuestDef {
  id: string;
  act: number;
  title: string;
  giver: string;
  district: string;
  summary: string;
  steps: readonly Ch1QuestStep[];
  requiresFlags?: readonly string[];
  setsFlags?: readonly string[];
  trackDeltas?: readonly Ch1TrackDelta[];
  /** True for the quest that closes its act. */
  actClose?: boolean;
  note?: string;
}

// ---------------------------------------------------------------------------
// Act 0 — Prologue (existing content, one added beat)
// ---------------------------------------------------------------------------

export const CH1_PROLOGUE_CHAIN: readonly string[] = Object.freeze([
  "Road Ahead",
  "Busted",
  "Get the Muck Out",
  "Muck vs. Machine",
]);

/**
 * The only change required to existing content: the final beat of Muck vs.
 * Machine. The repaired robot stands up, focuses on the player's face, tries
 * to resume a log, fails, and what comes out is the player's own voice, badly
 * artifacted, mid-sentence, saying something that makes no sense yet.
 *
 * The chapter starts on that sound.
 */
export const CH1_IGNITION = {
  afterQuestTitle: "Muck vs. Machine",
  cutsceneId: "ch1-ignition",
  setsFlags: [CH1_FLAGS.started],
  unlocksJournalTab: "recovered",
  line: "…custodian recognized. Resuming log playback. Entry four hundred and… entry four hundred and… entry—",
} as const;

// ---------------------------------------------------------------------------
// Act 1 — "What the Card Opens"  (Confusion and disorientation)
// ---------------------------------------------------------------------------

const ACT_1: readonly Ch1QuestDef[] = [
  {
    id: "ch1_a1_q01_morning_after",
    act: 1,
    title: "The Morning After",
    giver: "Jackie",
    district: "The Grove",
    summary:
      "Wake in the spare room above the Grove road-house. Eat, drink, check your kit, and don't go past the fence line.",
    requiresFlags: [CH1_FLAGS.started],
    note: "First time the game shows the player sleeping and waking — establishes the sleep-fragment channel. Jackie makes tea. She always makes tea. The player will drink it roughly forty times before they learn what it is.",
    steps: [
      {
        id: "wake_up",
        title: "Wake Up",
        objective:
          "Stand up from the bed in the spare room, then go downstairs to the ground floor for breakfast with Jackie at the hearth.",
        trigger: "sleep",
        targetLabel: "Bed",
        grants: ["item_ch1_breakfast_tea"],
      },
      {
        id: "the_tea",
        title: "Breakfast",
        objective: "Eat what Jackie put in front of you and drink the tea.",
        trigger: "use_item",
        targetLabel: "Tea",
        inventoryRequirements: [
          {
            itemId: "item_ch1_breakfast_tea",
            count: 1,
            label: "Jackie's breakfast tea",
          },
        ],
        consumeInventoryRequirements: true,
        note: "THE CURE. Played entirely straight, as domestic warmth, for three acts.",
      },
      {
        id: "kit_check",
        title: "Kit Check",
        objective: "Let Jackie look through your pack.",
        trigger: "talk_npc",
        targetLabel: "Jackie",
        note: "She pulls things out and puts things in and does not explain how she knows. Seed for the Act 3 provisioning scene.",
      },
    ],
  },
  {
    id: "ch1_a1_q02_a_name_for_the_board",
    act: 1,
    title: "A Name for the Board",
    giver: "Taye",
    district: "The Grove",
    summary:
      "The Grove needs to put something on the ledger. Pick a name and let Taye paint it.",
    note: "Diegetic character naming. Taye: 'Nobody finds their name. Everybody gets given one and then spends a while growing into it. You're just doing it faster than most.'",
    steps: [
      {
        id: "choose_a_name",
        title: "Choose a Name",
        objective: "Tell Taye what to paint.",
        trigger: "dialogue_choice",
        targetLabel: "Taye",
      },
      {
        id: "see_it_painted",
        title: "See It Painted",
        objective: "Wait for the board to dry.",
        trigger: "interact",
        targetLabel: "Grove Guild Charter Board",
      },
    ],
  },
  {
    id: "ch1_a1_q03_stand_him_up",
    act: 1,
    title: "Stand Him Up",
    giver: "Luis",
    district: "The Grove",
    summary:
      "Rebuild enough of the mucked robot's chassis for it to walk. It will follow you afterwards, and it will not stop calling you Custodian.",
    steps: [
      {
        id: "gather_parts",
        title: "Gather Parts",
        objective:
          "Get 4 Scrap Metal, 2 Iron Ingots, and 1 Tree Resin by gathering, buying, or crafting them. Open Quests to choose and track a source, then bring the materials to Luis's Repair Cart.",
        trigger: "collect",
        targetLabel: "Luis's Repair Cart",
        inventoryRequirements: [
          { itemId: "scrap_metal", count: 4, label: "scrap metal" },
          { itemId: "iron_ingot", count: 2, label: "iron ingots" },
          { itemId: "tree_resin", count: 1, label: "tree resin" },
        ],
        consumeInventoryRequirements: true,
        grants: ["item_augur9_core_cell"],
      },
      {
        id: "seat_the_core",
        title: "Seat the Core",
        objective: "Fit a core cell and bring the unit up.",
        trigger: "interact",
        targetLabel: "AUGUR-9",
        inventoryRequirements: [
          {
            itemId: "item_augur9_core_cell",
            count: 1,
            label: "core cell",
          },
        ],
        consumeInventoryRequirements: true,
        note: "Luis states the charge cost out loud, once, so the player understands that remembering costs the robot life.",
      },
      {
        id: "first_log",
        title: "Play the First Log",
        objective: "Ask AUGUR-9 what it remembers.",
        trigger: "interact",
        targetLabel: "AUGUR-9",
        fragmentId: "frag_a1_play_run_it_again",
      },
    ],
  },
  {
    id: "ch1_a1_q04_what_the_water_gives",
    act: 1,
    title: "What the Water Gives",
    giver: "Dimmi",
    district: "Shutter Cove",
    summary:
      "Dimmi collects what the tide returns. Some of it should not exist. Your card gets hottest exactly where the strangest things wash up.",
    note: "First thread of the real plot, delivered by a side character, in a side conversation, about junk on a beach. Correct.",
    steps: [
      {
        id: "walk_the_waterline",
        title: "Walk the Waterline",
        objective: "Follow Dimmi along the cove and watch the card.",
        trigger: "near_location",
        targetLabel: "Shutter Cove Photo Marker",
      },
      {
        id: "sort_the_finds",
        title: "Sort the Finds",
        objective: "Help Dimmi lay out what the water gave back.",
        trigger: "interact",
        targetLabel: "Dimmi",
      },
    ],
  },
  {
    id: "ch1_a1_q05_the_fence_line",
    act: 1,
    title: "The Fence Line",
    giver: "Jackie",
    district: "The Grove",
    summary: "Walk the fence line at dusk. Do not go past it.",
    actClose: true,
    setsFlags: [CH1_FLAGS.act1Complete, CH1_FLAGS.seenFirstGate],
    note: "The card goes hot enough to hurt. At the open boundary stones beyond the broken fence there is a vertical seam of light, two metres tall, humming, and it closes on its own after ninety seconds. Jackie sees the player's face and says the first thing in the chapter that doesn't fit: '…You've seen one before.' The player has not. The answer that comes out of their mouth without permission is: 'Not this small.'",
    steps: [
      {
        id: "walk_with_jackie",
        title: "Walk the Fence",
        objective: "Follow Jackie to the broken safe-zone fence.",
        trigger: "near_location",
        targetLabel: "Broken Safe-Zone Fence",
      },
      {
        id: "the_seam",
        title: "The Seam",
        objective: "Look at the thing in the air and do not go closer.",
        trigger: "near_location",
        targetLabel: "The Fence Line Seam",
        cutsceneId: "ch1-first-gate",
        fragmentId: "frag_a1_echo_get_back",
      },
      {
        id: "not_this_small",
        title: '"Not This Small"',
        objective:
          "Tell Jackie what you think about the seam in the air — is it smaller or larger than the fracture you remember from before?",
        trigger: "dialogue_choice",
        targetLabel: "Jackie",
        note: "All dialogue options produce the same line. The player does not choose this.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Act 2 — "Names Worth Keeping"  (Formation of new memories)
// ---------------------------------------------------------------------------

const ACT_2: readonly Ch1QuestDef[] = [
  {
    id: "ch1_a2_q01_the_ledger_opens",
    act: 2,
    title: "The Ledger Opens",
    giver: "Doc",
    district: "The Grove",
    summary:
      "Doc gives your condition a name, and one piece of advice you will ignore.",
    requiresFlags: [CH1_FLAGS.act1Complete],
    note: "THE FAIR-PLAY CONTRACT FOR THE WHOLE CHAPTER. Doc, flat and clinical: 'Anterograde's the front half. You'll make new memories fine. Retrograde's the back half, and it doesn't come back clean. What comes back gets REBUILT, and the brain fills the gaps with whatever's handy. Best guesses. Confident ones. Don't marry the first version of anything.' Then the game spends three hours making the player marry the first version of everything. He also says, in the same breath, that a sequestrant of this class 'defends itself' — the seed for why Jackie cannot simply explain.",
    steps: [
      {
        id: "sit_for_doc",
        title: "Sit for Doc",
        objective: "Let Doc look at you properly.",
        trigger: "talk_npc",
        targetLabel: "Doc",
      },
      {
        id: "open_the_tab",
        title: "Open the Ledger",
        objective: "Start writing down what comes back.",
        trigger: "interact",
        targetLabel: "Journal",
        fragmentId: "frag_a4_echo_defends_itself",
        note: "The 'defends itself' echo is seeded HERE, in Act 2, at low confidence, so that on replay the player can see it was always there.",
      },
    ],
  },
  {
    id: "ch1_a2_q02_work_the_board",
    act: 2,
    title: "Work the Board",
    giver: "Jobs Board",
    district: "The Grove",
    summary:
      "Take work. Learn how the Grove actually survives a week. Meet everybody while you do it.",
    note: "Hub act. Also the provisioning literacy gate for Act 3 — the player has to know who supplies what before the desert asks them.",
    steps: [
      {
        id: "take_jobs",
        title: "Take Work",
        objective:
          "Use the Jobs Board to accept and complete three Grove jobs. Finish each job through its normal objective before returning to the board.",
        trigger: "interact",
        targetLabel: "Jobs Board",
      },
      {
        id: "meet_the_suppliers",
        title: "Meet the Suppliers",
        objective:
          "Trade with Rin, Fern, Gus, Carlo, Mel, and Luis at least once each.",
        trigger: "interact",
        targetLabel: "Grove suppliers",
      },
    ],
  },
  {
    id: "ch1_a2_q03_the_night_you_came",
    act: 2,
    title: "The Night You Came",
    giver: "Coretta",
    district: "The Grove",
    summary:
      "Twelve people saw something that night. Nobody saw all of it. Ask all twelve.",
    note: "Each testimony is one true sentence that supports both readings without either requiring a stretch. The reward is a RECONSTRUCTION the player assembles themselves — nobody lies to them, they do it.",
    steps: [
      {
        id: "collect_testimonies",
        title: "Ask Around",
        objective: "Collect all twelve accounts of the night you arrived.",
        trigger: "talk_npc",
        targetLabel: "Grove residents",
      },
      {
        id: "put_it_together",
        title: "Put It Together",
        objective: "Read the twelve accounts in one sitting.",
        trigger: "interact",
        targetLabel: "Journal",
        fragmentId: "frag_a2_recon_arrival",
        cutsceneId: "ch1-recon-arrival",
        setsFlags: [CH1_FLAGS.believesJackieHostile],
      },
    ],
  },
  {
    id: "ch1_a2_q04_the_visiting_doctor",
    act: 2,
    title: "The Visiting Doctor",
    giver: "Jackie",
    district: "Greenlamp",
    summary:
      "A specialist has come to consult on the Grove's memory-sickness cases. Jackie wants you to go and see him.",
    setsFlags: [CH1_FLAGS.metLou],
    trackDeltas: [{ track: CH1_TRACKS.louTrust, delta: 20 }],
    note: "JACKIE SENDS THEM. She has to — refusing would be conspicuous, and she needs to know what he wants. It is the closest thing to a mistake she makes in the chapter and it costs her everything. Lou examines the player, tells them the truth as far as it goes, refuses payment, and asks for nothing.",
    steps: [
      {
        id: "go_to_greenlamp",
        title: "Go to Greenlamp",
        objective: "Walk to the Greenlamp Walk-In Clinic.",
        trigger: "near_location",
        targetLabel: "Greenlamp Walk-In Clinic",
      },
      {
        id: "the_examination",
        title: "The Examination",
        objective: "Let the visiting specialist examine you.",
        trigger: "talk_npc",
        targetLabel: "Dr. Lucien Ardan",
        fragmentId: "frag_a2_overlay_ive_got_you",
        cutsceneId: "ch1-overlay-ive-got-you",
        note: "'You hold your pen like a physicist. Sorry. That's a strange thing to say to a stranger.' The player's brain files him under RESCUE inside ninety seconds, and it is not wrong, and that is the trap.",
      },
    ],
  },
  {
    id: "ch1_a2_q05_footprints",
    act: 2,
    title: "Footprints",
    giver: "Halden Rook",
    district: "Old Wood Copse",
    summary:
      "The second gate did not close. Something walked out of it and stopped halfway.",
    actClose: true,
    setsFlags: [
      CH1_FLAGS.act2Complete,
      CH1_FLAGS.gatePersistentOpen,
      CH1_FLAGS.metRook,
    ],
    note: "Rook, at the treeline, having crossed a bridge he is not supposed to cross: 'Two years I have watched these open on your side of the river and never once on mine. I would like someone from the Grove to say the obvious sentence out loud. Just once. I will wait.'",
    steps: [
      {
        id: "kit_delivers",
        title: "A Packet for No One",
        objective: "Watch Kit deliver a sealed packet Jackie does not open.",
        trigger: "talk_npc",
        targetLabel: "Kit the Courier",
      },
      {
        id: "the_footprints",
        title: "The Footprints",
        objective: "Go out to the Old Wood copse at first light.",
        trigger: "near_location",
        targetLabel: "The Old Wood Aperture",
        cutsceneId: "ch1-persistent-gate",
      },
      {
        id: "say_the_sentence",
        title: "Say the Obvious Sentence",
        objective:
          "Tell Halden Rook that the footprints stop where something appeared.",
        trigger: "dialogue_choice",
        targetLabel: "Halden Rook",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Act 3 — "The Sand That Remembers"  (Fragmented recall)
// ---------------------------------------------------------------------------

const ACT_3: readonly Ch1QuestDef[] = [
  {
    id: "ch1_a3_q01_a_button_in_the_sand",
    act: 3,
    title: "A Button in the Sand",
    giver: "Rin the Forager",
    district: "Old Wood Copse",
    summary:
      "A modern coat button, sold in a Grove shop nine months ago, sitting in a fold of sandal-print sand. A child went missing eleven days ago and everyone assumed the Muck.",
    requiresFlags: [CH1_FLAGS.act2Complete],
    note: "This is what settles the argument. Jane wants it roped off, Vane wants it studied, Rook wants it collapsed, Jackie wants the player nowhere near it with an intensity she cannot justify out loud. Then somebody's kid is in there.",
    steps: [
      {
        id: "examine_the_button",
        title: "Examine the Button",
        objective:
          "Go to Shutter Cove and pick up the worn coat button that Rin found in the tide wrack. It's from a Grove shop — from nine months ago.",
        trigger: "collect",
        targetLabel: "A Coat Button",
        grants: ["item_iris_button"],
      },
      {
        id: "the_three_answers",
        title: "Three Answers",
        objective: "Hear out Ranger Jane, Arbiter Vane, and Halden Rook.",
        trigger: "talk_npc",
        targetLabel: "Ranger Jane",
      },
    ],
  },
  {
    id: "ch1_a3_q02_pack_for_it",
    act: 3,
    title: "Pack For It",
    giver: "Jackie",
    district: "The Grove",
    summary:
      "There are no shops in there. Take everything you are going to need and then take more.",
    note: "The full economy loop, mandatory. Jackie checks the pack at the gate and pulls things out and puts things in and does not explain how she knows. She has been through a Mouth. Twice. She cannot say so.",
    steps: [
      {
        id: "provision",
        title: "Provision",
        objective:
          "Pack water, food, cooked rations, forage, light, repair kits, and field medicine. Open Quests to choose and track a gather, buy, or craft source for every missing supply.",
        trigger: "collect",
        targetLabel: "Provisioning checklist",
      },
      {
        id: "lous_gift",
        title: "The Case Notes",
        objective: "Take what the doctor is offering you.",
        trigger: "talk_npc",
        targetLabel: "Dr. Lucien Ardan",
        grants: ["item_lou_case_notes"],
        note: "'You'll want to know whether the man treating you is the man who put you here. So here's everything I have, and I'll be here when you get back either way. Read it in the dark somewhere. It's not flattering to me.' Honest. Complete. Contains no lie of any kind. Also does not contain the fourteen hours before intake.",
      },
      {
        id: "the_pack_check",
        title: "The Pack Check",
        objective: "Let Jackie look through it one more time.",
        trigger: "talk_npc",
        targetLabel: "Jackie",
      },
    ],
  },
  {
    id: "ch1_a3_d1_the_sand_that_remembers",
    act: 3,
    title: "The Sand That Remembers",
    giver: "—",
    district: "Fracture Gate: the Dry Mouth",
    summary:
      "A city dying of thirst on top of something it has no word for. Bring back the reference mass. Bring back the child.",
    note: "Dungeon 1. Seven zones, no merchants, no rest, no resupply. See ch1_dungeons.ts.",
    steps: [
      {
        id: "d1_dune_threshold",
        title: "Cross the Dunes",
        objective: "Reach the city before the water runs out.",
        // Crossing the threshold spends the first water interval and drains
        // native stamina. It must use the signed Chapter 1 interaction path;
        // a proximity trigger would complete in native ECS without ever
        // applying the survival consequence.
        trigger: "minigame",
        targetLabel: "The Salt Market",
      },
      {
        id: "d1_salt_market",
        title: "The Salt Market",
        objective:
          "The Salt-Cured Muckers block the bazaar route forward. Defeat them or find another way through the city.",
        trigger: "defeat",
        targetLabel: "Salt-Cured Muckers",
      },
      {
        id: "d1_cistern_stair",
        title: "The Cistern Stair",
        objective: "Descend the cistern without drowning or going dark.",
        // Route selection is a real mechanic: auto-completing on proximity
        // bypassed both finite light and the no-air shortcut consequence.
        trigger: "minigame",
        targetLabel: "The Hall of Weights",
      },
      {
        id: "ch1_a3_d1_hall_of_weights",
        title: "The Hall of Weights",
        objective: "Produce an exact mass against the temple's own standard.",
        trigger: "minigame",
        targetLabel: "Temple balance beam",
        latentSkillId: "ls_field_calibration",
        fragmentId: "frag_a3_play_ninth_paper",
        note: "Every modern instrument disagrees by amounts that are small, consistent, and impossible. The answer is to stop trusting instruments. You cannot measure anything against the present; you can only measure things against each other.",
      },
      {
        id: "d1_sun_court",
        title: "The Sun Court",
        objective:
          "The Gilded Bull stands before the exit. Defeat it or find a way around it to reach the vault beyond.",
        trigger: "defeat",
        targetLabel: "The Gilded Bull",
        grants: ["item_bulls_core"],
      },
      {
        id: "d1_seed_vault",
        title: "The Seed Vault",
        objective: "Find what the temple was keeping.",
        trigger: "collect",
        targetLabel: "The First Grain",
        grants: ["item_first_grain"],
        fragmentId: "frag_a3_recon_corridor",
        cutsceneId: "ch1-recon-corridor",
        setsFlags: [CH1_FLAGS.hasFirstGrain],
        note: "THE BIG LIE. Playable reconstruction of the night of the collapse. Every element real, the assembly inverted. No invented frames — verify in review.",
      },
      {
        id: "d1_find_iris",
        title: "The Girl in the Granary",
        objective: "Get Iris Fen on her feet.",
        trigger: "talk_npc",
        targetLabel: "Iris Fen",
        fragmentId: "frag_a3_echo_cold_to_stand_next_to",
      },
      {
        id: "d1_the_long_walk",
        title: "The Long Walk",
        objective:
          "Get Iris, Marrow, and the Grain four hundred metres across open flat in a sandstorm.",
        trigger: "escort",
        targetLabel: "Return aperture",
        setsFlags: [CH1_FLAGS.irisRescued, CH1_FLAGS.marrowSaved],
      },
    ],
  },
  {
    id: "ch1_a3_q03_three_days",
    act: 3,
    title: "Three Days",
    giver: "Jackie",
    district: "The Grove",
    summary:
      "You were in there for about ninety minutes. The Grove has had three days.",
    actClose: true,
    setsFlags: [CH1_FLAGS.act3Complete],
    trackDeltas: [{ track: CH1_TRACKS.jackieTrust, delta: -20 }],
    note: "Jackie has not slept. She grabs the player by both arms before she thinks better of it. And the player, fresh out of the reconstruction, FLINCHES. She sees it. She knows exactly what it means. And because she cannot explain without making it worse, she lets go, steps back, and says: 'Right. Okay. Yeah.'",
    steps: [
      {
        id: "come_back_out",
        title: "Come Back Out",
        objective:
          "Exit the Dry Mouth dungeon through the return aperture and step back into the Grove. Jackie should be waiting.",
        trigger: "near_location",
        targetLabel: "The Grove",
      },
      {
        id: "the_flinch",
        title: "The Flinch",
        objective:
          "Let Jackie see your face after you return. Let her know what you found down there.",
        trigger: "talk_npc",
        targetLabel: "Jackie",
        cutsceneId: "ch1-the-flinch",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Act 4 — "Hands That Know"  (Recognition before recall)
// ---------------------------------------------------------------------------

const ACT_4: readonly Ch1QuestDef[] = [
  {
    id: "ch1_a4_q01_the_stones_are_flat",
    act: 4,
    title: "The Stones Are Flat",
    giver: "Sil",
    district: "Mosslawn",
    summary:
      "The song stones have been half a tone flat for a year and nobody could say why.",
    requiresFlags: [CH1_FLAGS.act3Complete],
    steps: [
      {
        id: "hear_it",
        title: "Hear It",
        objective: "Listen to the song stones.",
        trigger: "interact",
        targetLabel: "Mosslawn Song Stones",
        fragmentId: "frag_a4_echo_the_stones_are_flat",
      },
      {
        id: "tell_sil_why",
        title: "Tell Sil Why",
        objective: "Explain what is under the stones.",
        trigger: "dialogue_choice",
        targetLabel: "Sil",
        latentSkillId: "ls_anchor_read",
        note: "Sil weeps. The player doesn't know why they're right.",
      },
    ],
  },
  {
    id: "ch1_a4_q02_thirty_one_seconds",
    act: 4,
    title: "Thirty-One Seconds",
    giver: "Foreman Calla Ashe",
    district: "Ashline Containment Works",
    summary:
      "A containment core goes into runaway during a shift change. Calla has forty seconds of procedure and needs four minutes.",
    setsFlags: [CH1_FLAGS.collectiveConfirmedIdentity],
    trackDeltas: [{ track: CH1_TRACKS.louTrust, delta: 15 }],
    note: "CANNOT BE FAILED. On timeout the player's hands complete it and the player watches. Afterwards Calla asks how, and all four dialogue options are 'I don't know'. HIDDEN: Calla files an incident report because she has to; it reaches Collective Civil in a day; Vane reads a stabilization method that exists in one sealed file. This is the moment the Collective confirms it has found the player, and everything Lou does from here runs on a clock he does not mention.",
    steps: [
      {
        id: "walk_in",
        title: "Walk In",
        objective: "Get to the containment floor.",
        trigger: "near_location",
        targetLabel: "Ashline Containment Works",
      },
      {
        id: "the_procedure",
        title: "The Procedure",
        objective:
          "The containment core is in runaway. You have forty seconds to stabilize it using the lattice controls. Follow the procedure or watch it fail.",
        trigger: "minigame",
        targetLabel: "Containment lattice",
        latentSkillId: "ls_containment_triage",
        fragmentId: "frag_a4_overlay_thirty_one_seconds",
        cutsceneId: "ch1-overlay-containment",
      },
      {
        id: "how_did_you_do_that",
        title: '"How Did You Do That?"',
        objective:
          "Calla Ashe asks you how you knew exactly what to do with those controls. Answer her honestly — how did you know?",
        trigger: "dialogue_choice",
        targetLabel: "Foreman Calla Ashe",
        note: "Four options. All four are 'I don't know', phrased differently. That's the scene.",
      },
    ],
  },
  {
    id: "ch1_a4_q03_what_the_devils_know",
    act: 4,
    title: "What the Devils Know",
    giver: "Halden Rook",
    district: "Old Bridge",
    summary:
      "Rook has spent two years failing to predict a collapse. You do it to the second, in front of him.",
    setsFlags: [CH1_FLAGS.rookToken],
    steps: [
      {
        id: "call_the_collapse",
        title: "Call the Collapse",
        objective: "Tell Rook when the gate will close.",
        trigger: "dialogue_choice",
        targetLabel: "Halden Rook",
        latentSkillId: "ls_gate_timing",
      },
      {
        id: "take_the_token",
        title: "Take the Token",
        objective: "Accept Harthmere safe-conduct.",
        trigger: "collect",
        targetLabel: "Bell-Iron Token",
        grants: ["item_rook_bell_iron_token"],
        note: "'I have been told my whole life that your people are clever devils. It is a great deal more frightening to learn you are simply clever.'",
      },
    ],
  },
  {
    id: "ch1_a4_q04_what_is_in_the_tea",
    act: 4,
    title: "What Is In the Tea",
    giver: "—",
    district: "The Grove",
    summary:
      "You notice her put something in it. Not because you were watching. Because you notice everything now.",
    note: "STEP 1-3 OF THE MISLEAD. The passive flag is the game telling the player something TRUE. The interpretation is theirs. Doc's analysis is accurate in every word: 'It's neuroactive. It's unregistered. It's not from any dispensary I know and it's not in any book I own. Whoever's making this is making it quietly.' Beat. 'How long's she been giving you this?'",
    steps: [
      {
        id: "notice",
        title: "Notice",
        objective: "Watch Jackie make the tea.",
        trigger: "interact",
        targetLabel: "Jackie's kettle",
      },
      {
        id: "search_the_stores",
        title: "Search the Stores",
        objective:
          "Search the dented tea tin in the road-house stores and take a vial of the compound.",
        trigger: "collect",
        targetLabel: "Dented Tea Tin",
        grants: ["item_jackies_tin", "item_ch1_compound_b"],
      },
      {
        id: "have_it_analysed",
        title: "Have It Analysed",
        objective:
          "Bring the vial from Jackie's tea tin to Doc's field table for analysis.",
        trigger: "give_item",
        targetLabel: "Doc",
        inventoryRequirements: [
          {
            itemId: "item_ch1_compound_b",
            count: 1,
            label: "the vial from Jackie's tea tin",
          },
        ],
        fragmentId: "frag_a4_play_twenty_two",
      },
    ],
  },
  {
    id: "ch1_a4_q05_the_man_who_didnt_accuse",
    act: 4,
    title: "The Man Who Didn't Accuse",
    giver: "Dr. Lucien Ardan",
    district: "Greenlamp",
    summary: "Take it to the only other doctor you know.",
    trackDeltas: [{ track: CH1_TRACKS.louTrust, delta: 15 }],
    note: "THE FINEST THING LOU DOES. He does NOT accuse Jackie. 'I don't know what this is. I'd want to run it properly before I said anything about anyone.' Beat. 'But I'll tell you the thing I do know, and then I'll stop. Compounds like this aren't made in kitchens. They're made by people with access. And there aren't many organizations with that kind of access who'd have a reason to keep a person quiet in a small town.' He implies Take Terra without naming them. He is not lying. He is not even wrong about the access. He simply never mentions the third organization with that access, which is his.",
    steps: [
      {
        id: "show_him",
        title: "Show Him",
        objective: "Give the vial to Dr. Ardan.",
        trigger: "give_item",
        targetLabel: "Dr. Lucien Ardan",
        inventoryRequirements: [
          {
            itemId: "item_ch1_compound_b",
            count: 1,
            label: "the analysed tea vial",
          },
        ],
      },
    ],
  },
  {
    id: "ch1_a4_q06_teak",
    act: 4,
    title: "Teak",
    giver: "Sergeant Bram Holt",
    district: "The Grove",
    summary:
      "The watch picked up a man carrying Take Terra materials. He will talk about anything except the bottle.",
    setsFlags: [CH1_FLAGS.teakDetained],
    note: "Teak is loyal and stupid and scared. He refuses to say what the vials are and will not deny that Jackie is TT, because she is. Every evasion he makes confirms the wrong thing.",
    steps: [
      {
        id: "interrogate",
        title: "Ask Him",
        objective:
          "Find Teak Morrow at the Rat Crowns and ask him who supplied the strange compound to Jackie. He won't want to answer, but he might slip.",
        trigger: "talk_npc",
        targetLabel: 'Teague "Teak" Morrow',
      },
    ],
  },
  {
    id: "ch1_a4_q07_ask_me_in_a_month",
    act: 4,
    title: "Ask Me In a Month",
    giver: "Jackie",
    district: "The Grove",
    summary: "Ask her.",
    actClose: true,
    setsFlags: [
      CH1_FLAGS.act4Complete,
      CH1_FLAGS.jackieExpelled,
      CH1_FLAGS.dosingStopped,
    ],
    trackDeltas: [{ track: CH1_TRACKS.jackieTrust, delta: -30 }],
    note: "She has three answers and all three are TRUE and all three sound like a guilty person: 'It's medicine' (refused; she can't say what for). 'You need to keep taking it' (an order, from the woman drugging you). 'Ask me again in a month' (genuinely her plan; sounds exactly like a stall). She never denies drugging them. She can't. She is. The act ends with her leaving the road-house, the player sleeping alone in it, and the first missed dose. Withdrawal is not painful. It is QUIET: the ledger stops producing fragments for the first time in three acts.",
    steps: [
      {
        id: "confront",
        title: "Confront Her",
        objective:
          "Face Jackie at the road-house and ask her directly what she's been putting in your tea. Demand an answer.",
        trigger: "dialogue_choice",
        targetLabel: "Jackie",
        cutsceneId: "ch1-confrontation",
      },
      {
        id: "report_or_not",
        title: "Decide",
        objective: "Report her to the watch, stop taking the tea, or both.",
        trigger: "dialogue_choice",
        targetLabel: "Grove Watch House",
        note: "Holt takes the statement at the Grove watch house where Jackie is being held. The imported snapshot does not guarantee his old North Gate entity or additive-town terrain.",
      },
      {
        id: "sleep_alone",
        title: "Sleep",
        objective: "Sleep in the road-house.",
        trigger: "sleep",
        targetLabel: "Bed",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Act 5 — "The Long Winter Mouth"  (Gradual reconstruction)
// ---------------------------------------------------------------------------

const ACT_5: readonly Ch1QuestDef[] = [
  {
    id: "ch1_a5_q01_the_ledger_goes_quiet",
    act: 5,
    title: "The Ledger Goes Quiet",
    giver: "—",
    district: "The Grove",
    summary: "Three acts of steady recovery, and now nothing. Work out why.",
    requiresFlags: [CH1_FLAGS.act4Complete],
    setsFlags: [CH1_FLAGS.dosingResumed, CH1_FLAGS.act5Linking],
    note: "THE TRAP THAT MAKES ACT 5 WORK: the player figures out the vials were HELPING and revises nothing else. They conclude Jackie was drugging them with something that happened to help, or managing them, or that TT wanted them functional for TT's own reasons. The correct conclusion — she was curing you — requires an assumption of good faith the Act 3 reconstruction has made impossible. So they take the remaining vials without asking, from a woman who would have given them freely, and feel clever.",
    steps: [
      {
        id: "check_corettas_ledger",
        title: "Check the Dates",
        objective:
          "Compare Coretta's ledger against your own first recovered fragment.",
        trigger: "interact",
        targetLabel: "Coretta's ledger",
      },
      {
        id: "ask_auggie",
        title: "Ask AUGUR-9",
        objective: "Get the chronology from something that records everything.",
        trigger: "interact",
        targetLabel: "AUGUR-9",
      },
      {
        id: "resume_dosing",
        title: "Take the Rest",
        objective: "Take the remaining vials.",
        trigger: "collect",
        targetLabel: "Dented Tea Tin",
        inventoryRequirements: [
          {
            itemId: "item_ch1_compound_b",
            count: 1,
            label: "the remaining tea compound",
          },
        ],
      },
      {
        id: "unlock_linking",
        title: "Start Linking",
        objective: "Put two fragments next to each other and see what happens.",
        trigger: "interact",
        targetLabel: "Journal",
        note: "Confidence values become visible for the first time. The Act 3 corridor shows 91%. A scatter of low-confidence echoes turn out to be the true ones, and some players will notice the inverse correlation. Those players deserve it.",
      },
    ],
  },
  {
    id: "ch1_a5_q02_the_letter",
    act: 5,
    title: "The Letter",
    giver: "Kit the Courier",
    district: "The Grove",
    summary:
      "Kit nearly died on the Bluewater route to bring you a packet addressed to no one.",
    note: "Four months old by the sender's reckoning and eleven years old by ours. Signed 'N. Sorrel, Custodian 3'. AUGUR-9 knows the name. The player does not.",
    steps: [
      {
        id: "read_the_letter",
        title: "Read It",
        objective: "Read the letter Jackie left behind.",
        trigger: "interact",
        targetLabel: "A letter addressed to no one",
        fragmentId: "frag_a5_play_decimal_place",
        setsFlags: [CH1_FLAGS.sorrelLetterRead],
      },
    ],
  },
  {
    id: "ch1_a5_q03_pack_for_the_cold",
    act: 5,
    title: "Pack For the Cold",
    giver: "Ranger Jane",
    district: "The Grove",
    summary:
      "Harsher than last time: fuel, rope, iron, cold gear, and about double the food.",
    note: "Jane runs this check instead of Jackie, and the absence is louder than a scene. Rook shows up at the gate uninvited with a coil of Harthmere rope and no explanation. He will not go in. He will hold the near side.",
    steps: [
      {
        id: "provision_winter",
        title: "Provision",
        objective:
          "You're going into a frozen fjord this time. Pack fuel, food, cooked rations, cold-weather gear, rope, iron, repair kits, and field medicine. Double everything from last time. Open Quests to find and gather what you need.",
        trigger: "collect",
        targetLabel: "Provisioning checklist",
      },
      {
        id: "rooks_rope",
        title: "Rook's Rope",
        objective: "Take the rope and do not ask why he came.",
        trigger: "talk_npc",
        targetLabel: "Halden Rook",
      },
    ],
  },
  {
    id: "ch1_a5_d2_the_long_winter_mouth",
    act: 5,
    title: "The Long Winter Mouth",
    giver: "—",
    district: "Fracture Gate: the Long Winter Mouth",
    summary:
      "A fjord that has had the same winter nine times. Bring her back, and bring back what she is carrying.",
    note: "Dungeon 2. Seven zones, no merchants, no rest, no resupply. See ch1_dungeons.ts.",
    steps: [
      {
        id: "d2_ice_shelf",
        title: "The Ice Shelf",
        objective: "Get off the landing before the cold takes you.",
        // Environmental transitions are explicit interactions so their fuel,
        // cold, and stamina costs commit with the native quest leaf.
        trigger: "minigame",
        targetLabel: "The Drowned Longhouse",
      },
      {
        id: "d2_longhouse",
        title: "The Drowned Longhouse",
        objective: "Cross the hall from underneath.",
        // This also prevents the native proximity trigger from bypassing the
        // under-ice survival interval and its breath/stamina consequences.
        trigger: "minigame",
        targetLabel: "The Hanged Wood",
        grants: ["item_hnefatafl_piece"],
      },
      {
        id: "d2_hanged_wood",
        title: "The Hanged Wood",
        objective: "Get through the pines without being heard.",
        // The player must commit to stealth or an expensive fight; proximity
        // alone is not evidence that the sound-discipline mechanic happened.
        trigger: "minigame",
        targetLabel: "The Whale Road",
      },
      {
        id: "d2_whale_road",
        title: "The Whale Road",
        objective: "Cross the ice. Decide what you are willing to leave.",
        // Carry weight is a hard mechanic gate here. Completing merely by
        // entering the radius made the authored leave-something-behind choice
        // impossible to enforce.
        trigger: "minigame",
        targetLabel: "Sorrel's Camp",
      },
      {
        id: "d2_sorrels_camp",
        title: "Sorrel's Camp",
        objective: "Get her to open the door.",
        trigger: "talk_npc",
        targetLabel: "Dr. Nadia Sorrel",
        grants: ["item_custodian_key_3"],
        fragmentId: "frag_a5_overlay_ashfall",
        cutsceneId: "ch1-sorrel-door",
      },
      {
        id: "d2_the_oath",
        title: "The Condition",
        objective: "Agree to her condition, out loud, in your own words.",
        trigger: "dialogue_choice",
        targetLabel: "Dr. Nadia Sorrel",
        grants: ["item_sorrel_field_ledger"],
        setsFlags: [CH1_FLAGS.sorrelOathGiven, CH1_FLAGS.hasLedger],
        note: "MAKE THEM PICK THE LINE. Make them commit. It does not go to the Collective. Ever. Under any circumstance. Say it.",
      },
      {
        id: "d2_ash_hall",
        title: "The Ash Hall",
        objective: "End the ninth winter, or don't.",
        trigger: "defeat",
        targetLabel: "The Ninth Winter",
      },
      {
        id: "d2_hallrs_choice",
        title: "Hallr's Choice",
        objective: "Tell Hallr what you think he should do.",
        trigger: "dialogue_choice",
        targetLabel: "Jarl Hallr Ironmouth",
        note: "Neither option is scored. Both are logged for Chapter 2.",
      },
      {
        id: "d2_the_breaking_year",
        title: "The Breaking Year",
        objective: "Get Sorrel across the ice while the fjord runs nine years.",
        trigger: "escort",
        targetLabel: "Return aperture",
        fragmentId: "frag_a5_echo_the_name",
        setsFlags: [CH1_FLAGS.knowsDesignation],
        note: "MIX NOTE: the surname is shouted over wind and deliberately buried. Audible on headphones at volume; target ~10-15% catch rate. Never subtitle it in full.",
      },
    ],
  },
  {
    id: "ch1_a5_q04_two_days",
    act: 5,
    title: "Two Days",
    giver: "Halden Rook",
    district: "The Grove",
    summary:
      "He held the near side for two days with a rope, because a Mouth with nobody watching it is how towns end.",
    actClose: true,
    setsFlags: [CH1_FLAGS.act5Complete],
    note: "Rook, looking at Sorrel: 'One of yours, from before. I can tell by the coat.' Beat. 'It is a strange feeling, being proved right. I had expected to enjoy it more.' And in the Grove, waiting, patient, unhurried, warm — with a Collective medical transport that has been parked at the Returnstone Pad since the day after Ashline — is Lou.",
    steps: [
      {
        id: "come_out",
        title: "Come Out",
        // THIS IS AN ARRIVAL BEAT, NOT AN ESCORT LEG, AND IT USED TO CLAIM
        // OTHERWISE. The objective read "Get Sorrel across the fjord" under an
        // `escort` trigger, but `ch1RequiredEscortNpcsForObjective("come_out")`
        // returns nothing, so no Sorrel check ever ran.
        //
        // Adding her to that list would have been an unrecoverable soft-lock:
        // the escort scheduler cancels her follow the moment
        // `d2_the_breaking_year` is applied, and clears escort state entirely
        // when the dungeon slot claim is released. By the time the player is
        // standing in the Grove she is back at her seeded winter position and
        // cannot be brought any closer. The crossing is already gated one step
        // earlier, where she is genuinely following.
        //
        // So this matches Act 3's identical beat (`come_back_out`): arrive in
        // the Grove. Same 18 m radius either way — `radiusFor` treats escort
        // and near_location the same — but the action label now reads "Arrive"
        // instead of "Finish escort", and it auto-completes on arrival.
        objective:
          "Step back into the Grove through the return aperture. Rook has held the near side for two days and the whole town is waiting on the ice.",
        trigger: "near_location",
        targetLabel: "The Grove",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Act 6 — "Seven"  (Memory consolidation)
// ---------------------------------------------------------------------------

const ACT_6: readonly Ch1QuestDef[] = [
  {
    id: "ch1_a6_q01_the_case",
    act: 6,
    title: "The Case",
    giver: "Dr. Lucien Ardan",
    district: "The Grove",
    summary:
      "He has been building something for two acts, and now he presents it, and it is good.",
    requiresFlags: [CH1_FLAGS.act5Complete],
    note: "NO TIME LIMIT. Lou lays out the sealed file, the Ashline report, the fact that the Collective knows, and the fact that HE TOLD THEM NOTHING — which is true and provable; Vane worked it out from Calla's report. His argument is the strongest anyone makes in Chapter 1 and nobody gets to answer it well.",
    steps: [
      {
        id: "hear_him_out",
        title: "Hear Him Out",
        objective: "Listen to the whole thing.",
        trigger: "talk_npc",
        targetLabel: "Dr. Lucien Ardan",
        cutsceneId: "ch1-the-case",
      },
      {
        id: "hear_vane",
        title: "Hear Vane",
        objective: "Listen to the arithmetic.",
        trigger: "talk_npc",
        targetLabel: "Arbiter Cressa Vane",
      },
    ],
  },
  {
    id: "ch1_a6_q02_the_handover",
    act: 6,
    title: "The Handover",
    giver: "Dr. Lucien Ardan",
    district: "The Grove",
    summary: "Give him the ledger.",
    setsFlags: [CH1_FLAGS.ledgerSurrendered],
    note: "MUST BE A PLAYER ACTION. Not a cutscene. Not a betrayal that happens to them. Inventory -> select the ledger -> confirmation prompt that names the oath. 'Not yet' is allowed as many times as the player likes; there is no timer and the game will wait. PLAYTEST TARGET: complicit, not cheated. If we get cheated, the fix is to strengthen Lou's argument, not to weaken the prompt.",
    steps: [
      {
        id: "give_the_ledger",
        title: "Give the Ledger",
        objective: "Hand the field ledger to Dr. Ardan.",
        trigger: "give_item",
        targetLabel: "Dr. Lucien Ardan",
        inventoryRequirements: [
          {
            itemId: "item_sorrel_field_ledger",
            count: 1,
            label: "Sorrel's field ledger",
          },
        ],
      },
      {
        id: "give_her_location",
        title: "Tell Him Where She Is",
        objective:
          "Tell Dr. Ardan where Sorrel is and that she needs medical help.",
        trigger: "dialogue_choice",
        targetLabel: "Dr. Lucien Ardan",
      },
    ],
  },
  {
    id: "ch1_a6_q03_consolidation",
    act: 6,
    title: "Seven",
    giver: "—",
    district: "The Grove",
    summary:
      "He puts a hand on your shoulder and thanks you, warmly, the way he has since the day you met him.",
    setsFlags: [CH1_FLAGS.act6TruthKnown, CH1_FLAGS.jackieTrueIdentityKnown],
    note: "It starts about ninety seconds too late. The player has heard the designation exactly once before, shouted over wind, two days ago. LOU HAS NEVER BEEN TOLD IT. Not by the player, not by Vane (who does not use designations), not by anyone in the Grove. There is exactly one category of person who calls the player that without being told.",
    steps: [
      {
        id: "the_word",
        title: "The Word",
        objective:
          "Dr. Ardan thanks you warmly, the way he has since the beginning. Listen carefully to what he says — to what he calls you. You've never told him that word.",
        trigger: "interact",
        targetLabel: "Dr. Lucien Ardan",
        cutsceneId: "ch1-consolidation-revision",
        fragmentId: "frag_a6_the_intake_window",
      },
    ],
  },
  {
    id: "ch1_a6_q04_too_late",
    act: 6,
    title: "Too Late",
    giver: "Dr. Lucien Ardan",
    district: "The Grove",
    summary: "Nobody runs. There is no fight. There is no chase.",
    note: "Lou stops at the door and gives the only answer he has ever had. The player cannot reply, because the wheel offers four options and all four are variations on 'I don't know' — the same shape as the Ashline scene, deliberately. The callback should land like a slap.",
    steps: [
      {
        id: "watch_him_go",
        title: "Watch Him Go",
        objective:
          "Lou stops at the Returnstone exit. You have one moment to respond before he leaves forever. Choose your words carefully — all four answers mean the same thing.",
        trigger: "dialogue_choice",
        targetLabel: "Dr. Lucien Ardan",
        cutsceneId: "ch1-too-late",
      },
    ],
  },
  {
    id: "ch1_a6_q05_the_watch_house",
    act: 6,
    title: "The Watch House",
    giver: "Jackie",
    district: "The Grove",
    summary:
      "She has been in there for nine days and has not said one word in her own defence.",
    actClose: true,
    setsFlags: [CH1_FLAGS.complete],
    note: "Small, quiet, mostly the player listening. She asks one question first — 'Did he take it?' — and when the answer is yes she closes her eyes for a second and then gets practical, because that's who she is. She does not do a speech and she does not ask for an apology.",
    steps: [
      {
        id: "did_he_take_it",
        title: '"Did He Take It?"',
        objective:
          "Tell Jackie the truth: did Dr. Ardan take Sorrel's field ledger? She needs to know what he knows.",
        trigger: "dialogue_choice",
        targetLabel: "Jackie",
      },
      {
        id: "the_whole_plan",
        title: "The Whole Plan",
        objective:
          "Stay with Jackie in the watch house and listen to her explain what she's been planning. How to contain what you are. How to keep you safe.",
        trigger: "talk_npc",
        targetLabel: "Jackie",
        cutsceneId: "ch1-the-watch-house",
      },
      {
        id: "the_final_choice",
        title: "Decide",
        objective:
          "Three paths remain: confess everything to the authorities, contain the truth and disappear, or try to bargain for your freedom. Choose.",
        trigger: "dialogue_choice",
        targetLabel: "Jackie",
        note: "None of these is the good ending. Do not mark one as canon.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const CH1_QUESTS: readonly Ch1QuestDef[] = Object.freeze([
  ...ACT_1,
  ...ACT_2,
  ...ACT_3,
  ...ACT_4,
  ...ACT_5,
  ...ACT_6,
]);

const QUESTS_BY_ID = new Map(CH1_QUESTS.map((q) => [q.id, q]));

export function ch1Quest(id: string): Ch1QuestDef | undefined {
  return QUESTS_BY_ID.get(id);
}

export function ch1QuestsForAct(act: number): readonly Ch1QuestDef[] {
  return CH1_QUESTS.filter((q) => q.act === act);
}

export function ch1ActCloseQuest(act: number): Ch1QuestDef | undefined {
  return CH1_QUESTS.find((q) => q.act === act && q.actClose);
}

/**
 * The quest that IS the run inside a given dungeon.
 *
 * Used by the gate to refuse entry before the expedition has begun. Gate
 * visibility is derived from the highest act reached, which opens the Mouth
 * several objectives before the dungeon quest starts; entering in that window
 * used to be an unrecoverable soft-lock.
 */
export const CH1_DUNGEON_QUEST_IDS: Readonly<Record<string, string>> =
  Object.freeze({
    ch1_dungeon_desert: "ch1_a3_d1_the_sand_that_remembers",
    ch1_dungeon_winter: "ch1_a5_d2_the_long_winter_mouth",
  });

export function ch1DungeonQuestForDungeonId(
  dungeonId: string
): Ch1QuestDef | undefined {
  const questId = CH1_DUNGEON_QUEST_IDS[dungeonId];
  return questId ? ch1Quest(questId) : undefined;
}

/**
 * The authored step whose completion means the run inside this dungeon is done.
 *
 * The winter dungeon's three REQUIRED retrievals — Sorrel, the field ledger and
 * Custodian Key 3 — are all obtained at `d2_the_oath`, step six of nine. So the
 * retrieval check alone let a player legally walk out before the Ash Hall boss,
 * Hallr's choice and the escort out, leaving three objectives that can only be
 * completed inside a band they now had to re-provision to re-enter. The desert
 * does not have this problem because its exit needs `ch1_iris_rescued`, which
 * only its final step sets.
 */
export function ch1DungeonFinalStepId(dungeonId: string): string | undefined {
  const quest = ch1DungeonQuestForDungeonId(dungeonId);
  return quest?.steps[quest.steps.length - 1]?.id;
}

export const CH1_ACT_TITLES: Readonly<Record<number, string>> = Object.freeze({
  1: "What the Card Opens",
  2: "Names Worth Keeping",
  3: "The Sand That Remembers",
  4: "Hands That Know",
  5: "The Long Winter Mouth",
  6: "Seven",
});

export const CH1_ACT_MEMORY_STAGES: Readonly<Record<number, string>> =
  Object.freeze({
    1: "Confusion and disorientation",
    2: "Formation of new memories",
    3: "Fragmented recall",
    4: "Recognition before recall",
    5: "Gradual reconstruction",
    6: "Memory consolidation",
  });

/** Every fragment referenced by a quest step, in authored order. */
export function ch1QuestFragmentIds(): readonly string[] {
  const ids: string[] = [];
  for (const quest of CH1_QUESTS) {
    for (const step of quest.steps) {
      if (step.fragmentId) {
        ids.push(step.fragmentId);
      }
    }
  }
  return ids;
}

/** Every latent skill referenced by a quest step. */
export function ch1QuestLatentSkillIds(): readonly string[] {
  const ids: string[] = [];
  for (const quest of CH1_QUESTS) {
    for (const step of quest.steps) {
      if (step.latentSkillId) {
        ids.push(step.latentSkillId);
      }
    }
  }
  return ids;
}

/** Every cutscene referenced by a quest step. */
export function ch1QuestCutsceneIds(): readonly string[] {
  const ids = new Set<string>([CH1_IGNITION.cutsceneId]);
  for (const quest of CH1_QUESTS) {
    for (const step of quest.steps) {
      if (step.cutsceneId) {
        ids.add(step.cutsceneId);
      }
    }
  }
  return [...ids];
}
