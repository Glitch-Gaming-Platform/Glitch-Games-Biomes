// CHAPTER_1_CAST
//
// The Chapter 1 cast: new NPCs seeded for "Identity", plus the chapter roles
// assigned to existing Grove/Harthmere NPCs, plus the twelve testimonies.
//
// TONE CONTRACT: the Grove is warm, and that is a weapon. Do not write the
// Grove as sinister. Write it as a place worth losing.
//
// See docs/harthmere/CHAPTER_1_IDENTITY_WRITERS_JOURNAL.md §3.

import type { BiomesId } from "@/shared/ids";
import {
  CH1_ANCHORS,
  ch1NpcEntityId,
  type Ch1NpcKey,
  type Ch1Vec3,
} from "@/shared/harthmere/ch1_ids";

export const CH1_CAST_VERSION = 1 as const;

export type Ch1Faction =
  | "collective_medical"
  | "collective_civil"
  | "take_terra"
  | "harthmere_watch"
  | "grove"
  | "unaffiliated";

export interface Ch1CastMember {
  key: Ch1NpcKey;
  entityId: BiomesId;
  displayName: string;
  role: string;
  faction: Ch1Faction;
  /** Where the NPC first stands. Undefined => introduced inside a dungeon. */
  placement?: Ch1Vec3;
  /** Act in which the player can first meet them. */
  introducedAct: number;
  voice: string;
  /** One line that shows the writing target for this character. */
  sampleLine: string;
  /** Writer-facing notes. Never shipped to the client. */
  writerNote: string;
  /** Combat participation. Several of these must never be in an encounter. */
  combatant: boolean;
}

