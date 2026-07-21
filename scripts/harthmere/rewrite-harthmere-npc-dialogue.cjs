#!/usr/bin/env node
/* eslint-disable no-console */

// Rebuilds the static Harthmere compendium dialogue from public character
// identity, occupation, faction, and location. Quest secrets are deliberately
// excluded: ambient conversation may foreshadow local trouble, but it must not
// reveal gated Bellbound answers.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const FILE = path.join(ROOT, "src", "shared", "harthmere", "npc_compendium.ts");
const FIELDS = ["greeting", "service", "rumor", "questOffer", "farewell"];

// Hand-authored public anchors for named and quest-adjacent NPCs. We do not
// copy `bibleBackstory` directly because it contains private motives and
// Bellbound answers that casual conversation must not reveal early.
const PUBLIC_DETAIL = {
  sergeant_bram_holt:
    "I keep the North Gate orderly and make certain tired guards remember that authority is a duty, not a license",
  walt_ormsby:
    "I train recruits hard, stop bullies harder, and still know every muddy lane between the Guard Yard and Mudden Ward",
  mara_thistle:
    "I raised a family behind a market stall, so I can price an onion, spot a cheat, and hear grief hiding inside gossip",
  edrik_vane:
    "I lend carefully, collect patiently, and prefer signed figures to the loud moral theater of Noble Rise",
  reeve_caldus_merrow:
    "I inherited Harthmere's seal along with its roads, debts, petitions, and the expectation that none of them fail in public",
  master_osric_vale:
    "Five generations of Vale smiths taught me that honest iron answers a clean hammer long before it answers a speech",
  apprentice_luth:
    "Osric taught me the forge, books taught me the rest, and both agree that metal remembers careless hands",
  master_garrik_fen:
    "I build roofs, braces, carts, and whatever else keeps Harthmere standing when weather and officials arrive together",
  helna_voss:
    "Cloth tells me who works, who mourns, who is pretending to prosper, and who needs a seam repaired without public questions",
  selka_doryn:
    "I judge leather by grain, hunters by the hides they bring, and saddles by whether a frightened horse will trust them",
  ysabet_fenlow:
    "Herbs, river damp, fever, and sleeplessness all leave different traces if a healer is patient enough to notice",
  old_jory_brann:
    "Horses are plainer company than officials, and they feel a bad road or restless ground before most riders do",
  dawn_loaf:
    "Bread is Harthmere's daily arithmetic: grain in, loaves out, and no child or apprentice left hungry if I can prevent it",
  tovin_reed:
    "I know the river by rope strain, cargo weight, weather smell, and the silence a crew keeps around a dishonest manifest",
  lina_reed:
    "I grew up beside the docks, where water carries songs, warnings, and things adults decide they did not hear",
  sora_reed:
    "I run dock errands quickly enough to know which barges are late, which ropes are frayed, and which grown-ups are worried",
  father_aldren_mell:
    "I keep the chapel's rites, records, and frightened silences in order while the town asks faith to sound more certain than people feel",
  sister_maelle_frenn:
    "I tend wounds and fevers without confusing kindness for gullibility or pain for permission to be cruel",
  brother_vance_holt:
    "Poor sight taught me to listen closely; footsteps, pauses, and careful omissions often tell more than a confident face",
  brother_halpen_wren:
    "I catalogue prayers, graves, and old town references because neglected records have a habit of becoming present trouble",
  mother_halene_brae:
    "Memory holds me near the chapel, where duty, mercy, and old choices still echo more loudly than any living sermon",
  elowen_pike:
    "I keep the Copper Kettle warm, the rooms accounted for, and rumor useful enough that it does not become simple cruelty",
  tisa_pike:
    "Serving tables taught me to read a room by empty cups, untouched meals, and the person everyone avoids looking toward",
  cellan_bow:
    "I turn Harthmere's work, weather, and grief into songs people can carry without pretending any of it was easy",
  nessa_crowe:
    "Mudden Ward raised me to know dry ledges, loose stones, rat paths, and which friendly shortcut becomes a trap after rain",
  old_tam_crowe:
    "I remember Mudden floods, evictions, bargains, and betrayals because a ward without memory is easy to cheat twice",
  boy_tam:
    "I listen more than grown-ups expect, especially near the old stones where sounds travel in ways they should not",
  banker_merl_voss:
    "I make storage and accounts deliberately boring, because excitement is the last quality anyone should want near their savings",
  courier_anwen_mell:
    "A sealed letter is a promise with weight, and I carry promises across Harthmere whether the sender is rich, frightened, or late",
  auction_pell_marsten:
    "I keep bids public, rules exact, and favoritism outside the auction rail where it belongs",
  erena_voss:
    "I register guild charters and apprentices so craft reputation rests on witnessed work instead of family boasting",
  lady_henrietta_merrow:
    "Years among capital nobles taught me how courtesy can shelter kindness, sharpen a warning, or disguise an empty threat",
  lila_merrow:
    "Noble Rise has too many windows and too little fresh air, so I pay attention to the streets its residents discuss only at dinner",
  ren_skell:
    "Stable work rewards quiet hands, early mornings, and the sense to treat a frightened animal better than a proud rider",
  lord_wrethan_pell:
    "I audit law and revenue carefully because a neat column can conceal either honest hardship or practiced theft",
  henrick_brell:
    "The ferry teaches short lessons: balance the load, respect the current, and never boast before both banks are behind you",
  veska_reed:
    "River people survive by keeping their word, choosing their risks, and knowing when a law protects the town or merely its richest desk",
  edda_wren:
    "I count road deaths, broken markers, missing travelers, and every warning that someone in town found inconvenient",
  merrit_bracken:
    "Charcoal smoke, old tracks, and the temper of the wood have kept me alive longer than speed or fine equipment would have",
  sella_reedfoot:
    "Briarfen has safe planks, false ground, and reeds that point away from deep water if you know how to read them",
  tamsin_vale:
    "I hunt cleanly, boast more than my uncle likes, and know the difference between a bold trail and a foolish one most days",
  brother_cael_marsen:
    "The forgotten dead deserve names, straight stones, and a traveler willing to notice when a grave has changed",
  rusk_hallowhand:
    "I learned watch discipline before the roads taught me how cheaply comfortable people value those guarding them",
  veneth_moss_woman:
    "I knew these roots before Harthmere named its wards, and I measure promises by seasons rather than signatures",

  tessen_hark:
    "I am still learning whether a guard's oath means obeying the loudest order or protecting the person most easily ignored",
  yenna_holt:
    "Illness keeps me indoors too often, but the gate brings enough footsteps and stories that I still know when Father is worried",
  bree_thistle:
    "What remains of Bree lives in market memory, family grief, and stories that should be examined gently rather than consumed as entertainment",
  corvin_bree_friend:
    "I travel with stories, trade news, and enough road dust that sensible people ask for proof before trusting any of them",
  harlo_grain_merchant:
    "I trade grain by season, storage, and risk, though hungry crowds rarely care how respectable a ledger looks",
  rinna_fishmonger:
    "Freshness, weight, and a clean scale decide a fish stall's reputation faster than any painted sign",
  drathmar_envoy:
    "I represent Drathmar at a court where every meal, pause, and seating choice is treated as a small act of diplomacy",
  crown_auditor_selwyn:
    "I follow Crown figures through permits, taxes, and sealed ledgers until public money has nowhere left to hide",
  noble_widow_avelina:
    "Widowhood taught me how quickly polite society studies a person's property while pretending concern for their grief",
  barge_captain_orren:
    "A captain is judged by the cargo delivered, the crew returned, and the explanations required when those numbers differ",
  merrit_apprentice_pell:
    "I tend the charcoal pits and Old Merrit's cough, trying to stretch poor coin across work that cannot simply stop",
  veska_brother_alen:
    "Distance has reduced family to letters, remembered river sounds, and news that never arrives quickly enough",
  evicted_couple_hobb:
    "We built a life from Mudden wages and careful saving, only to learn how small a debt looks from a Noble Rise window",
  vera_harth:
    "Vera's words survive where old masonry, family duty, and dangerous questions meet beneath Harthmere",
  old_harth:
    "Harthmere remembers its founder in monuments, but memory beneath stone is less obedient than civic ceremony",
  outside_gate_father:
    "I brought my family to the North Gate because road danger is immediate and paperwork only feels immediate to guards",
  outside_gate_mother:
    "I fear official papers less than hunger, but I know one frightened lie can close a gate faster than truth opens it",
  outside_gate_child:
    "I stay close to my parents, watch the guards, and remember who speaks about us as if we cannot hear",
};

