import React from "react";

export const HARTHMERE_DIALOGUE_RULE_SYSTEM_VERSION = "harthmere-dialogue-rule-system-v1";

export const HARTHMERE_DIALOGUE_LOCAL_STORAGE_KEYS = {
  sessions: "harthmere.dialogue.sessions.v1",
  transcripts: "harthmere.dialogue.transcripts.v1",
  memory: "harthmere.dialogue.memory.v1",
  cooldowns: "harthmere.dialogue.cooldowns.v1",
  idempotency: "harthmere.dialogue.idempotency.v1",
  journalSummaries: "harthmere.dialogue.journalSummaries.v1",
} as const;

export type HarthmereDialogueChoiceType =
  | "flavor"
  | "information"
  | "quest"
  | "moral"
  | "faction"
  | "combat"
  | "trade"
  | "merchant"
  | "guard_legal"
  | "persuasion"
  | "intimidation"
  | "bribe"
  | "lie"
  | "truth"
  | "class_specific"
  | "attribute_based"
  | "reputation_based"
  | "secret_unlocked"
  | "leave";

export type HarthmereDialogueTag =
  | "Friendly"
  | "Rude"
  | "Lie"
  | "Truth"
  | "Threaten"
  | "Persuade"
  | "Bribe"
  | "Intimidate"
  | "Flirt"
  | "Joke"
  | "Ask"
  | "Accept"
  | "Refuse"
  | "Attack"
  | "Leave"
  | "Trade"
  | "Quest"
  | "Class"
  | "Attribute"
  | "Reputation"
  | "Illegal"
  | "Permanent";

export type HarthmereConsequenceLabel =
  | "minor_consequence"
  | "major_consequence"
  | "faction_consequence"
  | "legal_consequence"
  | "relationship_consequence"
  | "permanent_consequence"
  | "combat_consequence";

export type HarthmereDialogueMemoryType =
  | "short_term_memory"
  | "personal_memory"
  | "family_memory"
  | "faction_memory"
  | "town_memory"
  | "regional_rumor"
  | "world_news";

export interface HarthmereDialogueChoice {
  choiceId: string;
  text: string;
  type: HarthmereDialogueChoiceType;
  tag?: HarthmereDialogueTag;
  requirements?: Record<string, unknown>;
  warnings?: HarthmereConsequenceLabel[];
  warningText?: string;
  successEffects?: Record<string, unknown>;
  failureEffects?: Record<string, unknown>;
  nextNodeSuccess?: string | null;
  nextNodeFailure?: string | null;
  failForwardOptions?: string[];
  partyConsentRequired?: boolean;
  hiddenUntilUnlocked?: boolean;
  availableWhen?: Record<string, unknown>;
}

export interface HarthmereDialogueNode {
  nodeId: string;
  npcId: string;
  npcName: string;
  npcRole: string;
  text: string;
  purpose: "quest" | "service" | "small_talk" | "guard" | "merchant" | "story" | "combat" | "relationship";
  importantFirst: boolean;
  requiredInfo?: string[];
  optionalLore?: string[];
  choices: HarthmereDialogueChoice[];
  conditions?: Record<string, unknown>;
  journalSummary?: string;
  mapMarkerUpdates?: string[];
  compassMarkerUpdates?: string[];
  allowSkip?: boolean;
  allowFastForward?: boolean;
  allowHistoryReview?: boolean;
  greetingCooldownMs?: number;
  ambientCooldownMs?: number;
}

export interface HarthmereDialogueContext {
  playerId: string;
  accountId?: string;
  npcId: string;
  npcRole: string;
  npcAlive: boolean;
  distanceMeters: number;
  inCombat: boolean;
  playerAttacked: boolean;
  legalStanding: number;
  likeability: number;
  notoriety: number;
  factionReputation?: Record<string, number>;
  playerClass?: string;
  playerLevel?: number;
  attributes?: Record<string, number>;
  inventoryItems?: string[];
  hostileNpc?: boolean;
  supportsNegotiation?: boolean;
  partyAffectedPlayerIds?: string[];
  partyConsentByPlayerId?: Record<string, boolean>;
  nowMs: number;
}

