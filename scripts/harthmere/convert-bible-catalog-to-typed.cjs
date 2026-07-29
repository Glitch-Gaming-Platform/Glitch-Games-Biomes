#!/usr/bin/env node
// CONVERT_BIBLE_CATALOG_TO_TYPED
//
// One-shot migration tool. Reads the retired `HARTHMERE_QUEST_CATALOG_JSON`
// template literal out of `quest_compendium.ts` and emits typed
// `BibleQuestDef[]` modules split per arc.
//
// ALREADY RUN. THIS SCRIPT NO LONGER EXECUTES.
//
// `quest_compendium.ts` was deleted in phase 4 once nothing imported it, so
// the input this reads is gone. The script is retained as PROVENANCE: it is
// the exact transform that produced `bible/bible_quests_*.ts`, and those
// generated modules are now ordinary committed source, hand-editable like
// `ch1_quests.ts`.
//
// To re-run it you would have to restore `quest_compendium.ts` from git
// history first. Do not "fix" this by re-pointing it at the generated output —
// that would make the conversion circular and would quietly launder an edit to
// the catalog into a re-derivation.
//
//   node scripts/harthmere/convert-bible-catalog-to-typed.cjs [--arc main]
//
// See docs/harthmere/BIBLE_TO_CH1_MIGRATION.md.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = path.join(ROOT, "src/shared/harthmere/quest_compendium.ts");
const OUT_DIR = path.join(ROOT, "src/shared/harthmere/bible");

function readAuthoredCatalog() {
  const text = fs.readFileSync(SOURCE, "utf8");
  const match = text.match(/HARTHMERE_QUEST_CATALOG_JSON = (`[\s\S]*?`);/);
  if (!match) {
    throw new Error("HARTHMERE_QUEST_CATALOG_JSON not found in quest_compendium.ts");
  }
  // The catalog is a template literal containing an escaped JSON document.
  // Evaluating the literal (not the JSON) yields the real JSON text.
  // eslint-disable-next-line no-eval
  return JSON.parse(eval(match[1]));
}

// ---------------------------------------------------------------------------
// Arc assignment. Drives which module a quest lands in, and therefore how
// little a scoped test has to parse.
// ---------------------------------------------------------------------------
function arcFor(quest) {
  switch (quest.category) {
    case "main":
      return "main";
    case "starter":
      return "starter";
    case "repeatable":
      return "repeatable";
    default:
      return "side"; // side + side_hidden
  }
}

// ---------------------------------------------------------------------------
// activeRules -> start
//
// Every non-`speak_to_giver` start trigger in the authored data carries a real
// single prerequisite except the three `world_trigger` side_hidden rows, so
// the flavour of the start (a well mentioning Nessa, a boss encounter) is
// presentation and already lives in `dialogue.offer`. Collapsing to three
// kinds loses no information and makes the native unlock projection total.
// ---------------------------------------------------------------------------
function startFor(quest) {
  const prerequisites = (quest.activeRules?.prerequisiteQuestIds ?? []).filter(
    (id) => typeof id === "string" && id.length > 0
  );
  if (prerequisites.length > 1) {
    // No authored quest does this today. Fail loudly rather than silently
    // dropping a prerequisite if one is ever added.
    throw new Error(
      `${quest.id}: multi-prerequisite quests are not representable as a ` +
        `single native challengeComplete unlock; extend BibleQuestStart first`
    );
  }
  if (quest.activeRules?.startTrigger === "world_trigger") {
    return { kind: "world_trigger", discoveryId: `discover_${quest.id}` };
  }
  if (prerequisites.length === 1) {
    // giverId is orthogonal to the prerequisite: 9 gated quests are still
    // offered by an NPC, 4 auto-start. Omitting giverId is what auto-starts.
    return quest.giverId
      ? { kind: "after", questId: prerequisites[0], giverId: quest.giverId }
      : { kind: "after", questId: prerequisites[0] };
  }
  if (!quest.giverId) {
    throw new Error(`${quest.id}: no giver and no prerequisite and not hidden`);
  }
  return { kind: "giver", giverId: quest.giverId };
}

// An authored gate that lists EVERY value is not a gate. Collapsing those to
// `[]` ("any", per the schema) is not cosmetic:
//   * it removes ~24 array entries per quest from the parsed module, which is
//     the dominant cost of a fast-suite run (TESTING_FASTER section 1.1);
//   * it makes the 9 genuinely time-gated and 2 weather-gated quests the only
//     rows with a non-empty list, so a reviewer can see every gate at a glance
//     instead of diffing 24-element arrays;
//   * the gate then short-circuits on `length === 0` instead of scanning.
const ALL_TIMES_OF_DAY = ["dawn", "day", "dusk", "night"];
const ALL_WEATHER = ["clear", "rain", "storm", "fog", "snow"];
const ALL_HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function collapseIfComplete(authored, complete) {
  const values = authored ?? [];
  if (values.length !== complete.length) return values;
  const present = new Set(values);
  return complete.every((value) => present.has(value)) ? [] : values;
}