export const CH1_NEW_CAST: readonly Ch1CastMember[] = Object.freeze([
  {
    key: "lou_ardan",
    entityId: ch1NpcEntityId("lou_ardan"),
    displayName: "Dr. Lucien Ardan",
    role: "Curator of Care, Collective Medical Directorate",
    faction: "collective_medical",
    placement: CH1_ANCHORS.greenlamp_clinic,
    introducedAct: 2,
    voice:
      "Unhurried, precise, warm without being soft. Uses the player's name constantly. Never raises his voice — not once, in the entire chapter.",
    sampleLine:
      "You hold your pen like a physicist. Sorry. That's a strange thing to say to a stranger.",
    writerNote:
      "The antagonist, and he must never once FEEL like one before Act 6. Write him as the best doctor the player has ever met. He listens. He remembers what you said last time. He is openly critical of Arbiter Vane in front of the player, which is the cheapest and most effective trust-purchase in the book and costs him nothing, because it is true. Do not let anyone answer his final argument well.",
    combatant: false,
  },
  {
    key: "cressa_vane",
    entityId: ch1NpcEntityId("cressa_vane"),
    displayName: "Arbiter Cressa Vane",
    role: "Collective political liaison",
    faction: "collective_civil",
    placement: CH1_ANCHORS.returnstone_pad_office,
    introducedAct: 3,
    voice:
      "Procedural, exhausted, entirely reasonable. Never threatens. Presents costs.",
    sampleLine:
      "For completeness: we can also do this without you. It's slower and it's uglier and more people die. But I don't want you to believe you're the only lever. You aren't. You're the kind one.",
    writerNote:
      "Exists so the Collective is not a cartoon. She has done the arithmetic and the arithmetic is on her side. Distant cousin of Harthmere's Edrik Vane — a fact both families find embarrassing and useful.",
    combatant: false,
  },
  {
    key: "halden_rook",
    entityId: ch1NpcEntityId("halden_rook"),
    displayName: "Halden Rook",
    role: "Harthmere exile, gate-warden at the Old Bridge",
    faction: "harthmere_watch",
    placement: CH1_ANCHORS.harthmere_bridge_center,
    introducedAct: 2,
    voice:
      "Formal, cold, unexpectedly gentle with children and animals. Believes killing Biome engineers is an act of mercy and says so without heat.",
    sampleLine:
      "Two years I have watched these open on your side of the river and never once on mine. I would like someone from the Grove to say the obvious sentence out loud. Just once. I will wait.",
    writerNote:
      "Chapter 1's entire Harthmere presence. He is right about everything and unbearable about all of it. The player has to accept a true fact from a man who would kill them for their resume. He does not need to be fought and the bridge never opens in this chapter.",
    combatant: false,
  },
  {
    key: "nadia_sorrel",
    entityId: ch1NpcEntityId("nadia_sorrel"),
    displayName: "Dr. Nadia Sorrel",
    role: "The player's research partner. Eleven years gone, four months older.",
    faction: "unaffiliated",
    introducedAct: 5,
    voice:
      "Fast, impatient, mid-argument from the second she opens her mouth. She has been mid-argument for four months.",
    sampleLine:
      "Don't do the face. I know the face. Finish the sentence, you started it eleven years ago and I have been carrying the other half of it across two thousand years, so finish it.",
    writerNote:
      "The human antidote to amnesia and the chapter's cruellest instrument: she remembers the player perfectly and is not gracious about the reverse. DESIGN CONSTRAINT: she must not be alone with the player for more than one scene before the handover, or the twist unravels.",
    combatant: false,
  },
  {
    key: "iris_fen",
    entityId: ch1NpcEntityId("iris_fen"),
    displayName: "Iris Fen",
    role: "A child pulled through from somewhere she should not have been",
    faction: "grove",
    introducedAct: 3,
    voice:
      "Eight years old. Calm, which is the disturbing part. Matter-of-fact about impossible things.",
    sampleLine:
      "She comes sometimes. She doesn't stay. She's cold to stand next to but she's nice about it.",
    writerNote:
      "The emotional proof-of-concept for time displacement, and the first person the player rescues rather than helps. Eleven days in the Bronze Age and fine, because the seed vault reads a child as something to preserve. Becomes a Grove resident afterward.",
    combatant: false,
  },
  {
    key: "teak_morrow",
    entityId: ch1NpcEntityId("teak_morrow"),
    displayName: "Teague \"Teak\" Morrow",
    role: "Take Terra cell runner",
    faction: "take_terra",
    placement: CH1_ANCHORS.rat_crowns_den,
    introducedAct: 4,
    voice: "Cynical, funny, thinks the whole plan is stupid, is right.",
    sampleLine:
      "I'm not telling you what's in the bottle. I'm not telling you because I don't know, and because if I guess wrong you'll believe the guess. Ask her.",
    writerNote:
      "The player's first hard evidence that Jackie belongs to an organisation. Every evasion he makes confirms the wrong thing — he is loyal and scared and will not deny Jackie is TT, because she is.",
    combatant: false,
  },
  {
    key: "augur9",
    entityId: ch1NpcEntityId("augur9"),
    displayName: "AUGUR-9",
    role: "Autonomous research custodian unit. The Mucked Robot.",
    faction: "unaffiliated",
    placement: CH1_ANCHORS.old_grove_road_post,
    introducedAct: 1,
    voice:
      "The player's own recorded voice, degraded and artifacted. Cannot lie; can only be incomplete.",
    sampleLine:
      "Custodian recognized. Resuming log playback. Entry four hundred and — entry four hundred and — entry—",
    writerNote:
      "THE most important retcon in the chapter: the robot repaired in Muck vs. Machine was the player's own lab custodian, assigned to Anchor Integrity, walking a degrading patrol loop for eleven years. It is the chapter's playback device and the counterweight to the reconstructions. Every log costs core charge: choosing what to remember costs Auggie hours of life. That is the quietest tragedy in the chapter and it should be entirely optional whether the player notices.",
    combatant: false,
  },
  {
    key: "wen_halloway",
    entityId: ch1NpcEntityId("wen_halloway"),
    displayName: "Wen Halloway",
    role: "Collective refinery clerk. Jackie's estranged sister.",
    faction: "collective_civil",
    placement: CH1_ANCHORS.ashline_containment_works,
    introducedAct: 4,
    voice: "Tired, careful, loves her sister and disapproves of everything about her.",
    sampleLine:
      "She's not a liar. That's the thing people get wrong about her. She just decides what you get to have, and then she's very honest inside that.",
    writerNote:
      "One scene. Explains the shape of Jackie's guilt without Jackie having to.",
    combatant: false,
  },
  {
    key: "marrow",
    entityId: ch1NpcEntityId("marrow"),
    displayName: "Marrow",
    role: "A Muck-displaced dog that follows Iris back",
    faction: "grove",
    introducedAct: 3,
    voice: "—",
    sampleLine: "—",
    writerNote:
      "Purely for warmth. MUST BE UNKILLABLE. Non-negotiable; flag it in review.",
    combatant: false,
  },
  {
    key: "hallr_ironmouth",
    entityId: ch1NpcEntityId("hallr_ironmouth"),
    displayName: "Jarl Hallr Ironmouth",
    role: "Keeper of a settlement that has had the same winter nine times",
    faction: "unaffiliated",
    introducedAct: 5,
    voice:
      "Slow, formal, monstrously tired. Has kept his people alive through a stopped year by sheer will.",
    sampleLine:
      "You are offering to let my people die on schedule. I want you to hear that sentence the way I hear it before I answer you.",
    writerNote:
      "The only person in the fjord who has worked out that the winter is not weather. His choice at the end of Dungeon 2 must not be scored, and he must not be judged for either answer.",
    combatant: false,
  },
]);

