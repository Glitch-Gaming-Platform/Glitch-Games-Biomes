// CHAPTER_1_AUTHORED_DIALOGUE  (SERVER ONLY)
//
// Story conversations for the native Chapter 1 objective prompt. Keeping the
// complete catalog server-side preserves the chapter's spoiler discipline:
// the client receives only the active objective's pages.
//
// Presentation rule: one message screen contains at most two short sentences.
// Long speeches are deliberately split into many pages so Lou, Jackie, Sorrel,
// Hallr, and the testimony witnesses never become an unreadable text wall.

import type {
  Ch1DialoguePage,
  Ch1DialogueSequence,
} from "@/shared/harthmere/ch1_dialogue_types";
import type { HarthmereCinematicExpression } from "@/shared/cutscene/cinematic_expressions";
import { CH1_TESTIMONIES } from "@/shared/harthmere/ch1_cast";
import type { Ch1LiveGateRuntimeState } from "@/shared/harthmere/ch1_live_gate";
import {
  ch1ObjectiveTarget,
  type Ch1ObjectiveTargetContext,
} from "@/shared/harthmere/ch1_objective_targets";
import {
  CH1_TESTIMONY_ROUTE,
  CH1_THREE_ANSWER_ROUTE,
  ch1NextRouteStop,
} from "@/shared/harthmere/ch1_objective_routes";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";

type CompletionDialogueByChoice = Readonly<Record<string, Ch1DialogueSequence>>;

const sequence = (
  title: string,
  pages: Ch1DialoguePage[],
  completionLabel?: string
): Ch1DialogueSequence => ({ title, pages, completionLabel });

const CH1_OBJECTIVE_DIALOGUE_BASE: Readonly<
  Record<string, Ch1DialogueSequence>