export const HARTHMERE_NON_ANNOYING_DIALOGUE_RULES = {
  mostDialogueParagraphLimit: 3,
  choiceCountRecommendedMin: 2,
  choiceCountRecommendedMax: 5,
  importantInformationFirst: true,
  requiredInformationSeparateFromOptionalLore: true,
  cleanExitRequired: true,
  repeatedGreetingCooldownMs: 10 * 60 * 1000,
  ambientBarkCooldownMs: 10 * 60 * 1000,
  companionObservationCooldownMs: 30 * 60 * 1000,
  serviceButtonsAppearImmediately: true,
  consequenceWarningsRequiredForMajorChoices: true,
  noDevelopmentOrGameSystemDialogue: true,
} as const;

export const HARTHMERE_DIALOGUE_UI_CONTRACT = {
  showsNpcName: true,
  showsNpcRoleOrTitle: true,
  showsPortraitOrModel: true,
  showsCurrentLine: true,
  showsPlayerChoices: true,
  showsQuestIcons: true,
  showsTradeServiceButtons: true,
  showsReputationHints: true,
  showsImportantConsequenceWarnings: true,
  showsExitButton: true,
  showsDialogueHistoryButton: true,
  supportsReadableFontSize: true,
  supportsHighContrastText: true,
  supportsScreenReaderLabels: true,
  supportsTextSpeedControl: true,
  supportsKeyboardControllerNavigation: true,
  noColorOnlyChoiceMeaning: true,
} as const;

export const HARTHMERE_DIALOGUE_SERVER_PIPELINE = [
  "server_receives_choice_request",
  "server_verifies_valid_conversation",
  "server_verifies_npc_exists_alive_available",
  "server_verifies_choice_currently_available",
  "server_checks_requirements",
  "server_applies_effects_atomically",
  "server_updates_quest_reputation_faction_inventory_legal_state",
  "server_records_player_choice",
  "server_sends_next_node_to_client",
  "client_updates_ui_journal_map_tracker",
] as const;

export const HARTHMERE_DIALOGUE_INTERRUPTION_RULES = {
  npcDiesDuringConversation: "close_dialogue_process_death_update_quest_alternate_npc_or_failure_state",
  playerAttackedDuringConversation: "close_or_minimize_dialogue_enter_combat_restore_control_immediately",
  playerWalksAway: "end_conversation_if_distance_exceeds_limit_save_only_confirmed_choices",
  playerDisconnectsDuringChoice: "keep_confirmed_server_result_otherwise_apply_nothing",
  playerClicksChoiceTwice: "request_id_idempotency_prevents_duplicate_rewards_accepts_payments",
  playerBecomesCriminalDuringVendor: "close_vendor_merchant_guard_reacts_apply_legal_response",
  hostileNpcConversation: "only_allow_negotiation_surrender_intimidation_or_scripted_dialogue",
  requiredItemMissingAfterOpen: "revalidate_on_choice_selection_fail_gracefully",
  reputationChangesMidDialogue: "revalidate_choices_and_update_npc_tone",
  partyLeaderMajorChoice: "require_affected_player_confirmation_for_personal_quest_faction_reputation",
  skippedDialogueNeedsInfo: "journal_summary_map_compass_transcript_updated",
} as const;

export const HARTHMERE_DIALOGUE_MEMORY_EFFECTS = [
  "player_helped_npc",
  "player_insulted_npc",
  "player_lied_to_npc",
  "player_threatened_npc",
  "player_stole_from_npc",
  "player_saved_family",
  "player_killed_ally",
  "player_failed_quest",
  "player_completed_quest",
  "player_spared_enemy",
  "player_betrayed_faction",
] as const;

export const HARTHMERE_DIALOGUE_ROLE_MENUS = {
  merchant: ["Show me your goods.", "Can you repair my equipment?", "Heard any rumors?", "Ask about local prices.", "Goodbye."],
  fence: ["Do you buy hot goods?", "Can you clean this item?", "Who is watching the alleys?", "Leave."],
  guard: ["Ask for directions.", "Ask about local laws.", "Report a crime.", "Pay fine.", "Submit to arrest.", "Leave."],
  priest: ["Ask for healing.", "Offer a donation.", "Ask about the sick.", "Goodbye."],
  scholar: ["Ask about the old script.", "Share what you discovered.", "Ask for a short version.", "Leave."],
  peasant: ["Ask what is wrong.", "Offer help.", "Ask where to go.", "Goodbye."],
  noble: ["Offer formal respect.", "Ask about court business.", "Request permission.", "Leave."],
} as const;

