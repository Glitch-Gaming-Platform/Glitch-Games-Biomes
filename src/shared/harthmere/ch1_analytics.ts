// CHAPTER_1_GLITCH_BEHAVIORAL_EVENTS
//
// Glitch analytics coverage for everything Chapter 1 adds. The HAR from the
// 2026-07-25 session shows only platform-level events reaching Glitch
// (game_iframe_loaded, load_success, game_first_interaction) — no in-game
// behavioral events for story, dungeons, or gates. This catalog closes that.
//
// GLITCH CONTRACT (Reports > Behavioral Events doc — followed exactly):
//   * step_key  = stage/screen/location, string <= 100, stable machine key
//   * action_key = what happened inside the step, string <= 100, required
//   * step_label/event_label = optional display text, NEVER used as keys
//   * funnels are ordered step_key sequences, min 2 steps, never action_keys
//   * no player PII in metadata or previous_step_key
//   * events POST to /titles/{title}/events with game_install_id — the client
//     bridge (harthmere_glitch_bridge.ts requestGlitch) already owns auth,
//     install identity, batching, and retries; this module is pure data the
//     bridge consumes.
//
// Send-site rule: emit on the SERVER-CONFIRMED transition (flag set, run
// exit accepted), not on the optimistic client action — the deploy-loss bug
// taught us what client-only state is worth.

export const CH1_ANALYTICS_VERSION = "ch1-analytics-v1" as const;

export interface Ch1AnalyticsEventDef {
  step_key: string;
  action_key: string;
  step_label: string;
  event_label: string;
  step_description?: string;
  event_description?: string;
  /** Designer note: what in the game emits this. Not sent to Glitch. */
  emittedOn: string;
  /** Metadata keys expected alongside (documentation; all optional). */
  metadataKeys?: readonly string[];
}

// ---------------------------------------------------------------------------
// Step keys
//
// One step per act, per dungeon zone-group, and per gate. Zone-level granular
// events carry the zone in metadata rather than minting 23 step_keys — funnel
// steps should be places a meaningful fraction of players stop, not rooms.
// ---------------------------------------------------------------------------

export const CH1_STEP_KEYS = {
  ignition: "ch1_ignition",
  act1: "ch1_act1_card",
  act2: "ch1_act2_names",
  act3: "ch1_act3_desert",
  act4: "ch1_act4_hands",
  act5: "ch1_act5_winter",
  act6: "ch1_act6_seven",
  gateDesert: "ch1_gate_desert",
  dungeonDesert: "ch1_dungeon_desert",
  gateWinter: "ch1_gate_winter",
  dungeonWinter: "ch1_dungeon_winter",
  ending: "ch1_ending",
} as const;