> = Object.freeze({
  wake_up: sequence("The Morning After", [
    {
      speaker: "Jackie",
      text: "Morning. Sit up slowly, because the floor has not moved and you might disagree.",
    },
    {
      speaker: "Jackie",
      text: "Tea is on the table. Food first, questions after your hands stop shaking.",
    },
  ]),
  the_tea: sequence("Breakfast", [
    {
      speaker: "Billy",
      text: "Jackie said you needed bread. I brought the good end piece and did not eat it on the road.",
    },
    {
      speaker: "Jackie",
      text: "Drink while it is warm. Then check your kit and tell me what is missing.",
    },
  ]),
  kit_check: sequence("Kit Check", [
    {
      speaker: "Jackie",
      text: "Food, water, one clean bandage, and a tool you trust. The road does not care how brave you feel.",
    },
    {
      speaker: "Jackie",
      text: "What do you want today? Do not tell me what you remember.",
    },
  ]),
  choose_a_name: sequence("A Name for the Board", [
    {
      speaker: "Taye",
      text: "Nobody finds their name. Everybody gets given one and spends a while growing into it.",
    },
    {
      speaker: "Taye",
      text: "You are just doing it faster than most. Tell me what to paint.",
    },
  ]),
  see_it_painted: sequence("The New Board", [
    {
      speaker: "Taye",
      text: "There. The letters belong to the board now.",
    },
    {
      speaker: "Taye",
      text: "Whether the name belongs to you is slower work. You have time for that.",
    },
  ]),
  seat_the_core: sequence("Stand Him Up", [
    {
      speaker: "Luis",
      text: "Seat the cell gently. A cracked housing turns clean power into an expensive funeral.",
    },
    {
      speaker: "Luis",
      text: "Every old log costs this robot charge. Memory is coming out of whatever life it has left.",
    },
  ]),
  first_log: sequence("The First Log", [
    {
      speaker: "AUGUR-9",
      text: "Custodian recognized. Playback authorization restored.",
    },
    {
      speaker: "A recording",
      text: "The reading is outside tolerance. Run it again.",
    },
    {
      speaker: "AUGUR-9",
      text: "Voice match: custodian. Remaining context unavailable.",
    },
  ]),
  sort_the_finds: sequence("What the Water Gives", [
    {
      speaker: "Dimmi",
      text: "The cove returned a lens, a button, and a road marker from somewhere else. Water has excellent timing and terrible manners.",
    },
    {
      speaker: "Dimmi",
      text: "Your grey card warms beside the wrong objects. That makes it an instrument, not jewellery.",
    },
  ]),
  not_this_small: sequence("The Fence Line", [
    {
      speaker: "Jackie",
      text: "You looked at that seam like you knew what it was. You have seen one before.",
    },
    {
      speaker: "You",
      text: "The answer is already in your mouth. You do not know where it came from.",
    },
  ]),
  sit_for_doc: sequence("The Ledger Opens", [
    {
      speaker: "Doc",
      text: "The Muckwad sample carries matter that does not fit any present isotope table. That makes the Muck a symptom, not a spill.",
    },
    {
      speaker: "Doc",
      text: "You can make new memories. Old ones come back rebuilt, and the brain fills gaps with confident guesses.",
    },
    {
      speaker: "Doc",
      text: "Do not marry the first version of anything. Reconstructed memory can sound certain while being wrong.",
    },
    {
      speaker: "Doc",
      text: "One more thing. Some sequestrants defend themselves by turning a direct explanation into panic and distrust.",
    },
  ]),
  open_the_tab: sequence("Recovered", [
    {
      speaker: "Doc",
      text: "Write down what returns before you improve it. Brains edit faster than pens.",
    },
    {
      speaker: "Doc",
      text: "The ledger is evidence, not scripture. Treat it like a witness who hit their head.",
    },
  ]),
  collect_testimonies: sequence("The Night You Came", [
    {
      speaker: "Alva",
      text: "She did not stop to rest. Not once.",
    },
    {
      speaker: "Alva",
      text: "People who are helping stop to rest. That is what frightened me.",
    },
    {
      speaker: "Helsa",
      text: "She asked me to put the lamps out, not down. She wanted the road dark.",
    },
    {
      speaker: "Grover",
      text: "You had one shoe. Nobody loses exactly one shoe on purpose.",
    },
    {
      speaker: "Coretta",
      text: "She waited nine days before writing you into the ledger. I write everything the same day.",
    },
    {
      speaker: "Emily",
      text: "She kept checking the road behind her. Every few steps, all the way up.",
    },
    {
      speaker: "Patsy",
      text: "She asked for a blank tag. She was very precise about the word blank.",
    },
    {
      speaker: "Richard",
      text: "She asked what I had that could not be traced. I thought she meant boots.",
    },
    {
      speaker: "Runna",
      text: "She carried a whole adult uphill and I could not have kept up. She had trained for that kind of weight.",
    },
    {
      speaker: "Drona",
      text: "The moss rose from her footprints within an hour. That is a trained walk with no trail left behind.",
    },
    {
      speaker: "Gizela",
      text: "The tide returned a hospital bracelet three days later. It had no name on it.",
    },
    {
      speaker: "Davi",
      text: "She borrowed a cart and returned it cleaner than she found it. People hiding panic become very tidy.",
    },
    {
      speaker: "Allix",
      text: "From above, I saw her take the long way. She chose the road with no windows.",
    },
  ]),
  go_to_greenlamp: sequence("Greenlamp Clinic", [
    {
      speaker: "Doctor Hana Greenlamp",
      text: "I did not ask the Collective to send a specialist. I did ask for help with the memory cases.",
    },
    {
      speaker: "Doctor Hana Greenlamp",
      text: "Those are not the same decision. I am trying to remember that while he uses my clean room.",
    },
  ]),
  kit_delivers: sequence("A Packet for No One", [
    {
      speaker: "Kit the Courier",
      text: "No name, no seal, and paid in old coin. That usually means romance or treason.",
    },
    {
      speaker: "Kit the Courier",
      text: "Jackie took it without smiling. I am ruling out romance.",
    },
  ]),
  say_the_sentence: sequence("The Obvious Sentence", [
    {
      speaker: "Halden Rook",
      text: "Two years I have watched these open on your side of the river. Not one has opened on mine.",
    },
    {
      speaker: "Halden Rook",
      text: "Say the obvious sentence. I will wait.",
    },
  ]),
  the_three_answers: sequence("A Button in the Sand", [
    {
      speaker: "Ranger Jane",
      text: "Rope it off and watch it. The Muck gathers around damage like a body closing a wound.",
    },
    {
      speaker: "Arbiter Cressa Vane",
      text: "Study it before fear destroys the evidence. Jurisdiction can be argued after the child is found.",
    },
    {
      speaker: "Halden Rook",
      text: "Collapse it before it learns the shape of your town. I do not pretend to know how.",
    },
    {
      speaker: "Jackie",
      text: "You are not going near it. Since nobody plans to listen, give me your pack.",
    },
  ]),
  lous_gift: sequence("The Case Notes", [
    {
      speaker: "Dr. Lucien Ardan",
      text: "You will want to know whether the man treating you is the man who put you here. Read my notes before you decide.",
    },
    {
      speaker: "Case Notes, page 1",
      text: "The patient arrived disoriented, smoke-exposed, and unable to state a name. No external injury explained the memory loss.",
    },
    {
      speaker: "Case Notes, page 2",
      text: "Hydration and observation were ordered. The patient remained physically stable through the first night.",
    },
    {
      speaker: "Case Notes, page 3",
      text: "New memories formed normally. Earlier autobiographical recall remained inaccessible.",
    },
    {
      speaker: "Case Notes, page 4",
      text: "Direct questioning increased distress without improving recall. A slower recovery plan was recommended.",
    },
    {
      speaker: "Case Notes, page 5",
      text: "No family contact was listed in the intake record. The attending requested a protected placement.",
    },
    {
      speaker: "Case Notes, page 6",
      text: "The record begins after intake. Fourteen earlier hours are not included.",
    },
    {
      speaker: "Dr. Lucien Ardan",
      text: "It is not flattering to me. I will be here when you return either way.",
    },
  ]),
  the_pack_check: sequence("The Pack Check", [
    {
      speaker: "Jackie",
      text: "Water low in the bag and light where your hand can find it. Keep the repair kit dry.",
    },
    {
      speaker: "Jackie",
      text: "No shops, no safe room, and no clever second trip. What you carry is what you have.",
    },
  ]),
  d1_find_iris: sequence("The Girl in the Granary", [
    {
      speaker: "Iris Fen",
      text: "You took longer than the cold woman. She comes sometimes, but she never stays.",
    },
    {
      speaker: "Iris Fen",
      text: "She is cold to stand next to. She still brings food and checks the door.",
    },
    {
      speaker: "Iris Fen",
      text: "The dog is Marrow. He followed the water and then decided I was in charge.",
    },
  ]),
  hear_it: sequence("The Stones Are Flat", [
    {
      speaker: "Sil",
      text: "The ground has held the same low note for a year. Today you heard the note underneath it.",
    },
    {
      speaker: "Sil",
      text: "Tell me why the stones are flat. Please do not make it sound easy.",
    },
  ]),
  tell_sil_why: sequence("An Answer Without Words", [
    {
      speaker: "You",
      text: "The answer arrives complete. The explanation does not arrive with it.",
    },
    {
      speaker: "Sil",
      text: "Then hum it once. I can work with honest uncertainty.",
    },
  ]),
  walk_in: sequence("Ashline Containment Works", [
    {
      speaker: "Luis",
      text: "They asked me to repair that Collective drone before the workers' alarm. I told them machines can wait outside like everyone else.",
    },
    {
      speaker: "Foreman Calla Ashe",
      text: "The core is running away and my procedure has forty seconds. If you know something, move now.",
    },
  ]),
  how_did_you_do_that: sequence("Thirty-One Seconds", [
    {
      speaker: "Foreman Calla Ashe",
      text: "That sequence exists in no Ashline manual. How did you do it?",
    },
    {
      speaker: "Wen Halloway",
      text: "I know that procedure from sealed refinery notices. Jackie used to hate the person who wrote it.",
    },
  ]),
  call_the_collapse: sequence("What the Devils Know", [
    {
      speaker: "Halden Rook",
      text: "I have watched Mouths for two years and never named the second correctly. You did it without a clock.",
    },
    {
      speaker: "Halden Rook",
      text: "Cleverness without memory is still cleverness. That is more frightening, not less.",
    },
  ]),
  notice: sequence("The Tea", [
    {
      speaker: "Your hands",
      text: "Powder from a paper fold. Half a measure, stirred before the cup reaches you.",
    },
    {
      speaker: "Jackie",
      text: "Drink before it cools. You always hate it cold.",
    },
  ]),
  search_the_stores: sequence("Jackie's Tin", [
    {
      speaker: "You",
      text: "Twenty-two empty vials sit beneath the tea. The dates run back almost eleven months.",
    },
    {
      speaker: "AUGUR-9",
      text: "Administration interval detected. Approximate cadence: one dose per fourteen days.",
    },
  ]),
  have_it_analysed: sequence("Doc's Analysis", [
    {
      speaker: "Doc",
      text: "It is neuroactive and unregistered. It is not in any dispensary book I own.",
    },
    {
      speaker: "Doc",
      text: "Whoever makes this is making it quietly. How long has she been giving it to you?",
    },
  ]),
  show_him: sequence("The Man Who Did Not Accuse", [
    {
      speaker: "Dr. Lucien Ardan",
      text: "I do not know what this is. I would run it properly before saying anything about anyone.",
    },
    {
      speaker: "Dr. Lucien Ardan",
      text: "Compounds like this are not made in kitchens. They require access and a reason to keep someone quiet.",
    },
  ]),
  interrogate: sequence("Teak", [
    {
      speaker: "Teague Morrow",
      text: "I am not telling you what is in the bottle. I do not know, and a wrong guess would become your truth.",
    },
    {
      speaker: "Teague Morrow",
      text: "Yes, Jackie works with us. No, that does not mean what you want it to mean.",
    },
    {
      speaker: "Teague Morrow",
      text: "Ask her, then listen to the part she cannot say. That is all you get from me.",
    },
  ]),
  report_or_not: sequence("Your Statement", [
    {
      speaker: "Sergeant Bram Holt",
      text: "Teak's materials already give me cause to bring Jackie in. Your statement decides whether your accusation joins the file.",
    },
    {
      speaker: "Sergeant Bram Holt",
      text: "You may report her, refuse the tea, or do both. She leaves the road-house tonight either way.",
    },
  ]),
  check_corettas_ledger: sequence("The Dates", [
    {
      speaker: "Coretta",
      text: "Your first recorded fragment follows the fourth dose by one night. Every later cluster follows the same pattern.",
    },
    {
      speaker: "Coretta",
      text: "I keep records so panic has something solid to trip over. These dates are solid.",
    },
  ]),
  ask_auggie: sequence("A Custodian's Record", [
    {
      speaker: "AUGUR-9",
      text: "Fragment events correlate with administration intervals. Correlation direction remains unclassified.",
    },
    {
      speaker: "AUGUR-9",
      text: "Doc said neuroactive. Doc did not say which direction.",
    },
  ]),
  resume_dosing: sequence("The Remaining Vials", [
    {
      speaker: "You",
      text: "The first vial tastes like bitter metal beneath the tea. Nothing happens immediately.",
    },
    {
      speaker: "The Ledger",
      text: "An empty row appears. The silence has ended.",
    },
  ]),
  unlock_linking: sequence("Linking", [
    {
      speaker: "The Ledger",
      text: "Dates and confidence values become visible. Several trusted memories are less certain than they felt.",
    },
    {
      speaker: "The Ledger",
      text: "Fragments may now be linked into a timeline. A correct link can produce a new deduction.",
    },
  ]),
  read_the_letter: sequence("N. Sorrel's Letter", [
    {
      speaker: "The letter",
      text: "Whoever finds this, I have walked since the Ashfall test. I count one hundred and nineteen days.",
    },
    {
      speaker: "The letter",
      text: "I found four doorways and all four put me somewhere worse. There is a child at the desert one.",
    },
    {
      speaker: "The letter",
      text: "I keep her fed, but I cannot take her with me. Do not judge me.",
    },
    {
      speaker: "The letter",
      text: "I will stop moving at the cold doorway because I am tired. Bring rope, fire, and more food than you think.",
    },
    {
      speaker: "The letter",
      text: "If you are Collective, I will burn the original ledger before surrendering it. Signed: N Sorrel, Custodian 3.",
    },
  ]),
  rooks_rope: sequence("The Winter Gate", [
    {
      speaker: "Ranger Jane",
      text: "Fuel is your clock in there. Rope is the difference between a bad step and a body under ice.",
    },
    {
      speaker: "Halden Rook",
      text: "This rope was made without Exotic Matter. It will remain rope when your instruments forget what they are.",
    },
    {
      speaker: "Halden Rook",
      text: "I will hold the near side. Do not mistake that for permission.",
    },
  ]),
  d2_the_oath: sequence("The Condition", [
    {
      speaker: "Dr. Nadia Sorrel",
      text: "This ledger does not go to the Collective. Not for treatment, leverage, or a kinder version of the same burial.",
    },
    {
      speaker: "Dr. Nadia Sorrel",
      text: "Say it yourself. I need to hear you choose the sentence.",
    },
  ]),
  d2_hallrs_choice: sequence("The Ninth Winter", [
    {
      speaker: "Jarl Hallr Ironmouth",
      text: "Half my hall was dying when the year stopped. The wound is the only reason they still draw breath.",
    },
    {
      speaker: "Jarl Hallr Ironmouth",
      text: "You are offering to let my people die on schedule. Hear that sentence before you advise me.",
    },
  ]),
  come_out: sequence("Two Days", [
    {
      speaker: "Halden Rook",
      text: "One of yours, from before. I can tell by the coat.",
    },
    {
      speaker: "Halden Rook",
      text: "Being proved right feels worse than expected. I had hoped for the smaller kind of right.",
    },
  ]),
  hear_vane: sequence("Vane's Arithmetic", [
    {
      speaker: "Arbiter Cressa Vane",
      text: "A sudden shutdown strands four hundred million homes. Hospitals and food systems fail before evacuation begins.",
    },
    {
      speaker: "Arbiter Cressa Vane",
      text: "We can proceed without you. It will be slower, uglier, and deadlier.",
    },
    {
      speaker: "Arbiter Cressa Vane",
      text: "You are not the only lever. You are the kind one.",
    },
  ]),
  give_the_ledger: sequence("The Handover", [
    {
      speaker: "Dr. Lucien Ardan",
      text: "Give it to me, and I can argue for an orderly withdrawal. Ten years, perhaps fifteen.",
    },
    {
      speaker: "Dr. Lucien Ardan",
      text: "You have been right for eleven years. I am asking you to be useful for one afternoon.",
    },
  ]),
  give_her_location: sequence("Sorrel's Location", [
    {
      speaker: "Dr. Lucien Ardan",
      text: "She has survived four months without proper care. Tell me where she is, and I will send a medical team.",
    },
    {
      speaker: "Dr. Lucien Ardan",
      text: "You may distrust the institution. Do not make her body pay for that distrust.",
    },
  ]),
  did_he_take_it: sequence("The Watch House", [
    {
      speaker: "Jackie",
      text: "Did he take it? Tell me before you explain anything else.",
    },
  ]),
  the_final_choice: sequence("What Happens Next", [
    {
      speaker: "Jackie",
      text: "They have a two-day head start. I know where that transport goes.",
    },
    {
      speaker: "Jackie",
      text: "The Grove deserves a choice too. Decide what truth you are willing to make them carry.",
    },
  ]),
});