export const HARTHMERE_DIALOGUE_ROLE_GREETING_POOLS: Record<string, string[]> = {
  merchant: [
    "Need supplies? Roads have been rough this week.",
    "If you are buying, I will show you what is fresh from the road.",
    "Keep your coin close near the stalls. Not everyone shops honest.",
  ],
  guard: [
    "State your business and keep the road clear.",
    "The east road has been noisy. Report anything strange.",
    "Move along unless you have a crime to report.",
  ],
  priest: [
    "The wounded need calm hands and clean cloth. Speak softly here.",
    "If you seek mercy, start with honesty.",
    "The chapel doors stay open for those who come in peace.",
  ],
  thief: [
    "Looking for honest work? Wrong alley.",
    "Careful. Some questions cost more than coin.",
    "If the goods are warm, speak low.",
  ],
  noble: [
    "Mind your tone. Harthmere has little patience for careless guests.",
    "Petitions go through the clerk unless the matter is urgent.",
    "A name carries weight here. Use yours wisely.",
  ],
  peasant: [
    "I do not need speeches. I need help before dark.",
    "Taxes are up, grain is low, and the roads are not safe.",
    "If you can lend a hand, say so plainly.",
  ],
  scholar: [
    "You recognized that mark? Interesting. Very interesting.",
    "Ancient ink lies less often than living mouths.",
    "Ask clearly, and I will answer what the old pages allow.",
  ],
  default: [
    "What brings you through Harthmere today?",
    "Say your piece. The town has had enough surprises.",
    "If you need directions, ask before the weather turns.",
  ],
};

const META_DIALOGUE_PATTERNS = [
  /local[- ]dev/i,
  /debug dialogue/i,
  /test dialogue/i,
  /development dialogue/i,
  /game mechanics/i,
  /game system/i,
  /dialogue choices are labeled/i,
  /how do conversations work here/i,
  /mission journal/i,
  /current lead:/i,
  /they keep the conversation practical/i,
  /leave room for you to ask more/i,
  /overall game/i,
  /implementation/i,
  /tdd/i,
];

export function isHarthmereMetaDialogueText(text: string): boolean {
  return META_DIALOGUE_PATTERNS.some((pattern) => pattern.test(text));
}

export function getHarthmereRoleSpecificFallbackLine(role: string): string {
  const pool = HARTHMERE_DIALOGUE_ROLE_GREETING_POOLS[role] ?? HARTHMERE_DIALOGUE_ROLE_GREETING_POOLS.default;
  return pool[0];
}

export function sanitizeHarthmereDialogueLine(text: string, role: string): string {
  const trimmed = text.trim();
  if (!trimmed || isHarthmereMetaDialogueText(trimmed)) {
    return getHarthmereRoleSpecificFallbackLine(role);
  }
  return trimmed;
}

export function hasCleanDialogueExit(node: HarthmereDialogueNode): boolean {
  return node.choices.some((choice) => choice.type === "leave" || choice.tag === "Leave" || /goodbye|leave|maybe later|end conversation/i.test(choice.text));
}

export function hasSeriousConsequence(choice: HarthmereDialogueChoice): boolean {
  return choice.type === "combat" || choice.tag === "Attack" || choice.tag === "Illegal" || choice.tag === "Permanent" || Boolean(choice.warnings?.length);
}