const CAST_BY_KEY = new Map(CH1_NEW_CAST.map((c) => [c.key, c]));

export function ch1CastMember(key: Ch1NpcKey): Ch1CastMember | undefined {
  return CAST_BY_KEY.get(key);
}

export function ch1CastForAct(act: number): readonly Ch1CastMember[] {
  return CH1_NEW_CAST.filter((c) => c.introducedAct === act);
}

/** Characters who must never appear in a combat encounter in Chapter 1. */
export const CH1_NON_COMBATANTS: readonly Ch1NpcKey[] = Object.freeze(
  CH1_NEW_CAST.filter((c) => !c.combatant).map((c) => c.key)
);

// ---------------------------------------------------------------------------
// Chapter roles for existing NPCs
// ---------------------------------------------------------------------------

export interface Ch1ExistingCastRole {
  displayName: string;
  chapterRole: string;
}

export const CH1_EXISTING_CAST: readonly Ch1ExistingCastRole[] = Object.freeze([
  {
    displayName: "Jackie",
    chapterRole:
      "Deuteragonist. Caretaker, liar-by-omission, TT cell lead. The chapter is really about her. She never lies outright — she changes subject, answers a different question, or says 'not today'. She is the only person who ever asks the player what they WANT rather than what they REMEMBER.",
  },
  {
    displayName: "Billy",
    chapterRole:
      "Emotional baseline. Uncomplicated affection. The player's proof the Grove is worth something.",
  },
  {
    displayName: "Doc",
    chapterRole:
      "Honest, limited, out of his depth. Delivers the Act 2 confabulation warning (the chapter's fair-play contract) and the Act 4 lab result that is technically correct and catastrophically misleading.",
  },
  {
    displayName: "Ranger Jane",
    chapterRole:
      "Reads the land. First to say out loud that the Muck behaves like a response, not a spill. Runs the Dungeon 2 provisioning check.",
  },
  {
    displayName: "Luis",
    chapterRole:
      "Repairs AUGUR-9 with the player in Act 1 and states the core-charge cost out loud once. Later refuses to repair a Collective drone.",
  },
  {
    displayName: "Taye",
    chapterRole:
      "Sign painter. Runs the Naming Scene. Quietly the chapter's thesis: names are given, not found.",
  },
  {
    displayName: "Dimmi",
    chapterRole:
      "Shutter Cove. Collects reflections and anomalies. First to notice the Card is instrumentation rather than jewellery.",
  },
  {
    displayName: "Sil",
    chapterRole:
      "Mosslawn song stones. Provides the sound trigger class, and the Act 4 anchor-read unlock.",
  },
  {
    displayName: "Kit the Courier",
    chapterRole:
      "Carries the Act 2 packet and the Act 5 letter. Nearly dies for the second one.",
  },
  {
    displayName: "Doctor Hana Greenlamp",
    chapterRole:
      "Hosts Lou as a visiting specialist. Reluctant, then complicit, then horrified.",
  },
  {
    displayName: "Foreman Calla Ashe",
    chapterRole:
      "Present for the Ashline containment sequence. Files the incident report that confirms the player's identity to the Collective — which Lou did not do, and which makes Lou worse rather than better.",
  },
  {
    displayName: "Mucked Robot",
    chapterRole: "Is AUGUR-9. Promoted from quest prop to persistent NPC.",
  },
]);