type DialogueExpressionPlan = Readonly<
  Record<string, readonly (HarthmereCinematicExpression | undefined)[]>
>;

function applySequenceExpressions(
  scope: string,
  dialogue: Ch1DialogueSequence,
  expressions: readonly (HarthmereCinematicExpression | undefined)[]
): Ch1DialogueSequence {
  if (dialogue.pages.length !== expressions.length) {
    throw new Error(
      `${scope}: ${dialogue.pages.length} dialogue pages but ${expressions.length} expression entries`
    );
  }
  return {
    ...dialogue,
    pages: dialogue.pages.map((page, index) =>
      expressions[index] ? { ...page, expression: expressions[index] } : page
    ),
  };
}

function applyDialogueExpressionPlan(
  scope: string,
  dialogue: Readonly<Record<string, Ch1DialogueSequence>>,
  plan: DialogueExpressionPlan
): Readonly<Record<string, Ch1DialogueSequence>> {
  const missing = Object.keys(dialogue).filter((key) => !(key in plan));
  const unknown = Object.keys(plan).filter((key) => !(key in dialogue));
  if (missing.length || unknown.length) {
    throw new Error(
      `${scope}: expression plan mismatch; missing=${missing.join(
        ","
      )}; unknown=${unknown.join(",")}`
    );
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(dialogue).map(([key, sequence]) => [
        key,
        applySequenceExpressions(`${scope}/${key}`, sequence, plan[key]),
      ])
    )
  );
}

