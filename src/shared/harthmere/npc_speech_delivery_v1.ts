// HARTHMERE_NPC_SPEECH_DELIVERY_V1
//
// Human-facing delivery rules for Azure Speech SSML. Voice profile assignment
// chooses the actor's base voice; this layer shapes each spoken line so urgent,
// quiet, clinical, suspicious, and robotic characters do not all read with the
// same flat cadence.

export type HarthmereSpeechDeliveryToneV1 =
  | "warm_practical"
  | "brisk_road"
  | "dry_precise"
  | "mechanical_practical"
  | "visual_gentle"
  | "dignified_affirming"
  | "lyrical_mystery"
  | "curious_wry"
  | "clinical_blunt"
  | "rambling_elder"
  | "service_robot"
  | "corrupted_robot"
  | "ledger_official"
  | "builder_grounded"
  | "workshop_gruff"
  | "garden_patient"
  | "food_warm"
  | "merchant_bright"
  | "transit_brisk"
  | "security_command"
  | "ward_soft"
  | "refugee_weary"
  | "trauma_quiet"
  | "shady_clipped"
  | "entitled_polished"
  | "street_wise"
  | "procedural_sentinel";

export interface HarthmereSpeechDeliveryProfileV1 {
  tone: HarthmereSpeechDeliveryToneV1;
  rateDelta: number;
  pitchDelta: number;
  volume?: "default" | "soft" | "medium" | "loud";
  styleHint?: string;
  styleDegreeDelta?: number;
  sentenceBreakDeltaMs: number;
  phraseBreakRatio: number;
  commaBreakRatio: number;
  ellipsisBreakRatio: number;
}

export interface HarthmereResolvedSpeechDeliveryV1
  extends HarthmereSpeechDeliveryProfileV1 {
  actorKey?: string;
}

const BASE_DELIVERIES_V1: Record<
  HarthmereSpeechDeliveryToneV1,
  HarthmereSpeechDeliveryProfileV1
