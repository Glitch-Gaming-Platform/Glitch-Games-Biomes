// CHAPTER_1_DOCUMENTS
//
// Persistent, rereadable in-world documents.
//
// Chapter 1's fair-play contract (journal §10.1, rule 3) is that "the truth is
// always physically present" — Lou's missing intake window, Coretta's dates,
// the one-per-fortnight vial cadence. That promise is only real if the player
// can go back and read the documents again after they have learned what to look
// for. A one-shot modal that scrolls past during a quest step is not evidence;
// it is set dressing.
//
// So every document here is:
//   * unlocked by a story flag and NEVER re-locked,
//   * paginated into short pages, because these are read on a HUD panel,
//   * and, for Lou's case notes, bound by a content rule:
//
//       EVERY SENTENCE IN THE CASE NOTES MUST BE TRUE, AND MUST STILL BE TRUE
//       AFTER ACT 6. The document's deceit is entirely by omission of the
//       fourteen-hour intake window. If any sentence becomes a lie at the
//       reveal, we have cheated and the row must be rewritten, not the reveal.
//
// NAMING DISCIPLINE (journal §0): no page below may contain a reveal term
// before its `unlockedBy` flag implies Act 6. Enforced by test over every page.

import { CH1_TESTIMONIES } from "@/shared/harthmere/ch1_cast";
import { CH1_FLAGS } from "@/shared/harthmere/ch1_ids";

export const CH1_DOCUMENTS_VERSION = 1 as const;

export interface Ch1DocumentPage {
  /** Optional page heading. Omitted pages continue the previous one. */
  heading?: string;
  body: string;
}

export interface Ch1DocumentDef {
  id: string;
  title: string;
  /** Who wrote it, in the player's words. */
  attribution: string;
  /** Act in which the document first becomes readable. */
  act: number;
  /** Story flag that unlocks it. Documents are never re-locked. */
  unlockedBy: string;
  /** Inventory item this document belongs to, when there is one. */
  itemId?: string;
  pages: readonly Ch1DocumentPage[];
  /** Writer-facing. Never shipped. */
  writerNote?: string;
}

// ---------------------------------------------------------------------------
// The twelve testimonies, as a rereadable page
// ---------------------------------------------------------------------------

const TESTIMONY_PAGES: readonly Ch1DocumentPage[] = CH1_TESTIMONIES.reduce<
  Ch1DocumentPage[]