const CH1_OBJECTIVE_DIALOGUE_EXPRESSION_PLAN = Object.freeze({
  wake_up: ["relief", "determined"],
  the_tea: ["thumbsUp", "determined"],
  kit_check: ["checkingEquipment", "curiosity"],
  choose_a_name: ["thinking", "curiosity"],
  see_it_painted: ["thumbsUp", "relief"],
  seat_the_core: ["checkingEquipment", "sadness"],
  // AUGUR-9 and its recording are not human performers.
  first_log: [undefined, undefined, undefined],
  sort_the_finds: ["curiosity", "thinking"],
  not_this_small: ["uncertainty", undefined],
  sit_for_doc: ["curiosity", "thinking", "stop", "determined"],
  open_the_tab: ["determined", "uncertainty"],
  collect_testimonies: [
    "sadness",
    "fear",
    "nervousness",
    "confusion",
    "annoyance",
    "nervousness",
    "nervousness",
    "confusion",
    "surprise",
    "thinking",
    "shock",
    "thinking",
    "uncertainty",
  ],
  go_to_greenlamp: ["determined", "frustration"],
  kit_delivers: ["curiosity", "sighing"],
  say_the_sentence: ["determined", "impatience"],
  the_three_answers: ["stop", "determined", "determined", "stop"],
  lous_gift: [
    "uncertainty",
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    "apology",
  ],
  the_pack_check: ["checkingEquipment", "determined"],
  d1_find_iris: ["curiosity", "confusion", "relief"],
  hear_it: ["surprise", "uncertainty"],
  tell_sil_why: [undefined, "relief"],
  walk_in: ["annoyance", "ready"],
  how_did_you_do_that: ["shock", "uncertainty"],
  call_the_collapse: ["surprise", "uncertainty"],
  notice: [undefined, "nervousness"],
  // The player observation and AUGUR-9 are both non-human performers.
  search_the_stores: [undefined, undefined],
  have_it_analysed: ["thinking", "curiosity"],
  show_him: ["thinking", "determined"],
  interrogate: ["determined", "frustration", "stop"],
  report_or_not: ["thinking", "determined"],
  check_corettas_ledger: ["thinking", "determined"],
  // AUGUR-9 does not use human facial/body expressions.
  ask_auggie: [undefined, undefined],
  resume_dosing: [undefined, undefined],
  unlock_linking: [undefined, undefined],
  read_the_letter: [undefined, undefined, undefined, undefined, undefined],
  rooks_rope: ["checkingEquipment", "determined", "guard"],
  d2_the_oath: ["guard", "uncertainty"],
  d2_hallrs_choice: ["sadness", "determined"],
  come_out: ["curiosity", "sadness"],
  hear_vane: ["sighing", "determined", "determined"],
  give_the_ledger: ["thinking", "determined"],
  give_her_location: ["sadness", "stop"],
  did_he_take_it: ["nervousness"],
  the_final_choice: ["ready", "determined"],
} satisfies DialogueExpressionPlan);