// ---------------------------------------------------------------------------
// The twelve testimonies
//
// THE HARDEST WRITING TASK IN THE CHAPTER. Each of these must support two
// readings without either requiring a stretch:
//   Act 2 reading: Jackie saved me.
//   Act 4 reading: Jackie took me.
// Both readings use the same twelve sentences. Nothing is added, ever.
// ---------------------------------------------------------------------------

export interface Ch1Testimony {
  id: string;
  npc: string;
  location: string;
  line: string;
}

export const CH1_TESTIMONIES: readonly Ch1Testimony[] = Object.freeze([
  {
    id: "testimony_alva",
    npc: "Alva",
    location: "Old Grove Road bench",
    line: "She didn't stop to rest. Not once. People who are helping stop to rest.",
  },
  {
    id: "testimony_helsa",
    npc: "Helsa",
    location: "Grove night lamps",
    line: "She asked me to put the lamps out. Not down. Out.",
  },
  {
    id: "testimony_grover",
    npc: "Grover",
    location: "Lower Grove path",
    line: "You had a shoe on one foot. Only one. Nobody loses one shoe.",
  },
  {
    id: "testimony_coretta",
    npc: "Coretta",
    location: "Grove garden quarter",
    line: "She didn't write you in for nine days. Coretta writes everything in the same day. That's the whole point of Coretta.",
  },
  {
    id: "testimony_emily",
    npc: "Emily",
    location: "Lovely Locks photo corner",
    line: "She kept checking the road behind her. All the way up. Every few steps.",
  },
  {
    id: "testimony_patsy",
    npc: "Patsy",
    location: "Genesis Crossroads notice board",
    line: "She asked me for a blank tag. Not a name tag. A blank one.",
  },
  {
    id: "testimony_richard",
    npc: "Richard",
    location: "Genesis Crossroads quartermaster",
    line: "She asked what I had that couldn't be traced. I thought she meant boots.",
  },
  {
    id: "testimony_runna",
    npc: "Runna",
    location: "Old Grove Road sprint stretch",
    line: "She was fast. Carrying a whole adult, uphill, and I couldn't have kept up.",
  },
  {
    id: "testimony_drona",
    npc: "Drona",
    location: "Mosslawn",
    line: "The moss came back from her prints in about an hour. That's a trained walk. That's someone who's been taught not to leave a trail.",
  },
  {
    id: "testimony_gizela",
    npc: "Gizela",
    location: "Shutter Cove waterline",
    line: "The tide gave back a hospital bracelet three days later. Wasn't yours. Didn't have a name on it either.",
  },
  {
    id: "testimony_davi",
    npc: "Davi",
    location: "Genesis Crossroads",
    line: "She borrowed a cart and brought it back cleaner than she took it.",
  },
  {
    id: "testimony_allix",
    npc: "Allix",
    location: "Grove canopy",
    line: "From up top? She took the long way. Not the fast way. The way with no windows on it.",
  },
]);

export const CH1_TESTIMONY_COUNT = CH1_TESTIMONIES.length;

/**
 * Collecting all twelve awards a RECONSTRUCTION, not a playback. The player
 * assembles the false memory themselves out of true statements. Nobody lied to
 * them; they did it. See ch1_fragment_ledger.ts.
 */
export const CH1_TESTIMONY_REWARD_FRAGMENT = "frag_a2_recon_arrival";

export function ch1TestimoniesComplete(collected: readonly string[]): boolean {
  const set = new Set(collected);
  return CH1_TESTIMONIES.every((t) => set.has(t.id));
}