>((pages, testimony, index) => {
  const line = `${testimony.npc}, ${testimony.location}:\n"${testimony.line}"`;
  if (index % 3 === 0) {
    pages.push({
      heading: index === 0 ? "What people remember" : undefined,
      body: line,
    });
  } else {
    pages[pages.length - 1] = {
      ...pages[pages.length - 1],
      body: `${pages[pages.length - 1].body}\n\n${line}`,
    };
  }
  return pages;
}, []);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const CH1_DOCUMENTS: readonly Ch1DocumentDef[] = Object.freeze([
  {
    id: "doc_the_night_you_came",
    title: "The Night You Came",
    attribution: "Twelve accounts, collected by you",
    act: 2,
    unlockedBy: CH1_FLAGS.act2Complete,
    pages: [
      {
        heading: "Twelve accounts",
        body: "Nobody in the Grove saw the whole thing. Twelve people saw one piece each, and none of them thinks their piece is important.\n\nThey are all telling the truth. You wrote every line down yourself.",
      },
      ...TESTIMONY_PAGES,
      {
        heading: "Your note at the bottom",
        body: "Read together these say one thing. Read again, in a different order, they say the opposite thing, and not one word has changed.\n\nYou are going to want to remember that you noticed this.",
      },
    ],
    writerNote:
      "The rereadable half of the Act 2 testimony collection. The closing note is the fairest thing in the chapter: the player is told, in their own handwriting, that the assembly is doing the work.",
  },
  {
    id: "doc_lou_case_notes",
    title: "Case Notes",
    attribution: "Dr. L. Ardan, Collective Medical Directorate",
    act: 3,
    unlockedBy: CH1_FLAGS.act3Complete,
    itemId: "item_lou_case_notes",
    pages: [
      {
        heading: "Covering note",
        body: "You will want to know whether the man treating you is the man who put you here. So here is everything I have, and I will be here when you get back either way.\n\nRead it in the dark somewhere. It is not flattering to me.",
      },
      {
        heading: "Page one — presentation",
        body: "Patient admitted with dense retrograde deficit and intact procedural memory. No head injury. No stroke. No infection.\n\nPatient could not give a name. Patient could still tie a surgical knot, correctly, without being asked twice.",
      },
      {
        heading: "Page two — course",
        body: "Care was supportive. Diet, sleep, daylight, conversation. I read to the patient most evenings because the patient asked me to.\n\nNo restraint was used at any point. That is in the record because I wanted it in the record.",
      },
      {
        heading: "Page three — prognosis",
        body: "I wrote that recovery was possible and that I did not expect it to be spontaneous. I still think both halves of that sentence are correct.\n\nI did not write a date. I was not given one.",
      },
      {
        heading: "Page four — the fire",
        body: "The east wing failed at night. I was on the ward. I walked the patient out through the service corridor myself.\n\nThere is a burn on my left forearm from a door I should have tested first. It is still there.",
      },
      {
        heading: "Page five — discharge",
        body: "The patient did not discharge. The patient was removed from the building during the incident by a person I did not know and could not stop.\n\nI reported that honestly and I was not believed, which I have decided not to resent.",
      },
      {
        heading: "Page six — my part",
        body: "I have been looking for this patient for eleven years. I want that written down by me, in my hand, before anyone else writes it for me.\n\nEverything in this file is true. I am aware that is not the same as complete.",
      },
    ],
    writerNote:
      "CONTENT RULE, enforced by test: every sentence must remain true after Act 6. Page six is the tell and it is sitting in the open — 'I am aware that is not the same as complete' is a confession nobody reads as one. The omitted fourteen hours are before page one.",
  },
  {
    id: "doc_sorrel_letter",
    title: "A Letter Addressed To No One",
    attribution: "N. Sorrel, Custodian 3",
    act: 5,
    unlockedBy: CH1_FLAGS.sorrelLetterRead,
    pages: [
      {
        heading: "Handwritten, water-marked, four months old by her reckoning",
        body: "Whoever finds this. I have been walking since the Ashfall test. I count one hundred and nineteen days.\n\nI have found four doorways and all four put me somewhere worse.",
      },
      {
        body: "There is a child at the desert one. I keep her fed. I cannot take her with me, do not judge me.\n\nI am going to stop moving and build something at the cold one because I am tired.",
      },
      {
        body: "If you are Collective: I have the original ledger and I will burn it before I hand it over.\n\nIf you are anybody else: bring rope, bring fire, bring more food than you think.",
      },
    ],
    writerNote:
      "Kit nearly dies bringing this. Rereading it after the handover is the cheapest and cruellest thing the chapter can do to a player, and it costs us one flag.",
  },
  {
    id: "doc_charcoal_wall",
    title: "The Charcoal Wall",
    attribution: "Copied out of Sorrel's camp",
    act: 5,
    unlockedBy: CH1_FLAGS.act5Complete,
    pages: [
      {
        heading: "Four months of arithmetic on a plank wall",
        body: "Load figures for four apertures, each measured against the other three because there was nothing else to measure them against.\n\nA tally of days. A tally of fish. A list of things she has stopped expecting.",
      },
      {
        body: "In the bottom corner, small, in a different hand pressure: a name, a decimal place, and the word STILL, underlined twice.\n\nYou do not remember the argument. The wall does.",
      },
    ],
  },
  {
    id: "doc_field_ledger",
    title: "Field Ledger",
    attribution: "The unredacted original",
    act: 5,
    unlockedBy: CH1_FLAGS.hasLedger,
    itemId: "item_sorrel_field_ledger",
    pages: [
      {
        heading: "What is actually in it",
        body: "Raw instrument records from before the programme learned to round. The model, in full, with its own failure conditions written by its own author.\n\nAnd the signatures. All nine of them.",
      },
      {
        body: "The recommendation is one sentence long and it is not a recommendation to regulate.\n\nUnderneath it, in a second hand, is the internal note deciding what to do about the person who wrote it.",
      },
      {
        heading: "The condition you agreed to",
        body: "It does not go to the Collective. Ever. Under any circumstance.\n\nYou said it out loud, in the cold, to her face.",
      },
    ],
    writerNote:
      "Deliberately readable BEFORE the handover so the confirmation prompt is not the first time the player understands what they are holding. After the handover the document stays in the reader with an added closing page.",
  },
  {
    id: "doc_the_intake_window",
    title: "Fourteen Hours",
    attribution: "Recovered, not written",
    act: 6,
    unlockedBy: CH1_FLAGS.act6TruthKnown,
    pages: [
      {
        heading: "The pages that were never in the file",
        body: "Intake began fourteen hours before page one of the case notes.\n\nEverything he wrote after that moment is true. Nothing he wrote covers this.",
      },
      {
        body: "A room. A consent form that is not signed. An argument you lost in under an hour.\n\nA needle. An alarm that was not a fire.",
      },
      {
        body: 'And his voice, exactly as gentle as it has been every day since:\n\n"I\'m sorry. This is the kind version."',
      },
    ],
    writerNote:
      "Unlocks with the consolidation. Reading the case notes immediately afterwards is the intended second move and every page still holds.",
  },
]);