const CH1_TESTIMONY_EXPRESSION_BY_SPEAKER: Readonly<
  Record<string, HarthmereCinematicExpression>
> = Object.freeze({
  Alva: "fear",
  Helsa: "nervousness",
  Grover: "confusion",
  Coretta: "annoyance",
  Emily: "nervousness",
  Patsy: "nervousness",
  Richard: "confusion",
  Runna: "surprise",
  Drona: "thinking",
  Gizela: "shock",
  Davi: "thinking",
  Allix: "uncertainty",
});

export const CH1_OBJECTIVE_DIALOGUE = applyDialogueExpressionPlan(
  "objective",
  CH1_OBJECTIVE_DIALOGUE_BASE,
  CH1_OBJECTIVE_DIALOGUE_EXPRESSION_PLAN
);

// CHAPTER_1_COMPLETION_DIALOGUE
//
// Every accepted choice gets an answer. This used to cover three steps out of
// twenty-one, so the player committed to a line and the world said nothing
// back — including at the beats the writer's journal names as the point of the
// scene ("Four options. All four are 'I don't know'... That's the scene.").
// ch1_choice_completion_dialogue.test.ts is the gate: adding a choice option
// without an answer now fails the suite.
//
// TWO DELIBERATE EXCLUSIONS, asserted by that test so they cannot rot into
// accidental gaps:
//   * `confront` and `watch_him_go` are answered by a linear cutscene
//     (ch1-confrontation, ch1-too-late). Both are authored so that every option
//     means the same thing; a per-choice reply would contradict the design and
//     double up on the cutscene that already carries the line.
//   * `give_the_ledger`/`not_yet` is REFUSED by `acceptedChoice`, so it never
//     reaches completion. Its player-facing text is the refusal message.
const CH1_COMPLETION_DIALOGUE_BASE: Readonly<
  Record<string, CompletionDialogueByChoice>