// Only facts an ordinary resident could observe belong here: work, trade,
// weather, class pressure, and unsettling signs. Confirmed secret causes stay
// in quests and gated story scenes.
const DISTRICT_LORE = {
  "North Gate":
    "cart queues, toll boards, refugee fires, and warnings about roads that worsen after dusk",
  "Guard Yard":
    "drill calls, dented practice shields, and recruits learning that restraint is part of watch work",
  "Market Square":
    "bread prices, fountain gossip, stall permits, and merchants measuring fear as carefully as coin",
  "Noble Rise":
    "deeds, debts, polished manners, and decisions whose cost is usually paid downhill",
  "Craftsman Row":
    "hammer blows, sawdust, tannery sharpness, and repairs that keep the whole town functioning",
  Apothecary:
    "herb bundles, bitter steam, river damp, and patients who waited too long to ask for help",
  "River Docks":
    "changing current, wet rope, cargo ledgers, ferry bells, and crates that invite the wrong questions",
  "Temple Green":
    "candle vigils, charity lines, grave records, and an old unease beneath formal prayers",
  "Copper Kettle":
    "hot food, rented beds, travelers' stories, and rumors polished smooth by repetition",
  "Mudden Ward":
    "flood marks, patched roofs, informal trade, and neighbors who survive by noticing one another",
  "Old Well / Underways":
    "wet stone, chalk marks, lost passages, and echoes that do not always match the speaker",
  "Last Watch Post":
    "a tired brazier, road bounties, failing markers, and the last dependable warning before the wilds",
  "Gate Fields":
    "owned crops, pasture fences, mill traffic, and predators probing the safer edge of settlement",
  "Mill Road":
    "flour carts, a turning waterwheel, and every road delay eventually appearing in the price of bread",
  "Orchard Lane":
    "windfall fruit, old boundary charms, and scarecrows that workers swear have shifted overnight",
  "Greenmere Edge":
    "legal timber, hunter paths, animal sign, and the point where familiar fields stop feeling protected",
  "Old Hunter Track":
    "faded ribbons, false trails, and signs of something using paths meant for experienced hunters",
  "Watchtower Ridge":
    "old quarry cuts, bandit lookouts, loose stone, and a ruined tower that still commands the road",
  Briarfen:
    "reed paths, hidden channels, lantern signals, and mud capable of swallowing evidence as readily as boots",
  Gravewood:
    "disturbed graves, pale animals, root-heaved stones, and birds that fall silent before movement",
  "Deep Old Wood":
    "ancient roots, thorn growth, webbed hollows, and paths that seem to resent being remembered",
};