const DOCUMENTS_BY_ID = new Map(CH1_DOCUMENTS.map((doc) => [doc.id, doc]));

export function ch1Document(id: string): Ch1DocumentDef | undefined {
  return DOCUMENTS_BY_ID.get(id);
}

export function ch1DocumentUnlocked(
  id: string,
  flags: ReadonlySet<string> | readonly string[]
): boolean {
  const doc = DOCUMENTS_BY_ID.get(id);
  if (!doc) return false;
  const set = flags instanceof Set ? flags : new Set(flags);
  return set.has(doc.unlockedBy);
}

/** Reader order is authored, not chronological by unlock. */
export function ch1UnlockedDocumentsFor(
  flags: ReadonlySet<string> | readonly string[]
): readonly Ch1DocumentDef[] {
  const set = flags instanceof Set ? flags : new Set(flags);
  return CH1_DOCUMENTS.filter((doc) => set.has(doc.unlockedBy));
}

/**
 * The field ledger gains a closing page once it has been handed over. Nothing
 * earlier is edited — the player rereads exactly what they read before, plus
 * the fact of what they did with it.
 */
export function ch1DocumentPages(
  id: string,
  flags: ReadonlySet<string> | readonly string[]
): readonly Ch1DocumentPage[] {
  const doc = DOCUMENTS_BY_ID.get(id);
  if (!doc) return [];
  const set = flags instanceof Set ? flags : new Set(flags);
  if (id === "doc_field_ledger" && set.has(CH1_FLAGS.ledgerSurrendered)) {
    return [
      ...doc.pages,
      {
        heading: "Where it is now",
        body: "You gave it to him. He tucked it under his arm and thanked you and used your designation.\n\nYou were told the condition twice. You were reminded of it at the moment of handing it over. Nobody tricked you.",
      },
    ];
  }
  return doc.pages;
}

/** Structural validation, run by test. */
export function ch1ValidateDocuments(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const knownFlags = new Set<string>(Object.values(CH1_FLAGS));
  for (const doc of CH1_DOCUMENTS) {
    if (seen.has(doc.id)) errors.push(`${doc.id}: duplicate document id`);
    seen.add(doc.id);
    if (!knownFlags.has(doc.unlockedBy)) {
      errors.push(
        `${doc.id}: unlockedBy "${doc.unlockedBy}" is not a Ch1 flag`
      );
    }
    if (doc.pages.length === 0) {
      errors.push(`${doc.id}: has no pages`);
    }
    for (const [index, page] of doc.pages.entries()) {
      if (page.body.trim().length === 0) {
        errors.push(`${doc.id}: page ${index + 1} is empty`);
      }
      // Reader pages are read on a HUD panel, not a book. Keep them short.
      if (page.body.length > 420) {
        errors.push(
          `${doc.id}: page ${index + 1} is ${page.body.length} characters; ` +
            `split it (limit 420)`
        );
      }
    }
  }
  return errors;
}