> = Object.freeze({
  choose_a_name: {
    keep_name: sequence("A Name for the Board", [
      {
        speaker: "Taye",
        text: "Nobody finds their name; everybody gets given one and spends a while growing into it. You're just doing it faster than most.",
      },
    ]),
  },
  not_this_small: {
    not_this_small: sequence("Not This Small", [
      {
        speaker: "You",
        text: "Not this small.",
      },
      {
        speaker: "Jackie",
        text: "…Right. We're going back inside, and you won't say that where anyone else can hear you.",
      },
    ]),
  },
  say_the_sentence: {
    biomes_make_gates: sequence("Say the Obvious Sentence", [
      {
        speaker: "Halden Rook",
        text: "Two years. Two years I have watched these open on your side of the river and never once on mine, and not one of you would say it out loud.",
      },
      {
        speaker: "Halden Rook",
        text: "Thank you; that is not an accusation. It is the first honest sentence anyone from the Grove has given me.",
      },
    ]),
  },
  d1_salt_market: {
    drop_awnings: sequence("The Salt Market", [
      {
        speaker: "You",
        text: "The rotten awning poles come down across the bazaar lane. The Salt-Cured go down under the canvas, and the route forward opens cheap.",
      },
    ]),
    fight_open: sequence("The Salt Market", [
      {
        speaker: "You",
        text: "You take them in the open. It works, and it costs — the market goes still, and so does most of your water.",
      },
    ]),
  },
  d1_cistern_stair: {
    lit_stair: sequence("The Cistern Stair", [
      {
        speaker: "You",
        text: "Three torches spent, air overhead the whole way down. Slow is the price of arriving.",
      },
    ]),
    no_air_shortcut: sequence("The Cistern Stair", [
      {
        speaker: "You",
        text: "You take the flooded run. There is no pocket halfway, and your lungs learn that before your legs do.",
      },
    ]),
  },
  ch1_a3_d1_hall_of_weights: {
    modern_scale_a: sequence("The Hall of Weights", [
      {
        speaker: "You",
        text: "The instrument reads confidently and reads wrong. The beam refuses the mass.",
      },
      {
        speaker: "Your hands",
        text: "You cannot measure anything against the present. You can only measure things against each other.",
      },
    ]),
    modern_scale_b: sequence("The Hall of Weights", [
      {
        speaker: "You",
        text: "The second instrument disagrees with the first by an amount that is small, consistent, and impossible. The beam refuses again.",
      },
      {
        speaker: "Your hands",
        text: "Stop trusting instruments. Compare the unknown to the standard that is standing right in front of you.",
      },
    ]),
    temple_balance: sequence("The Hall of Weights", [
      {
        speaker: "You",
        text: "You set the unknown against the temple's own reference mass and let the beam settle itself. It levels on the first try.",
      },
      {
        speaker: "Your hands",
        text: "You have done this before. You do not remember learning it.",
      },
    ]),
  },
  d1_sun_court: {
    stealth_bypass: sequence("The Sun Court", [
      {
        speaker: "You",
        text: "You keep the pillars between you and the Bull and reach the vault door unnoticed. Its core stays in its chest, and the lore cache stays sealed behind it.",
      },
    ]),
    break_horns: sequence("The Sun Court", [
      {
        speaker: "You",
        text: "The horns go into stone instead of you. The third phase is a slow, badly balanced thing, and then it is over.",
      },
      {
        speaker: "You",
        text: "The Bull's Core is still warm when you lift it out.",
      },
    ]),
  },
  tell_sil_why: {
    dont_know_heard_it: sequence("Tell Sil Why", [
      {
        speaker: "Sil",
        text: "You heard it. Half a tone, under nine hundred kilos of granite, and you heard it.",
      },
      {
        speaker: "Sil",
        text: "I have tuned these stones for eleven years. Don't apologise for not knowing how.",
      },
    ]),
    hands_know: sequence("Tell Sil Why", [
      {
        speaker: "Sil",
        text: "Then your hands are welcome here any day you like, and the rest of you can catch up whenever it wants to.",
      },
    ]),
    bedrock: sequence("Tell Sil Why", [
      {
        speaker: "Sil",
        text: "The bedrock — it's the bedrock. Nobody has said that to me in eleven years.",
      },
      {
        speaker: "Sil",
        text: "Sorry; give me a moment.",
      },
    ]),
    cannot_explain: sequence("Tell Sil Why", [
      {
        speaker: "Sil",
        text: "You're right, and I can hear it. You handed me eleven years back without knowing where you got it.",
      },
    ]),
  },
  how_did_you_do_that: {
    dont_know: sequence('"How Did You Do That?"', [
      {
        speaker: "Foreman Calla Ashe",
        text: "You don't know.",
      },
      {
        speaker: "Foreman Calla Ashe",
        text: "Fine; I'm still required to write it up. Whoever reads the report will want a better answer, and so will I.",
      },
    ]),
    hands_moved: sequence('"How Did You Do That?"', [
      {
        speaker: "Foreman Calla Ashe",
        text: "Your hands moved.",
      },
      {
        speaker: "Foreman Calla Ashe",
        text: "I've got forty seconds of procedure and a core that needed four minutes. Your answer goes in the incident file exactly as given.",
      },
    ]),
    already_knew: sequence('"How Did You Do That?"', [
      {
        speaker: "Foreman Calla Ashe",
        text: "It felt like you already knew.",
      },
      {
        speaker: "Foreman Calla Ashe",
        text: "Nobody already knows this; that's why we keep the procedure. I have to file it, and you understand why.",
      },
    ]),
    cannot_teach_it: sequence('"How Did You Do That?"', [
      {
        speaker: "Foreman Calla Ashe",
        text: "You can't teach it.",
      },
      {
        speaker: "Foreman Calla Ashe",
        text: "Then I've got sixty people on this floor whose lives just depended on something that only happens if you're standing here. That's the part I have to write down.",
      },
    ]),
  },
  call_the_collapse: {
    seventeen_seconds: sequence("Call the Collapse", [
      {
        speaker: "Halden Rook",
        text: "…Seventeen. To the second.",
      },
      {
        speaker: "Halden Rook",
        text: "I have been told my whole life that your people are clever devils. It is a great deal more frightening to learn you are simply clever.",
      },
    ]),
  },
  d2_hanged_wood: {
    silent_path: sequence("The Hanged Wood", [
      {
        speaker: "You",
        text: "You move the way the wood asks you to move. Nothing between the trees turns its head, and the pines let you out the far side.",
      },
    ]),
    fight_through: sequence("The Hanged Wood", [
      {
        speaker: "You",
        text: "You force the path. Everything that hunts by sound now knows exactly where you are, and the wood is a long way across.",
      },
    ]),
  },
  d2_the_oath: {
    swear_oath: sequence("The Condition", [
      {
        speaker: "You",
        text: "It does not go to the Collective, ever or under any circumstance.",
      },
      {
        speaker: "Dr. Nadia Sorrel",
        text: "Say it again without looking at the door.",
      },
      {
        speaker: "Dr. Nadia Sorrel",
        text: "…Good. Then it's yours; I carried this for nine years and now trust it to someone who cannot remember why it matters.",
      },
    ]),
  },
  d2_ash_hall: {
    feed_hearth: sequence("The Ash Hall", [
      {
        speaker: "You",
        text: "You burn the carried fuel into the hearth. The hall holds its light, and the Winter has to fight you where you can see it.",
      },
    ]),
    fight_dark: sequence("The Ash Hall", [
      {
        speaker: "You",
        text: "The hearth goes out. The ninth winter closes over the hall, and every exchange from here costs more than it should.",
      },
    ]),
  },
  give_the_ledger: {
    give: sequence("The Handover", [
      {
        speaker: "You",
        text: "You put Nadia Sorrel's field ledger into Lucien Ardan's hands. You remember promising it would never go to the Collective.",
      },
      {
        speaker: "Dr. Lucien Ardan",
        text: "Thank you. I know exactly what that cost you, and I am not going to pretend otherwise to make it easier.",
      },
    ]),
  },
  give_her_location: {
    tell: sequence("Tell Him Where She Is", [
      {
        speaker: "You",
        text: "You tell him where Sorrel is and that she needs a doctor before she needs anything else.",
      },
      {
        speaker: "Dr. Lucien Ardan",
        text: "Then she'll have one within the hour. That part I can promise you without qualifying it.",
      },
    ]),
  },
  did_he_take_it: {
    yes: sequence('"Did He Take It?"', [
      {
        speaker: "You",
        text: "Yes. He took it.",
      },
      {
        speaker: "Jackie",
        text: "…",
      },
      {
        speaker: "Jackie",
        text: "Right. Then we work from there; sit down, because there's a lot and we haven't long.",
      },
    ]),
  },
  report_or_not: {
    report: sequence("Statement Given", [
      {
        speaker: "Sergeant Bram Holt",
        text: "Your accusation is in the file. Jackie will be held with Teak's evidence pending review.",
      },
      {
        speaker: "Jackie",
        text: "I would have made the same call with your memories. Go sleep before you turn certainty into another weapon.",
      },
    ]),
    stop_tea: sequence("Statement Withheld", [
      {
        speaker: "Sergeant Bram Holt",
        text: "You withheld an accusation. Teak's materials still require me to hold her.",
      },
      {
        speaker: "Jackie",
        text: "The tea stops tonight. The rest of it will get quiet sooner than you expect.",
      },
    ]),
    both: sequence("Statement Given", [
      {
        speaker: "Sergeant Bram Holt",
        text: "Your accusation is recorded, and the tea stops. Jackie will be held with Teak's evidence.",
      },
      {
        speaker: "Jackie",
        text: "Right. Okay.",
      },
    ]),
  },
  d2_hallrs_choice: {
    let_run: sequence("The Year Runs", [
      {
        speaker: "Jarl Hallr Ironmouth",
        text: "Let the year come. My people have waited long enough to become tomorrow.",
      },
      {
        speaker: "The fjord",
        text: "Snow becomes rain, and nine years arrive in ninety seconds. The aperture closes cleanly.",
      },
    ]),
    hold_stall: sequence("The Stall Holds", [
      {
        speaker: "Jarl Hallr Ironmouth",
        text: "Then we keep this winter. I will not thank you for making the choice survivable.",
      },
      {
        speaker: "The fjord",
        text: "The wound remains open beneath the wood. Far away, the Grove's gates keep humming.",
      },
    ]),
  },
  the_final_choice: {
    confess: sequence(
      "Confess",
      [
        {
          speaker: "You",
          text: "You tell the Grove who you were and what you handed away. The road-house goes silent around the truth.",
        },
        {
          speaker: "Jackie",
          text: "Now they get to choose with us. That is dangerous, but it is not nothing.",
        },
        {
          speaker: "The fence line",
          text: "At dusk, a larger Fracture Gate opens beyond the fence. It does not close.",
        },
      ],
      "End Chapter 1"
    ),
    contain: sequence(
      "Contain",
      [
        {
          speaker: "You",
          text: "You free Jackie quietly and leave the Grove uninformed. The town remains safe and warm behind you.",
        },
        {
          speaker: "Jackie",
          text: "We move before the transport reaches the north line. Lying to them is the cost of the head start.",
        },
        {
          speaker: "The fence line",
          text: "At dusk, a larger Fracture Gate opens beyond the fence. It does not close.",
        },
      ],
      "End Chapter 1"
    ),
    bargain: sequence(
      "Bargain",
      [
        {
          speaker: "Arbiter Cressa Vane",
          text: "The laboratory and credentials are yours. Jackie and Sorrel remain in custody.",
        },
        {
          speaker: "You",
          text: "You take a seat inside the system you meant to expose. Access becomes another kind of confinement.",
        },
        {
          speaker: "The fence line",
          text: "At dusk, a larger Fracture Gate opens beyond the fence. It does not close.",
        },
      ],
      "End Chapter 1"
    ),
  },
});