export const CH1_ANALYTICS_EVENTS: readonly Ch1AnalyticsEventDef[] =
  Object.freeze([
    // --- Chapter spine -----------------------------------------------------
    {
      step_key: CH1_STEP_KEYS.ignition,
      action_key: "start",
      step_label: "Ch1: Ignition",
      step_description:
        "The AUGUR-9 log beat at the end of Muck vs. Machine that starts Chapter 1.",
      event_label: "Chapter 1 Started",
      emittedOn: "server sets ch1_started",
    },
    ...([1, 2, 3, 4, 5, 6] as const).flatMap((act) => {
      const step = [
        CH1_STEP_KEYS.act1,
        CH1_STEP_KEYS.act2,
        CH1_STEP_KEYS.act3,
        CH1_STEP_KEYS.act4,
        CH1_STEP_KEYS.act5,
        CH1_STEP_KEYS.act6,
      ][act - 1];
      const names = [
        "What the Card Opens",
        "Names Worth Keeping",
        "The Sand That Remembers",
        "Hands That Know",
        "The Long Winter Mouth",
        "Seven",
      ][act - 1];
      return [
        {
          step_key: step,
          action_key: "start",
          step_label: `Ch1 Act ${act}: ${names}`,
          event_label: `Act ${act} Started`,
          emittedOn: `first quest of act ${act} accepted`,
        },
        {
          step_key: step,
          action_key: "complete",
          step_label: `Ch1 Act ${act}: ${names}`,
          event_label: `Act ${act} Completed`,
          emittedOn: `server sets ch1_act${act}_complete (act 6: ch1_complete)`,
          metadataKeys: ["duration_seconds", "quests_completed"],
        },
        {
          step_key: step,
          action_key: "quest_complete",
          step_label: `Ch1 Act ${act}: ${names}`,
          event_label: "Quest Completed",
          emittedOn: "each ch1 quest completion inside the act",
          metadataKeys: ["quest_id"],
        },
      ];
    }),

    // --- Memory system (drop-off telemetry for the chapter's core loop) ----
    {
      step_key: CH1_STEP_KEYS.act2,
      action_key: "fragment_recovered",
      step_label: "Ch1 Act 2: Names Worth Keeping",
      event_label: "Memory Fragment Recovered",
      event_description:
        "A ledger fragment was recovered. fragment_id and type in metadata.",
      emittedOn: "ch1.recoverFragment commit hook (any act; step_key = current act)",
      metadataKeys: ["fragment_id", "fragment_type", "act"],
    },
    {
      step_key: CH1_STEP_KEYS.act4,
      action_key: "latent_skill_unlocked",
      step_label: "Ch1 Act 4: Hands That Know",
      event_label: "Latent Skill Unlocked",
      emittedOn: "ch1UnlockLatentSkill on the server",
      metadataKeys: ["skill_id"],
    },
    {
      step_key: CH1_STEP_KEYS.act4,
      action_key: "dosing_stopped",
      step_label: "Ch1 Act 4: Hands That Know",
      event_label: "Stopped Taking the Tea",
      event_description:
        "The confrontation. The fragment ledger goes silent from here.",
      emittedOn: "server sets ch1_dosing_stopped",
    },
    {
      step_key: CH1_STEP_KEYS.act5,
      action_key: "dosing_resumed",
      step_label: "Ch1 Act 5: The Long Winter Mouth",
      event_label: "Resumed the Vials",
      emittedOn: "server sets ch1_dosing_resumed",
    },
    {
      step_key: CH1_STEP_KEYS.act6,
      action_key: "ledger_surrendered",
      step_label: "Ch1 Act 6: Seven",
      event_label: "Field Ledger Handed Over",
      event_description:
        "The player-action handover, including how many times they said Not Yet.",
      emittedOn: "server sets ch1_ledger_surrendered",
      metadataKeys: ["not_yet_count", "seconds_on_prompt"],
    },

    // --- Gates and dungeons ------------------------------------------------
    ...(
      [
        [CH1_STEP_KEYS.gateDesert, CH1_STEP_KEYS.dungeonDesert, "Desert"],
        [CH1_STEP_KEYS.gateWinter, CH1_STEP_KEYS.dungeonWinter, "Winter"],
      ] as const
    ).flatMap(([gateStep, dungeonStep, label]) => [
      {
        step_key: gateStep,
        action_key: "provision_blocked",
        step_label: `Ch1 Gate: ${label}`,
        event_label: "Blocked at Provisioning",
        event_description:
          "Entry refused for missing supplies. missing list in metadata — this is the economy-loop friction signal.",
        emittedOn: "ch1EnterGate/ch1PartyEnterGate returns under-provisioned",
        metadataKeys: ["missing", "party_size"],
      },
      {
        step_key: gateStep,
        action_key: "enter",
        step_label: `Ch1 Gate: ${label}`,
        event_label: "Entered the Gate",
        emittedOn: "server-validated warp into the Elsewhen slot",
        metadataKeys: ["party_size"],
      },
      {
        step_key: dungeonStep,
        action_key: "zone_reached",
        step_label: `Ch1 Dungeon: ${label}`,
        event_label: "Zone Reached",
        emittedOn: "first entry to each zone volume",
        metadataKeys: ["zone_id", "minutes_inside"],
      },
      {
        step_key: dungeonStep,
        action_key: "boss_defeated",
        step_label: `Ch1 Dungeon: ${label}`,
        event_label: "Boss Defeated",
        emittedOn: "boss encounter resolves",
        metadataKeys: ["boss_id", "party_size", "stealth_bypassed"],
      },
      {
        step_key: dungeonStep,
        action_key: "member_downed",
        step_label: `Ch1 Dungeon: ${label}`,
        event_label: "Party Member Downed",
        emittedOn: "ch1PartyMemberDowned",
        metadataKeys: ["zone_id", "party_size"],
      },
      {
        step_key: dungeonStep,
        action_key: "exit_complete",
        step_label: `Ch1 Dungeon: ${label}`,
        event_label: "Dungeon Completed",
        emittedOn: "ch1ExitGate/ch1PartyExitGate accepts the retrievals",
        metadataKeys: ["minutes_inside", "grove_hours_elapsed", "party_size"],
      },
      {
        step_key: dungeonStep,
        action_key: "exit_blocked",
        step_label: `Ch1 Dungeon: ${label}`,
        event_label: "Exit Refused (retrieval missing)",
        emittedOn: "ch1ExitGate refuses because a required retrieval is inside",
        metadataKeys: ["missing"],
      },
    ]),

    // --- Puzzles -----------------------------------------------------------
    {
      step_key: CH1_STEP_KEYS.dungeonDesert,
      action_key: "weights_solved",
      step_label: "Ch1 Dungeon: Desert",
      event_label: "Hall of Weights Solved",
      emittedOn: "balance-beam minigame completes",
      metadataKeys: ["seconds_taken", "wrong_attempts"],
    },
    {
      step_key: CH1_STEP_KEYS.act4,
      action_key: "containment_complete",
      step_label: "Ch1 Act 4: Hands That Know",
      event_label: "Containment Stabilised",
      event_description:
        "auto_completed=true means the timer finished it for the player.",
      emittedOn: "Ashline sequence resolves (it cannot fail)",
      metadataKeys: ["seconds_taken", "auto_completed"],
    },

    // --- Ending ------------------------------------------------------------
    {
      step_key: CH1_STEP_KEYS.ending,
      action_key: "chosen",
      step_label: "Ch1: Ending",
      event_label: "Ending Chosen",
      emittedOn: "ch1ChooseEnding on the server",
      metadataKeys: ["ending", "hallr_choice", "augur9_alive", "testimonies"],
    },
  ]);