// Role copy defines the practical knowledge an occupation can reasonably
// provide. Identity and district copy then distinguish people sharing a role.
const ROLE_WORK = {
  guard:
    "I can explain local law, road warnings, watch boundaries, and the difference between keeping order and abusing it",
  recruit_guard:
    "I can share what a recruit is taught about patrols, lawful force, and the roads beyond the gate",
  merchant:
    "I can speak to supply, fair measure, local prices, and which road delays are reaching the stalls",
  crafter:
    "I can judge materials, repairs, apprentices' work, and the small failures that become expensive emergencies",
  clergy:
    "I can offer care, chapel custom, grave courtesy, and what public faith asks of an uneasy town",
  dock: "I can read cargo work, river conditions, ferry practice, and the difference between haste and a dangerous load",
  child:
    "I know which adults listen, where children are warned away, and what changes grown-ups hope we miss",
  historical:
    "I can offer only memory: incomplete, stubborn, and tied to the place that refuses to let it fade",
  noble:
    "I can explain petitions, deeds, public obligations, and the manners people use when power is in the room",
  service:
    "I can point you toward local services, practical help, and the quiet habits that keep this place running",
  mudden:
    "I know the ward's work, safe paths, informal bargains, and which official promises never reached the lower streets",
  wilds_human:
    "I can read weather, tracks, field boundaries, and the moment a familiar route becomes unsafe",
  wilds:
    "I know the old paths, natural signs, and why the wood should never be mistaken for empty land",
  outlaw:
    "I know road discipline, desperate bargains, and the grievances respectable rooms prefer not to hear",
  smuggler:
    "I know hidden channels, coded signals, cargo risk, and which questions make river people reach for knives",
};