> = {
  warm_practical: {
    tone: "warm_practical",
    rateDelta: 0,
    pitchDelta: 0,
    sentenceBreakDeltaMs: 10,
    phraseBreakRatio: 0.48,
    commaBreakRatio: 0.28,
    ellipsisBreakRatio: 1.45,
    styleHint: "friendly",
  },
  brisk_road: {
    tone: "brisk_road",
    rateDelta: 3,
    pitchDelta: 1,
    sentenceBreakDeltaMs: -18,
    phraseBreakRatio: 0.42,
    commaBreakRatio: 0.22,
    ellipsisBreakRatio: 1.2,
    styleHint: "chat",
  },
  dry_precise: {
    tone: "dry_precise",
    rateDelta: -2,
    pitchDelta: -1,
    sentenceBreakDeltaMs: 24,
    phraseBreakRatio: 0.55,
    commaBreakRatio: 0.32,
    ellipsisBreakRatio: 1.55,
    styleHint: "serious",
  },
  mechanical_practical: {
    tone: "mechanical_practical",
    rateDelta: 1,
    pitchDelta: -1,
    sentenceBreakDeltaMs: 4,
    phraseBreakRatio: 0.44,
    commaBreakRatio: 0.25,
    ellipsisBreakRatio: 1.25,
    styleHint: "chat",
  },
  visual_gentle: {
    tone: "visual_gentle",
    rateDelta: -1,
    pitchDelta: 1,
    sentenceBreakDeltaMs: 20,
    phraseBreakRatio: 0.52,
    commaBreakRatio: 0.34,
    ellipsisBreakRatio: 1.55,
    styleHint: "friendly",
  },
  dignified_affirming: {
    tone: "dignified_affirming",
    rateDelta: -2,
    pitchDelta: 1,
    sentenceBreakDeltaMs: 18,
    phraseBreakRatio: 0.52,
    commaBreakRatio: 0.3,
    ellipsisBreakRatio: 1.35,
    styleHint: "friendly",
  },
  lyrical_mystery: {
    tone: "lyrical_mystery",
    rateDelta: -3,
    pitchDelta: 1,
    sentenceBreakDeltaMs: 32,
    phraseBreakRatio: 0.58,
    commaBreakRatio: 0.38,
    ellipsisBreakRatio: 1.85,
    styleHint: "hopeful",
  },
  curious_wry: {
    tone: "curious_wry",
    rateDelta: 0,
    pitchDelta: 1,
    sentenceBreakDeltaMs: 18,
    phraseBreakRatio: 0.5,
    commaBreakRatio: 0.3,
    ellipsisBreakRatio: 1.6,
    styleHint: "friendly",
  },
  clinical_blunt: {
    tone: "clinical_blunt",
    rateDelta: -2,
    pitchDelta: -2,
    sentenceBreakDeltaMs: 26,
    phraseBreakRatio: 0.55,
    commaBreakRatio: 0.3,
    ellipsisBreakRatio: 1.5,
    styleHint: "empathetic",
  },
  rambling_elder: {
    tone: "rambling_elder",
    rateDelta: -4,
    pitchDelta: -1,
    sentenceBreakDeltaMs: 42,
    phraseBreakRatio: 0.62,
    commaBreakRatio: 0.38,
    ellipsisBreakRatio: 1.85,
    styleHint: "friendly",
  },
  service_robot: {
    tone: "service_robot",
    rateDelta: -1,
    pitchDelta: -1,
    sentenceBreakDeltaMs: 36,
    phraseBreakRatio: 0.6,
    commaBreakRatio: 0.34,
    ellipsisBreakRatio: 1.5,
    styleHint: "conversation",
    styleDegreeDelta: -0.08,
  },
  corrupted_robot: {
    tone: "corrupted_robot",
    rateDelta: -6,
    pitchDelta: -3,
    volume: "soft",
    sentenceBreakDeltaMs: 70,
    phraseBreakRatio: 0.72,
    commaBreakRatio: 0.42,
    ellipsisBreakRatio: 2.1,
    styleHint: "whispering",
    styleDegreeDelta: 0.08,
  },
  ledger_official: {
    tone: "ledger_official",
    rateDelta: -2,
    pitchDelta: -1,
    sentenceBreakDeltaMs: 24,
    phraseBreakRatio: 0.55,
    commaBreakRatio: 0.32,
    ellipsisBreakRatio: 1.45,
    styleHint: "serious",
  },
  builder_grounded: {
    tone: "builder_grounded",
    rateDelta: -1,
    pitchDelta: -1,
    sentenceBreakDeltaMs: 18,
    phraseBreakRatio: 0.52,
    commaBreakRatio: 0.3,
    ellipsisBreakRatio: 1.35,
    styleHint: "conversation",
  },
  workshop_gruff: {
    tone: "workshop_gruff",
    rateDelta: 1,
    pitchDelta: -2,
    sentenceBreakDeltaMs: 8,
    phraseBreakRatio: 0.46,
    commaBreakRatio: 0.25,
    ellipsisBreakRatio: 1.25,
    styleHint: "chat",
  },
  garden_patient: {
    tone: "garden_patient",
    rateDelta: -3,
    pitchDelta: 1,
    sentenceBreakDeltaMs: 34,
    phraseBreakRatio: 0.58,
    commaBreakRatio: 0.36,
    ellipsisBreakRatio: 1.6,
    styleHint: "friendly",
  },
  food_warm: {
    tone: "food_warm",
    rateDelta: 1,
    pitchDelta: 1,
    sentenceBreakDeltaMs: 4,
    phraseBreakRatio: 0.44,
    commaBreakRatio: 0.25,
    ellipsisBreakRatio: 1.2,
    styleHint: "cheerful",
  },
  merchant_bright: {
    tone: "merchant_bright",
    rateDelta: 2,
    pitchDelta: 1,
    sentenceBreakDeltaMs: -4,
    phraseBreakRatio: 0.42,
    commaBreakRatio: 0.24,
    ellipsisBreakRatio: 1.25,
    styleHint: "friendly",
  },
  transit_brisk: {
    tone: "transit_brisk",
    rateDelta: 3,
    pitchDelta: 0,
    sentenceBreakDeltaMs: -14,
    phraseBreakRatio: 0.4,
    commaBreakRatio: 0.22,
    ellipsisBreakRatio: 1.15,
    styleHint: "chat",
  },
  security_command: {
    tone: "security_command",
    rateDelta: -1,
    pitchDelta: -2,
    sentenceBreakDeltaMs: 18,
    phraseBreakRatio: 0.52,
    commaBreakRatio: 0.28,
    ellipsisBreakRatio: 1.35,
    styleHint: "serious",
  },
  ward_soft: {
    tone: "ward_soft",
    rateDelta: -4,
    pitchDelta: -1,
    volume: "soft",
    sentenceBreakDeltaMs: 42,
    phraseBreakRatio: 0.62,
    commaBreakRatio: 0.38,
    ellipsisBreakRatio: 1.85,
    styleHint: "empathetic",
  },
  refugee_weary: {
    tone: "refugee_weary",
    rateDelta: -5,
    pitchDelta: -2,
    volume: "soft",
    sentenceBreakDeltaMs: 48,
    phraseBreakRatio: 0.62,
    commaBreakRatio: 0.4,
    ellipsisBreakRatio: 1.9,
    styleHint: "sad",
  },
  trauma_quiet: {
    tone: "trauma_quiet",
    rateDelta: -6,
    pitchDelta: -2,
    volume: "soft",
    sentenceBreakDeltaMs: 58,
    phraseBreakRatio: 0.68,
    commaBreakRatio: 0.42,
    ellipsisBreakRatio: 2.2,
    styleHint: "empathetic",
  },
  shady_clipped: {
    tone: "shady_clipped",
    rateDelta: -1,
    pitchDelta: -3,
    volume: "soft",
    sentenceBreakDeltaMs: 8,
    phraseBreakRatio: 0.4,
    commaBreakRatio: 0.2,
    ellipsisBreakRatio: 1.35,
    styleHint: "serious",
  },
  entitled_polished: {
    tone: "entitled_polished",
    rateDelta: -1,
    pitchDelta: 2,
    sentenceBreakDeltaMs: 12,
    phraseBreakRatio: 0.46,
    commaBreakRatio: 0.27,
    ellipsisBreakRatio: 1.25,
    styleHint: "chat",
  },
  street_wise: {
    tone: "street_wise",
    rateDelta: 2,
    pitchDelta: -1,
    sentenceBreakDeltaMs: -2,
    phraseBreakRatio: 0.42,
    commaBreakRatio: 0.24,
    ellipsisBreakRatio: 1.25,
    styleHint: "chat",
  },
  procedural_sentinel: {
    tone: "procedural_sentinel",
    rateDelta: -4,
    pitchDelta: -2,
    sentenceBreakDeltaMs: 64,
    phraseBreakRatio: 0.72,
    commaBreakRatio: 0.42,
    ellipsisBreakRatio: 1.7,
    styleHint: "conversation",
    styleDegreeDelta: -0.1,
  },
};