export function validateHarthmereDialogueNode(node: HarthmereDialogueNode): string[] {
  const problems: string[] = [];
  const paragraphs = node.text.split(/\n\s*\n/).filter(Boolean);
  if (paragraphs.length > HARTHMERE_NON_ANNOYING_DIALOGUE_RULES.mostDialogueParagraphLimit && node.purpose !== "story") {
    problems.push("too_many_paragraphs_for_normal_dialogue");
  }
  if (!node.importantFirst) problems.push("important_information_not_first");
  if (!hasCleanDialogueExit(node)) problems.push("missing_clean_exit_choice");
  if (node.choices.length > HARTHMERE_NON_ANNOYING_DIALOGUE_RULES.choiceCountRecommendedMax) problems.push("too_many_choices_without_categories");
  if (!node.allowHistoryReview) problems.push("dialogue_history_review_missing");
  if (!node.allowSkip) problems.push("skip_support_missing");
  if (!node.allowFastForward) problems.push("fast_forward_support_missing");
  for (const choice of node.choices) {
    if (/^(okay|fine|sure)\.?$/i.test(choice.text.trim()) && choice.type !== "flavor") problems.push(`unclear_choice_tone:${choice.choiceId}`);
    if (hasSeriousConsequence(choice) && !choice.warningText && !choice.warnings?.length) problems.push(`missing_consequence_warning:${choice.choiceId}`);
    if ((choice.type === "persuasion" || choice.type === "bribe" || choice.type === "intimidation") && !choice.failForwardOptions?.length) problems.push(`missing_fail_forward:${choice.choiceId}`);
  }
  if (isHarthmereMetaDialogueText(node.text)) problems.push("meta_development_or_game_system_text_visible");
  return problems;
}

export function chooseHarthmereDialogueGreeting(role: string, previousLineIds: string[] = []): string {
  const pool = HARTHMERE_DIALOGUE_ROLE_GREETING_POOLS[role] ?? HARTHMERE_DIALOGUE_ROLE_GREETING_POOLS.default;
  const unused = pool.find((line) => !previousLineIds.includes(line));
  return unused ?? pool[(previousLineIds.length + 1) % pool.length];
}

export function resolveHarthmereDialogueInterruption(context: HarthmereDialogueContext): "continue" | "npc_dead" | "combat_interrupt" | "distance_timeout" | "hostile_no_negotiation" {
  if (!context.npcAlive) return "npc_dead";
  if (context.inCombat || context.playerAttacked) return "combat_interrupt";
  if (context.distanceMeters > 6) return "distance_timeout";
  if (context.hostileNpc && !context.supportsNegotiation) return "hostile_no_negotiation";
  return "continue";
}

export function requiresPartyConsent(choice: HarthmereDialogueChoice, context: HarthmereDialogueContext): boolean {
  return Boolean(choice.partyConsentRequired && context.partyAffectedPlayerIds?.some((id) => !context.partyConsentByPlayerId?.[id]));
}

export function validateHarthmereDialogueChoiceSelection(choice: HarthmereDialogueChoice, context: HarthmereDialogueContext): { ok: boolean; reason?: string } {
  const interruption = resolveHarthmereDialogueInterruption(context);
  if (interruption !== "continue") return { ok: false, reason: interruption };
  if (requiresPartyConsent(choice, context)) return { ok: false, reason: "missing_party_consent" };
  const req = choice.requirements ?? {};
  if (typeof req.minLevel === "number" && (context.playerLevel ?? 0) < req.minLevel) return { ok: false, reason: "level_requirement_failed" };
  if (typeof req.itemId === "string" && !context.inventoryItems?.includes(req.itemId)) return { ok: false, reason: "required_item_missing" };
  if (typeof req.minLegalStanding === "number" && context.legalStanding < req.minLegalStanding) return { ok: false, reason: "legal_requirement_failed" };
  if (typeof req.minLikeability === "number" && context.likeability < req.minLikeability) return { ok: false, reason: "likeability_requirement_failed" };
  if (typeof req.className === "string" && context.playerClass !== req.className) return { ok: false, reason: "class_requirement_failed" };
  return { ok: true };
}

export function makeHarthmereDialogueRequestId(playerId: string, npcId: string, choiceId: string, counter: number): string {
  return `${playerId}:${npcId}:${choiceId}:${counter}`;
}