// These offers describe plausible work without naming a culprit, solution, or
// other quest-gated revelation.
const ROLE_TASK = {
  guard:
    "check a warning, escort someone vulnerable, or verify trouble before steel makes it worse",
  recruit_guard:
    "settle a patrol matter without turning uncertainty into needless bloodshed",
  merchant:
    "trace a delayed supply, verify a measure, or carry goods where the road has made trade uncertain",
  crafter:
    "recover sound materials, inspect damage, or put a failing piece of town work right",
  clergy:
    "tend the living, honor the dead, or investigate a disturbance without feeding public panic",
  dock: "check a manifest, secure a crossing, or learn why a load and its paperwork disagree",
  child:
    "notice something adults dismissed and bring back an answer without frightening anyone for sport",
  historical:
    "follow the surviving evidence and decide which part of memory deserves belief",
  noble:
    "verify a petition, witness an agreement, or uncover the human cost hidden inside a clean record",
  service:
    "deliver needed help, recover a missing item, or solve the practical problem everyone has stepped around",
  mudden:
    "protect a neighbor, trace a shortage, or fix danger before an eviction crew calls it someone else's problem",
  wilds_human:
    "restore a marker, find a missing worker, or clear a route without damaging owned land",
  wilds:
    "read the land carefully and learn what has disturbed an older balance",
  outlaw:
    "weigh a road grievance against the facts before choosing who deserves your help",
  smuggler:
    "follow a signal or suspect cargo without assuming every law and every crime are the same thing",
};

// Several stable sentence structures avoid one name-substitution template.
// Selection is deterministic so regeneration never creates random diff churn.
const OPENERS = [
  ({ name, district }) =>
    `You found ${name} in ${district}; if you want an answer, ask a question worth stopping for.`,
  ({ name, district }) =>
    `${name}. I know the work and worries of ${district}, though I do not sell either as entertainment.`,
  ({ name, district }) =>
    `Around ${district}, people call me ${name}; speak plainly and I will do the same.`,
  ({ name, district }) =>
    `If ${district} sent you looking for someone, ${name} is the name you were probably given.`,
  ({ name, district }) =>
    `${name}, at your service for a moment. ${district} rarely leaves anyone idle for longer than that.`,
  ({ name, district }) =>
    `Mind where you step and call me ${name}; ${district} has enough confusion without careless introductions.`,
  ({ name, district }) =>
    `I am ${name}. The day's work in ${district} has not swallowed me yet, so ask.`,
  ({ name, district }) =>
    `${name} here. I trust useful questions more than grand entrances, especially in ${district}.`,
];

const SERVICE_TEMPLATES = [
  ({ detail, work }) => `${detail}. ${work}.`,
  ({ detail, work }) =>
    `${work}. That knowledge comes from this much of my life: ${detail}.`,
  ({ detail, work }) =>
    `What I know is practical rather than grand. ${work}. ${detail}.`,
  ({ detail, work }) =>
    `${detail}; because of that, ${work.replace(/^I can /, "I can also ")}.`,
  ({ detail, work }) =>
    `My trade has taught me where trouble begins. ${detail}. ${work}.`,
  ({ detail, work }) => `${work}. I learned it the ordinary way: ${detail}.`,
];

const RUMOR_TEMPLATES = [
  ({ district, lore, name }) =>
    `${name} has noticed ${lore} around ${district}; when several small things change together, it is rarely coincidence.`,
  ({ district, lore, name }) =>
    `The talk reaching ${name} from ${district} concerns ${lore}. Treat it as a warning, not a proven accusation.`,
  ({ district, lore, name }) =>
    `Ask what feels different in ${district}, and ${name} will point to ${lore}. The town is listening for a pattern.`,
  ({ district, lore, name }) =>
    `${district} usually hides worry inside routine, but ${name} keeps hearing about ${lore}. Something is pressing on ordinary life.`,
  ({ district, lore, name }) =>
    `${name} would not call rumor evidence, yet reports of ${lore} keep circling ${district} from people who do not usually agree.`,
  ({ district, lore, name }) =>
    `Lately ${district} has been marked by ${lore}. ${name} advises attention before fear turns the story into nonsense.`,
];