// AUTHORING DEFECT, PRESERVED NOT SILENTLY FIXED.
//
// Three River Knots / Briarfen rows list "fog" inside `timeOfDay`:
//   repeatable_river_knots_information_drops     ["dusk","night","fog"]
//   repeatable_river_knots_small_smuggling_runs  ["night","fog"]
//   repeatable_briarfen_witchlights              ["night","fog"]
//
// The writer meant "at dusk/night, OR when it is foggy" — an OR across two
// fields the schema cannot express. The retired gate compared `timeOfDay`
// against a context value that is only ever dawn/day/dusk/night, so the "fog"
// token NEVER matched and was inert: those quests are dusk/night-gated in
// practice and always have been.
//
// Moving "fog" into `weather` would look like the obvious fix and would be a
// live regression: `weather` is currently the complete set (i.e. "any"), so
// gating on fog would make these quests UNAVAILABLE on a clear night, which is
// when players actually run them.
//
// So the converter drops the inert token — preserving shipped behaviour
// exactly — and reports it, rather than quietly changing what a player can do.
// Resolving the writer's real intent needs a design decision and an OR-capable
// gate, which is tracked in the migration doc rather than smuggled in here.
const AUTHORING_DEFECTS = [];

function dropInertTokens(questId, field, values, allowed) {
  const kept = values.filter((value) => allowed.includes(value));
  for (const value of values) {
    if (!allowed.includes(value)) {
      AUTHORING_DEFECTS.push(
        `${questId}: "${value}" is not a valid ${field} value; it never ` +
          `matched at runtime and has been dropped (behaviour unchanged)`
      );
    }
  }
  return kept;
}

function gateFor(quest) {
  const rules = quest.activeRules ?? {};
  return {
    levelBand: {
      min: quest.levelBand?.min ?? 1,
      max: quest.levelBand?.max ?? 60,
    },
    timeOfDay: collapseIfComplete(
      dropInertTokens(
        quest.id,
        "timeOfDay",
        rules.timeOfDay ?? [],
        ALL_TIMES_OF_DAY
      ),
      ALL_TIMES_OF_DAY
    ),
    activeHours: collapseIfComplete(rules.activeHours, ALL_HOURS),
    weather: collapseIfComplete(
      dropInertTokens(quest.id, "weather", rules.weather ?? [], ALL_WEATHER),
      ALL_WEATHER
    ),
    requiredFlags: rules.requiredFlags ?? [],
  };
}

function stepFor(objective, quest) {
  const waypoint =
    objective.location?.waypoint ?? quest.location?.waypoint ?? [0, 0, 0];
  return {
    id: objective.id,
    label: objective.label,
    type: objective.type,
    targetId: objective.targetId,
    targetName: objective.targetName,
    district: objective.location?.district ?? quest.location?.district ?? "",
    authoredWaypoint: [waypoint[0], waypoint[1], waypoint[2]],
    count: objective.count ?? 1,
    validation: {
      serverAuthority: objective.validation?.serverAuthority !== false,
      requiresLineOfSight: objective.validation?.requiresLineOfSight === true,
      maxDistance: objective.validation?.maxDistance ?? 8,
      idempotent: objective.validation?.idempotent !== false,
      ...(objective.validation?.requiresChoiceRevalidation
        ? { requiresChoiceRevalidation: true }
        : {}),
      ...(objective.validation?.requiresCombatValidation
        ? { requiresCombatValidation: true }
        : {}),
    },
    failureCases: objective.failureCases ?? [],
  };
}