const EXACT_TONE_BY_ID_V1: Readonly<
  Record<string, HarthmereSpeechDeliveryToneV1>
> = {
  jackie: "warm_practical",
  billy: "brisk_road",
  ranger_jane: "dry_precise",
  luis: "mechanical_practical",
  taye: "visual_gentle",
  alexis: "dignified_affirming",
  sil: "lyrical_mystery",
  dimmi: "curious_wry",
  doc: "clinical_blunt",
  old_coop: "rambling_elder",
  buddy: "service_robot",
  mucked_robot: "corrupted_robot",
  rosalyn: "warm_practical",
  guild_clerk_nia: "ledger_official",
  grove_banker_merl: "ledger_official",
  mira_grove_land_steward: "builder_grounded",
  gus_the_baker: "food_warm",
  fern_the_grower: "garden_patient",
  kit_the_courier: "brisk_road",
  mel_market: "merchant_bright",
  mel_the_handyman: "workshop_gruff",
  rin_forager: "dry_precise",
  rin_the_forager: "dry_precise",
  carlo_the_cook: "food_warm",
};

function actorIdFromKeyV1(actorKey: string | undefined) {
  const parts = actorKey?.split(":").filter(Boolean) ?? [];
  return parts.length >= 2 ? parts[1] : undefined;
}

function toneFromActorTextV1(text: string): HarthmereSpeechDeliveryToneV1 {
  if (/\b(corrupted|mucked robot)\b/.test(text)) return "corrupted_robot";
  if (/\b(robot|sentinel|automaton|protocol)\b/.test(text)) {
    return "procedural_sentinel";
  }
  if (
    /\b(doc|doctor|clinic|healer|medic|medicine|memory-sickness|field dressing)\b/.test(
      text
    )
  ) {
    return "clinical_blunt";
  }
  if (
    /\b(refugee|collapsed home|folded|displaced|lost home|mother|widow|widower)\b/.test(
      text
    )
  ) {
    return "refugee_weary";
  }
  if (
    /\b(lost twelve hours|won't wake|forget|losing minutes|quiet corner|home folded)\b/.test(
      text
    )
  ) {
    return "trauma_quiet";
  }
  if (
    /\b(no copy|no log|false name|back stairs|cold steel|no marks|harthmere folk)\b/.test(
      text
    )
  ) {
    return "shady_clipped";
  }
  if (/\b(captain|guard|security|patrol|watch|bounty|redoubt)\b/.test(text)) {
    return "security_command";
  }
  if (
    /\b(clerk|ledger|bank|vault|loan|charter|permit|warden|inspector)\b/.test(
      text
    )
  ) {
    return "ledger_official";
  }
  if (/\b(builder|property|plot|deed|foundation|land steward)\b/.test(text)) {
    return "builder_grounded";
  }
  if (/\b(ward|charm|moonstall|quiet magic|chapel)\b/.test(text)) {
    return "ward_soft";
  }
  if (
    /\b(courier|runner|parcel|dispatch|jump|portal|transit|returnstone|route)\b/.test(
      text
    )
  ) {
    return "transit_brisk";
  }
  if (/\b(forge|smith|tool|hinge|repair|rig|bench|fixture)\b/.test(text)) {
    return "workshop_gruff";
  }
  if (/\b(cook|baker|bread|stew|food|kitchen|inn|meal|bowl|ale)\b/.test(text)) {
    return "food_warm";
  }
  if (/\b(garden|grower|herb|seed|crop|farm|flower|moss)\b/.test(text)) {
    return "garden_patient";
  }
  if (
    /\b(trader|merchant|market|peddler|price|discount|bought|sold)\b/.test(text)
  ) {
    return "merchant_bright";
  }
  if (/\b(patroness|spare nothing|estate|designer silks)\b/.test(text)) {
    return "entitled_polished";
  }
  return "warm_practical";
}