const TASK_TEMPLATES = [
  ({ name, task, district }) =>
    `${name} could use someone willing to ${task} here in ${district}; do it carefully, and bring back facts rather than theater.`,
  ({ name, task, district }) =>
    `If you are looking for useful work, ${name} needs a steady hand to ${task} near ${district}.`,
  ({ name, task, district }) =>
    `${district} has a matter suited to an outsider: ${task}. Return to ${name} when you can explain what actually happened.`,
  ({ name, task, district }) =>
    `${name} will trust you with one local problem if you agree to ${task}; ${district} has suffered enough careless favors.`,
  ({ name, task, district }) =>
    `There is honest work around ${district}: ${task}. ${name} values a clean result more than a heroic retelling.`,
  ({ name, task, district }) =>
    `Before the next rumor grows teeth, ${name} wants someone to ${task} in ${district} and report without embellishment.`,
];

const FAREWELLS = [
  ({ name, district }) =>
    `${name} has work to return to. Walk carefully through ${district}, and leave fewer problems than you found.`,
  ({ name, district }) =>
    `That is enough for now. If you come back to ${name}, bring honest news from ${district}.`,
  ({ name, district }) =>
    `Go safely. ${name} would rather see you return to ${district} wiser than hear a dramatic story about your absence.`,
  ({ name, district }) =>
    `${name} wishes you a steady road. Around ${district}, kept promises travel farther than boasts.`,
  ({ name, district }) =>
    `We are finished for the moment. Mind the warnings in ${district}, even the quiet ones. —${name}`,
  ({ name, district }) =>
    `Take care of your boots, your word, and whoever walks beside you. ${name} will still be in ${district}.`,
];