function convert(quest) {
  const waypoint = quest.location?.waypoint ?? [0, 0, 0];
  const start = startFor(quest);
  return {
    id: quest.id,
    code: quest.code ?? "",
    title: quest.title,
    category: quest.category,
    arc: arcFor(quest),
    ...(quest.giverName ? { giverName: quest.giverName } : {}),
    hidden: quest.hidden === true,
    district: quest.location?.district ?? "",
    authoredWaypoint: [waypoint[0], waypoint[1], waypoint[2]],
    estimatedMinutes: quest.estimatedMinutes ?? 0,
    contentType: quest.contentType ?? "",
    repeatability: quest.repeatability ?? "once",
    phase: quest.phase ?? "",
    premise: quest.premise ?? "",
    bibleRef: quest.bibleRef ?? "",
    bellTie: quest.bellTie === true,
    start,
    gate: gateFor(quest),
    steps: (quest.objectives ?? []).map((objective) =>
      stepFor(objective, quest)
    ),
    ...(quest.choices?.length ? { choices: quest.choices } : {}),
    rewards: {
      xp: quest.rewards?.xp ?? 0,
      silver: quest.rewards?.silver ?? 0,
      items: quest.rewards?.items ?? [],
      titles: quest.rewards?.titles ?? [],
      reputation: quest.rewards?.reputation ?? {},
      unlocks: quest.rewards?.unlocks ?? [],
      permanentBuffs: quest.rewards?.permanentBuffs ?? [],
      variable: quest.rewards?.variable === true,
      previewText: quest.rewards?.previewText ?? "",
    },
    dialogue: {
      offer: quest.dialogue?.offer ?? "",
      active: quest.dialogue?.active ?? "",
      ready: quest.dialogue?.ready ?? "",
      complete: quest.dialogue?.complete ?? "",
      fail: quest.dialogue?.fail ?? "",
    },
  };
}

// ---------------------------------------------------------------------------
// Emit. `JSON.stringify` then prettify: the output is committed source, so it
// has to read like something a person could edit by hand.
// ---------------------------------------------------------------------------
function emitModule(arc, quests) {
  const constName = `BIBLE_QUESTS_${arc.toUpperCase()}`;
  const body = quests
    .map((quest) => JSON.stringify(quest, null, 2))
    .join(",\n")
    .split("\n")
    .map((line) => (line.trim() ? `  ${line}` : line))
    .join("\n");
  return `// BIBLE_QUESTS_${arc.toUpperCase()} — generated by
// scripts/harthmere/convert-bible-catalog-to-typed.cjs from the retired
// HARTHMERE_QUEST_CATALOG_JSON, then owned as ordinary source.
//
// ORDER IS FROZEN. Native quest and step ids are derived from array index
// (bible_quest_ids.ts), so appending is free and reordering is a migration.
// bible_quest_ids.test.ts fails on any reorder.

import type { BibleQuestDef } from "@/shared/harthmere/bible/bible_quest_schema";

// ANNOTATION PLACEMENT — deliberate, and the two alternatives were tried.
//
// Annotating the DECLARATION gives every element the contextual type
// BibleQuestDef, so tsc checks each row against one known target.
//
//   * \`Object.freeze([...])\` with no element context infers a UNION of ${String(quests.length).padEnd(2)}
//     anonymous shapes. Every optional \`rewards.reputation\` key then appears
//     as \`number | undefined\` and the module DOES NOT COMPILE. Verified.
//   * \`Object.freeze([...] as const)\` compiles, but builds a ${String(quests.length).padEnd(2)}-element tuple
//     of deeply-nested literal types before checking assignability. Measured
//     between 13.3 s and 18.2 s against 13.0-15.4 s for this form — i.e.
//     within run-to-run noise on the machine used, so no speed claim is made
//     for it either way. This form is preferred for being the one that states
//     the intended type once, at the top, where a reader looks for it.
const QUESTS: BibleQuestDef[] = [
${body}
];

export const ${constName}: readonly BibleQuestDef[] = Object.freeze(QUESTS);
`;
}

function main() {
  const argArc = process.argv.includes("--arc")
    ? process.argv[process.argv.indexOf("--arc") + 1]
    : undefined;
  const catalog = readAuthoredCatalog();
  const converted = catalog.map(convert);
  const byArc = { main: [], side: [], starter: [], repeatable: [] };
  for (const quest of converted) byArc[quest.arc].push(quest);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const written = [];
  for (const [arc, quests] of Object.entries(byArc)) {
    if (argArc && argArc !== arc) continue;
    const file = path.join(OUT_DIR, `bible_quests_${arc}.ts`);
    fs.writeFileSync(file, emitModule(arc, quests));
    written.push(`${path.relative(ROOT, file)}  (${quests.length} quests)`);
  }

  console.log("converted %d quests", converted.length);
  for (const line of written) console.log("  " + line);
  const steps = converted.reduce((sum, q) => sum + q.steps.length, 0);
  const zeroY = converted
    .flatMap((q) => q.steps)
    .filter((s) => s.authoredWaypoint[1] === 0).length;
  console.log("  %d steps, %d with authored Y=0 (resolver-only)", steps, zeroY);
  if (AUTHORING_DEFECTS.length) {
    console.log(
      "\n%d authoring defect(s) preserved-not-fixed (see migration doc section 13):",
      AUTHORING_DEFECTS.length
    );
    for (const defect of AUTHORING_DEFECTS) console.log("  " + defect);
  }
}

main();