export function processHarthmereDialogueChoiceRequest(args: {
  requestId: string;
  processedRequestIds: Set<string>;
  node: HarthmereDialogueNode;
  choiceId: string;
  context: HarthmereDialogueContext;
}): { ok: boolean; duplicate?: boolean; reason?: string; nextNodeId?: string | null; transcriptLine?: string; journalSummary?: string } {
  if (args.processedRequestIds.has(args.requestId)) {
    return { ok: true, duplicate: true, nextNodeId: args.node.nodeId };
  }
  const choice = args.node.choices.find((candidate) => candidate.choiceId === args.choiceId);
  if (!choice) return { ok: false, reason: "choice_not_available" };
  const validation = validateHarthmereDialogueChoiceSelection(choice, args.context);
  if (!validation.ok) return { ok: false, reason: validation.reason };
  args.processedRequestIds.add(args.requestId);
  return {
    ok: true,
    duplicate: false,
    nextNodeId: choice.nextNodeSuccess ?? null,
    transcriptLine: `${args.node.npcName}: ${sanitizeHarthmereDialogueLine(args.node.text, args.node.npcRole)}`,
    journalSummary: args.node.journalSummary ?? summarizeHarthmereDialogueForJournal(args.node, choice),
  };
}

export function summarizeHarthmereDialogueForJournal(node: HarthmereDialogueNode, choice?: HarthmereDialogueChoice): string {
  const required = node.requiredInfo?.join(" ") || sanitizeHarthmereDialogueLine(node.text, node.npcRole);
  const chosen = choice ? ` Choice: ${choice.text}` : "";
  return `${node.npcName} (${node.npcRole}) said: ${required}${chosen}`.trim();
}

export const HARTHMERE_DIALOGUE_SAMPLE_NODE: HarthmereDialogueNode = {
  nodeId: "harthmere_sample_farmer_help",
  npcId: "npc_farmer_kell",
  npcName: "Farmer Kell",
  npcRole: "peasant",
  purpose: "quest",
  importantFirst: true,
  text: "Wolves are getting through the north fence. Kill six before they reach the sheep pens, and I will pay you.",
  requiredInfo: ["Wolves are at the north fence.", "Kill six wolves.", "Return to Farmer Kell for payment."],
  optionalLore: ["The old fence has not held since the storm."],
  journalSummary: "Farmer Kell needs six wolves cleared from the north fence before they reach the sheep pens.",
  allowSkip: true,
  allowFastForward: true,
  allowHistoryReview: true,
  greetingCooldownMs: HARTHMERE_NON_ANNOYING_DIALOGUE_RULES.repeatedGreetingCooldownMs,
  ambientCooldownMs: HARTHMERE_NON_ANNOYING_DIALOGUE_RULES.ambientBarkCooldownMs,
  choices: [
    { choiceId: "accept_wolves", text: "Accept the job.", type: "quest", tag: "Accept", nextNodeSuccess: "farmer_kell_accept" },
    { choiceId: "ask_location", text: "Where is the north fence?", type: "information", tag: "Ask", nextNodeSuccess: "farmer_kell_location" },
    { choiceId: "threaten_farmer", text: "Threaten him for more pay.", type: "intimidation", tag: "Threaten", warnings: ["relationship_consequence"], warningText: "This may damage your relationship with Farmer Kell.", failForwardOptions: ["He refuses but tells you another farmer may pay for wolf pelts."], nextNodeSuccess: "farmer_kell_threatened" },
    { choiceId: "leave", text: "Not right now.", type: "leave", tag: "Leave", nextNodeSuccess: null },
  ],
};

export function LocalDevHarthmereDialogueRuleSystemPanel() {
  const problems = validateHarthmereDialogueNode(HARTHMERE_DIALOGUE_SAMPLE_NODE);
  return (
    <section data-harthmere-dialogue-rule-system={HARTHMERE_DIALOGUE_RULE_SYSTEM_VERSION} style={{ padding: 12 }}>
      <h3>Dialogue Rules</h3>
      <p>NPC speech stays short, role-specific, consequence-aware, reviewable, and free of development or system commentary.</p>
      <ul>
        <li>Choice types: flavor, information, quest, moral, faction, combat, trade, skill, class, reputation, hidden.</li>
        <li>Edge cases: death, combat, distance, disconnect, double-click, missing item, reputation shift, party consent.</li>
        <li>Server contract: validate, apply effects atomically, log, update journal/map/tracker.</li>
        <li>Sample validation: {problems.length === 0 ? "clean" : problems.join(", ")}</li>
      </ul>
    </section>
  );
}

export default LocalDevHarthmereDialogueRuleSystemPanel;