function hash(text) {
  let value = 2166136261;
  for (const char of text) {
    value ^= char.codePointAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function pick(values, key) {
  return values[hash(key) % values.length];
}

function publicDetail(npc) {
  // Supporting residents fall back to public identity, role, and faction. No
  // `secrets` field or implementation note reaches player-visible copy.
  return (
    PUBLIC_DETAIL[npc.id] ||
    `People know me as ${npc.name}; I work as ${String(
      npc.role || "a local"
    ).replaceAll("_", " ")} among ${
      npc.faction || "the people here"
    }, where reputation depends on useful work and remembered promises`
  );
}

function creatureDialogue(npc) {
  // Animals and hostile actors communicate through observable behavior rather
  // than implausible human speech.
  const district = npc.district || "the Harthmere wilds";
  const category = npc.category || "wild creature";
  if (npc.kind === "animal") {
    return {
      greeting: `${npc.name} does not greet travelers; it pauses in ${district}, weighing scent, wind, and distance before choosing whether to flee or stand.`,
      service: `Watch ${npc.name} rather than approaching it: its posture reveals whether this part of ${district} is calm, hunted, corrupted, or suddenly unsafe.`,
      rumor: `People near ${district} have been comparing signs left by ${npc.name}; changed feeding paths often warn of danger before road patrols notice it.`,
      questOffer: `No words pass from ${npc.name}, but its tracks through ${district} may lead toward a damaged fence, a fouled den, or whatever disturbed the local wildlife.`,
      farewell: `${npc.name} breaks contact on its own terms, leaving bent grass, prints, and one more clue about the present temper of ${district}.`,
    };
  }
  const family = String(category)
    .replaceAll("_", " ")
    .replace(/\s+type$/, "");
  const article = /^[aeiou]/i.test(family) ? "an" : "a";
  return {
    greeting: `${npc.name} offers no welcome in ${district}; movement, breath, and a ready weapon or unnatural stillness announce ${article} ${family} threat.`,
    service: `There is nothing to request from ${npc.name}. Read the ground and silhouette carefully, because survival in ${district} depends on recognizing its method before it closes.`,
    rumor: `Warnings about ${npc.name} reach the roads before clear sightings do: wrong lanterns, broken markers, disturbed graves, or silence spreading through ${district}.`,
    questOffer: `${npc.name} is the danger behind a local task in ${district}: investigate its signs, protect those in its path, and decide whether capture, cleansing, retreat, or force is justified.`,
    farewell: `${npc.name} does not exchange farewells. The encounter ends only when the threat withdraws, surrenders, is dispersed, or lies still in ${district}.`,
  };
}

function humanoidDialogue(npc) {
  // Combining identity, occupation, district, and deterministic structure is
  // the main defense against both lore leakage and copy-pasted chatter.
  const name = npc.name;
  const district = npc.district || "Harthmere";
  const detail = publicDetail(npc);
  const work = ROLE_WORK[npc.role] || ROLE_WORK.service;
  const task = ROLE_TASK[npc.role] || ROLE_TASK.service;
  const lore =
    DISTRICT_LORE[district] ||
    `tight supplies, old obligations, guarded roads, and the uneasy boundary between Harthmere and the wider Biomes`;
  const input = { name, district, detail, work, task, lore };
  return {
    greeting: pick(OPENERS, `${npc.id}:greeting`)(input),
    service: pick(SERVICE_TEMPLATES, `${npc.id}:service`)(input),
    rumor: pick(RUMOR_TEMPLATES, `${npc.id}:rumor`)(input),
    questOffer: pick(TASK_TEMPLATES, `${npc.id}:questOffer`)(input),
    farewell: pick(FAREWELLS, `${npc.id}:farewell`)(input),
  };
}

function rewriteNpc(npc) {
  return {
    ...npc,
    dialogue:
      npc.kind === "humanoid" || npc.kind === "historical_memory"
        ? humanoidDialogue(npc)
        : creatureDialogue(npc),
  };
}

function parseArray(text, name) {
  const match = text.match(
    new RegExp(`export const ${name} = (\\[[\\s\\S]*?\\]) as const;`)
  );
  if (!match) throw new Error(`Could not parse ${name}`);
  return JSON.parse(match[1]);
}

function replaceArray(text, name, value) {
  const pattern = new RegExp(
    `(export const ${name} = )\\[[\\s\\S]*?\\]( as const;)`
  );
  return text.replace(pattern, `$1${JSON.stringify(value, null, 2)}$2`);
}

function validate(npcs) {
  // Validate before writing so a duplicate, short line, or implementation term
  // leaves the current compendium untouched.
  const seen = new Map();
  for (const npc of npcs) {
    for (const field of FIELDS) {
      const line = npc.dialogue[field];
      const min =
        npc.kind === "humanoid" || npc.kind === "historical_memory" ? 70 : 90;
      if (typeof line !== "string" || line.length < min) {
        throw new Error(`${npc.id}.${field} is shorter than ${min} characters`);
      }
      const normalized = line.toLocaleLowerCase().replace(/\s+/g, " ").trim();
      const prior = seen.get(normalized);
      if (prior) throw new Error(`${npc.id}.${field} duplicates ${prior}`);
      seen.set(normalized, `${npc.id}.${field}`);
      if (
        /\b(test|testing|placeholder|debug|todo|local-dev|spawn|renderer)\b/i.test(
          line
        )
      ) {
        throw new Error(`${npc.id}.${field} contains implementation language`);
      }
    }
  }
}

const before = fs.readFileSync(FILE, "utf8");
const named = parseArray(before, "HARTHMERE_NAMED_NPCS").map(rewriteNpc);
const remaining = parseArray(before, "HARTHMERE_REMAINING_NPCS").map(
  rewriteNpc
);
validate([...named, ...remaining]);

// Keep literal exported arrays because existing audits parse them directly.
// The rewrite changes dialogue values, not compendium structure or NPC data.
let after = replaceArray(before, "HARTHMERE_NAMED_NPCS", named);
after = replaceArray(after, "HARTHMERE_REMAINING_NPCS", remaining);

if (process.argv.includes("--check")) {
  if (after !== before) {
    console.error(
      "Harthmere compendium dialogue is not synchronized with the lore rewrite."
    );
    process.exit(1);
  }
  console.log(
    `PASS: ${
      [...named, ...remaining].length * FIELDS.length
    } dialogue lines are synchronized and unique.`
  );
} else {
  fs.writeFileSync(FILE, after, "utf8");
  console.log(
    `Rewrote ${
      [...named, ...remaining].length * FIELDS.length
    } unique Harthmere dialogue lines.`
  );
}