export function harthmereSpeechDeliveryForActorV1(input: {
  actorKey?: string;
  text?: string;
}): HarthmereResolvedSpeechDeliveryV1 {
  const actorId = actorIdFromKeyV1(input.actorKey);
  const exactTone = actorId ? EXACT_TONE_BY_ID_V1[actorId] : undefined;
  const text = `${input.actorKey ?? ""} ${input.text ?? ""}`.toLowerCase();
  const base = BASE_DELIVERIES_V1[exactTone ?? toneFromActorTextV1(text)];
  return {
    ...base,
    actorKey: input.actorKey,
  };
}

export function harthmereSpeechDeliveryToneForActorForTestV1(input: {
  actorKey?: string;
  text?: string;
}) {
  return harthmereSpeechDeliveryForActorV1(input).tone;
}

export function harthmereSpeechDeliveryPromptBriefV1(input: {
  actorKey?: string;
  text?: string;
}) {
  const delivery = harthmereSpeechDeliveryForActorV1(input);
  const guidanceByTone: Record<HarthmereSpeechDeliveryToneV1, string> = {
    warm_practical:
      "warm but practical; use concrete help, road markers, bags, and next steps",
    brisk_road:
      "quick and road-wise; use short clauses, movement, parcels, routes, and risk",
    dry_precise:
      "dry and precise; give clean warnings, observations, and boundaries",
    mechanical_practical:
      "hands-on and mechanical; talk through parts, repairs, tools, and sequence",
    visual_gentle:
      "gentle and visual; use colors, signs, shape, and what the player can see",
    dignified_affirming:
      "dignified and affirming; make clothing, identity, and readiness feel respected",
    lyrical_mystery:
      "quietly lyrical; use sound, memory, tone, and mystery without becoming poetry-heavy",
    curious_wry:
      "curious and wry; ask for proof, mention lenses, water, evidence, and odd details",
    clinical_blunt:
      "clinical and blunt; use symptoms, samples, rules, and exact safety advice",
    rambling_elder:
      "older and rambling but useful; use route memory, gossip, and practical backup advice",
    service_robot:
      "helpful service protocol; sound kind, literal, and slightly damaged but useful",
    corrupted_robot:
      "corrupted service protocol; polite contradictions, wrong-safe warnings, unsettling pauses",
    ledger_official:
      "official and ledger-minded; use permissions, records, debts, charters, and consequences",
    builder_grounded:
      "grounded and construction-minded; use boundaries, foundations, paths, and permits",
    workshop_gruff:
      "gruff and repair-minded; use tools, hinges, rigs, benches, and no-nonsense fixes",
    garden_patient:
      "patient and earthy; use watering, seeds, crops, moss, birds, and daily renewal",
    food_warm:
      "warm and food-busy; use bread, bowls, service line urgency, and feeding people",
    merchant_bright:
      "bright and transactional; use prices, stock, fair trade, discounts, and value",
    transit_brisk:
      "brisk and transit-aware; use jumps, pads, routes, parcels, charge, and timing",
    security_command:
      "commanding and protective; use patrols, walls, guards, watch duty, and risk",
    ward_soft:
      "soft and ward-wise; use charms, quiet magic, restraint, and protective care",
    refugee_weary:
      "weary and displaced; use simple concrete losses, shelter, food, rooms, and dignity",
    trauma_quiet:
      "quiet and traumatized; use fewer words, pauses, memory trouble, and controlled fear",
    shady_clipped:
      "guarded and clipped; reveal little, use short answers, no ledger, no marks, and suspicion",
    entitled_polished:
      "polished and entitled; use elegance, demands, and denial of practical risk",
    street_wise:
      "street-wise and transactional; use caution, bargains, alleys, and hard-earned sense",
    procedural_sentinel:
      "calm and procedural; use status, shield, power, recharge, and assistance protocols",
  };
  return `Tone: ${delivery.tone}. Delivery: ${guidanceByTone[delivery.tone]}.`;
}