const CH1_COMPLETION_DIALOGUE_EXPRESSION_PLAN: Readonly<
  Record<
    string,
    Readonly<
      Record<string, readonly (HarthmereCinematicExpression | undefined)[]>
    >
  >
> = Object.freeze({
  choose_a_name: {
    keep_name: ["gratitude"],
  },
  not_this_small: {
    not_this_small: [undefined, "fear"],
  },
  say_the_sentence: {
    biomes_make_gates: ["frustration", "gratitude"],
  },
  d1_salt_market: {
    drop_awnings: [undefined],
    fight_open: [undefined],
  },
  d1_cistern_stair: {
    lit_stair: [undefined],
    no_air_shortcut: [undefined],
  },
  ch1_a3_d1_hall_of_weights: {
    modern_scale_a: [undefined, undefined],
    modern_scale_b: [undefined, undefined],
    temple_balance: [undefined, undefined],
  },
  d1_sun_court: {
    stealth_bypass: [undefined],
    break_horns: [undefined, undefined],
  },
  tell_sil_why: {
    dont_know_heard_it: ["shock", "gratitude"],
    hands_know: ["gratitude"],
    bedrock: ["crying", "embarrassment"],
    cannot_explain: ["crying"],
  },
  how_did_you_do_that: {
    dont_know: ["uncertainty", "determined"],
    hands_moved: ["shock", "determined"],
    already_knew: ["fear", "determined"],
    cannot_teach_it: ["uncertainty", "determined"],
  },
  call_the_collapse: {
    seventeen_seconds: ["shock", "fear"],
  },
  d2_hanged_wood: {
    silent_path: [undefined],
    fight_through: [undefined],
  },
  d2_the_oath: {
    swear_oath: [undefined, "stop", "relief"],
  },
  d2_ash_hall: {
    feed_hearth: [undefined],
    fight_dark: [undefined],
  },
  give_the_ledger: {
    give: [undefined, "gratitude"],
  },
  give_her_location: {
    tell: [undefined, "gratitude"],
  },
  did_he_take_it: {
    yes: [undefined, "sadness", "determined"],
  },
  report_or_not: {
    report: ["determined", "sadness"],
    stop_tea: ["determined", "shame"],
    both: ["determined", "sighing"],
  },
  d2_hallrs_choice: {
    let_run: ["relief", undefined],
    hold_stall: ["defeat", undefined],
  },
  the_final_choice: {
    confess: [undefined, "relief", undefined],
    contain: [undefined, "ready", undefined],
    bargain: ["determined", undefined, undefined],
  },
});

export const CH1_COMPLETION_DIALOGUE: Readonly<
  Record<string, CompletionDialogueByChoice>
> = Object.freeze(
  Object.fromEntries(
    Object.entries(CH1_COMPLETION_DIALOGUE_BASE).map(([stepId, byChoice]) => {
      const choicePlan = CH1_COMPLETION_DIALOGUE_EXPRESSION_PLAN[stepId];
      if (!choicePlan) {
        throw new Error(`${stepId}: missing completion expression plan`);
      }
      const unknown = Object.keys(choicePlan).filter(
        (choice) => !(choice in byChoice)
      );
      const missing = Object.keys(byChoice).filter(
        (choice) => !(choice in choicePlan)
      );
      if (unknown.length || missing.length) {
        throw new Error(
          `${stepId}: completion expression plan mismatch; missing=${missing.join(
            ","
          )}; unknown=${unknown.join(",")}`
        );
      }
      return [
        stepId,
        Object.freeze(
          Object.fromEntries(
            Object.entries(byChoice).map(([choice, dialogue]) => [
              choice,
              applySequenceExpressions(
                `completion/${stepId}/${choice}`,
                dialogue,
                choicePlan[choice]
              ),
            ])
          )
        ),
      ];
    })
  )
);