// ---------------------------------------------------------------------------
// Dashboard funnels (ordered step_key sequences — never action_keys)
// ---------------------------------------------------------------------------

export interface Ch1FunnelDef {
  name: string;
  description: string;
  steps: ReadonlyArray<{ step_key: string; label: string }>;
}

export const CH1_FUNNELS: readonly Ch1FunnelDef[] = Object.freeze([
  {
    name: "Chapter 1 Story Progression",
    description:
      "Ignition through the ending. The chapter-scale drop-off curve.",
    steps: [
      { step_key: CH1_STEP_KEYS.ignition, label: "Ignition" },
      { step_key: CH1_STEP_KEYS.act1, label: "Act 1: The Card" },
      { step_key: CH1_STEP_KEYS.act2, label: "Act 2: Names" },
      { step_key: CH1_STEP_KEYS.act3, label: "Act 3: Desert" },
      { step_key: CH1_STEP_KEYS.act4, label: "Act 4: Hands" },
      { step_key: CH1_STEP_KEYS.act5, label: "Act 5: Winter" },
      { step_key: CH1_STEP_KEYS.act6, label: "Act 6: Seven" },
      { step_key: CH1_STEP_KEYS.ending, label: "Ending Chosen" },
    ],
  },
  {
    name: "Desert Dungeon Flow",
    description:
      "Gate approach -> inside -> out. provision_blocked on the gate step is the economy friction; exit_blocked is the retrieval friction.",
    steps: [
      { step_key: CH1_STEP_KEYS.act3, label: "Act 3 Reached" },
      { step_key: CH1_STEP_KEYS.gateDesert, label: "At the Gate" },
      { step_key: CH1_STEP_KEYS.dungeonDesert, label: "Inside" },
      { step_key: CH1_STEP_KEYS.act4, label: "Act 4 (came back)" },
    ],
  },
  {
    name: "Winter Dungeon Flow",
    description: "Same shape as the desert funnel, one act later.",
    steps: [
      { step_key: CH1_STEP_KEYS.act5, label: "Act 5 Reached" },
      { step_key: CH1_STEP_KEYS.gateWinter, label: "At the Gate" },
      { step_key: CH1_STEP_KEYS.dungeonWinter, label: "Inside" },
      { step_key: CH1_STEP_KEYS.act6, label: "Act 6 (came back)" },
    ],
  },
]);

// ---------------------------------------------------------------------------
// Contract validation (tested)
// ---------------------------------------------------------------------------

const KEY_PATTERN = /^[a-z0-9_]{1,100}$/;
const PII_METADATA_KEYS = new Set([
  "email",
  "name",
  "username",
  "user_id",
  "ip",
  "address",
  "phone",
]);

export function ch1ValidateAnalyticsCatalog(): string[] {
  const errors: string[] = [];
  const pairs = new Set<string>();
  for (const event of CH1_ANALYTICS_EVENTS) {
    if (!KEY_PATTERN.test(event.step_key)) {
      errors.push(`step_key "${event.step_key}" is not a stable machine key`);
    }
    if (!KEY_PATTERN.test(event.action_key)) {
      errors.push(`action_key "${event.action_key}" is not a stable machine key`);
    }
    if (event.step_label.length > 255 || event.event_label.length > 255) {
      errors.push(`${event.step_key}/${event.action_key}: label exceeds 255`);
    }
    if ((event.step_description?.length ?? 0) > 2000) {
      errors.push(`${event.step_key}: step_description exceeds 2000`);
    }
    const pair = `${event.step_key}|${event.action_key}`;
    if (pairs.has(pair)) {
      errors.push(`duplicate event definition ${pair}`);
    }
    pairs.add(pair);
    for (const key of event.metadataKeys ?? []) {
      if (PII_METADATA_KEYS.has(key)) {
        errors.push(`${pair}: metadata key "${key}" risks player PII`);
      }
    }
  }
  const knownSteps = new Set<string>(Object.values(CH1_STEP_KEYS));
  for (const funnel of CH1_FUNNELS) {
    if (funnel.steps.length < 2) {
      errors.push(`funnel "${funnel.name}" needs at least 2 steps`);
    }
    for (const step of funnel.steps) {
      if (!knownSteps.has(step.step_key)) {
        errors.push(
          `funnel "${funnel.name}" references unknown step_key "${step.step_key}"`
        );
      }
    }
    const seen = new Set(funnel.steps.map((s) => s.step_key));
    if (seen.size !== funnel.steps.length) {
      errors.push(`funnel "${funnel.name}" repeats a step_key`);
    }
  }
  return errors;
}