export function ch1ObjectiveDialogue(
  stepId: string,
  context?: {
    questId?: string;
    runtime?: Ch1LiveGateRuntimeState;
  }
): Ch1DialogueSequence | undefined {
  if (stepId === "collect_testimonies" && context?.runtime) {
    const heard = new Set(context.runtime.testimonies);
    const next = CH1_TESTIMONIES.find((entry) => !heard.has(entry.id));
    if (next) {
      return sequence(`The Night You Came — ${next.npc}`, [
        {
          speaker: next.npc,
          text: next.line,
          expression: CH1_TESTIMONY_EXPRESSION_BY_SPEAKER[next.npc],
        },
      ]);
    }
  }
  if (stepId === "the_three_answers" && context?.runtime) {
    const effectKey = `${
      context.questId ?? "ch1_a3_q01_a_button_in_the_sand"
    }/${stepId}`;
    const next = ch1NextRouteStop(
      CH1_THREE_ANSWER_ROUTE,
      context.runtime.objectiveRouteProgress[effectKey] ?? []
    );
    if (next) {
      const pageByStop: Readonly<Record<string, Ch1DialoguePage>> = {
        ranger_jane: {
          speaker: "Ranger Jane",
          text: "Rope it off and watch it. The Muck gathers around damage like a body closing a wound.",
          expression: "stop",
        },
        cressa_vane: {
          speaker: "Arbiter Cressa Vane",
          text: "Study it before fear destroys the evidence. Jurisdiction can be argued after the child is found.",
          expression: "determined",
        },
        halden_rook: {
          speaker: "Halden Rook",
          text: "Collapse it before it learns the shape of your town. I do not pretend to know how.",
          expression: "determined",
        },
      };
      return sequence("A Button in the Sand", [pageByStop[next.id]]);
    }
  }
  return CH1_OBJECTIVE_DIALOGUE[stepId];
}

export function ch1ObjectiveCompletionDialogue(
  stepId: string,
  choice: string | undefined
): Ch1DialogueSequence | undefined {
  if (!choice) return undefined;
  return CH1_COMPLETION_DIALOGUE[stepId]?.[choice];
}

export function ch1CloneDialogue(
  dialogue: Ch1DialogueSequence | undefined
): Ch1DialogueSequence | undefined {
  return dialogue
    ? {
        ...dialogue,
        pages: dialogue.pages.map((page) => ({ ...page })),
      }
    : undefined;
}

function nextCatalogObjective(questId: string, stepId: string) {
  const objectives = CH1_QUESTS.flatMap((quest) =>
    quest.steps.map((step, stepIndex) => ({ quest, step, stepIndex }))
  );
  const index = objectives.findIndex(
    ({ quest, step }) => quest.id === questId && step.id === stepId
  );
  return index >= 0 ? objectives[index + 1] : undefined;
}

function nextRouteStopAfterCurrent(
  route: typeof CH1_TESTIMONY_ROUTE,
  completed: readonly string[]
) {
  const current = ch1NextRouteStop(route, completed);
  if (!current) return undefined;
  return route[route.findIndex((stop) => stop.id === current.id) + 1];
}

/**
 * Player-facing handoff shown before every Chapter 1 conversation closes.
 * It deliberately names both the next task and its destination; the map then
 * supplies the route. Multi-person objectives point to their next live stop
 * instead of incorrectly skipping to the following catalog step.
 */
export function ch1ObjectiveExitGuidanceForTest(input: {
  questId: string;
  stepId: string;
  context?: Ch1ObjectiveTargetContext;
}): string {
  if (input.stepId === "collect_testimonies") {
    const next = nextRouteStopAfterCurrent(
      CH1_TESTIMONY_ROUTE,
      input.context?.runtime?.testimonies ?? []
    );
    if (next) {
      return `Next task: hear the next account. Go to ${next.label}; your map will mark the way.`;
    }
  }
  if (input.stepId === "the_three_answers") {
    const effectKey = `${input.questId}/${input.stepId}`;
    const next = nextRouteStopAfterCurrent(
      CH1_THREE_ANSWER_ROUTE,
      input.context?.runtime?.objectiveRouteProgress[effectKey] ?? []
    );
    if (next) {
      return `Next task: hear the next answer. Go to ${next.label}; your map will mark the way.`;
    }
  }
  const next = nextCatalogObjective(input.questId, input.stepId);
  if (!next) {
    return "Chapter 1 is complete. Open Quests to choose your next journey.";
  }
  const target = ch1ObjectiveTarget(
    next.quest.id,
    next.stepIndex,
    input.context
  );
  return `Next task: ${next.step.title}. Go to ${
    target?.label ?? next.step.targetLabel ?? next.quest.district
  }; your map will mark the way.`;
}

export function ch1DialogueWithExitGuidanceForTest(
  dialogue: Ch1DialogueSequence | undefined,
  exitGuidance: string,
  choiceFollows = false
): Ch1DialogueSequence | undefined {
  if (!dialogue) return undefined;
  const speaker = dialogue.pages.at(-1)?.speaker ?? "Guide";
  return {
    ...dialogue,
    completionLabel: choiceFollows
      ? "Continue to your choice"
      : (dialogue.completionLabel ?? "Continue to the next task"),
    pages: [
      ...dialogue.pages.map((page) => ({ ...page })),
      {
        speaker,
        text: choiceFollows
          ? `Make your choice here. ${exitGuidance}`
          : exitGuidance,
        expression: dialogue.pages.at(-1)?.expression,
      },
    ],
  };
}

export function ch1DialogueSentenceCount(text: string): number {
  const normalized = text.replace(/\b(?:Dr|Mr|Mrs|Ms)\./g, (match) =>
    match.slice(0, -1)
  );
  return normalized
    .split(/(?<=[.!?])(?:["'”’)]*)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}

export function ch1DialogueWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
