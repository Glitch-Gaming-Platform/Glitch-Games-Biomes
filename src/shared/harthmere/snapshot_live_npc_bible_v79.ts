// SNAPSHOT_LIVE_NPC_BIBLE_V79
// Snapshot-only lore expansion for live NPC labels already present in the uploaded snapshot.
// Do not use this file to spawn new NPCs. It only enriches existing snapshot NPCs that
// previously appeared with labels but no Grove bible background.
// Harthmere NPCs are intentionally excluded.

export const SNAPSHOT_LIVE_NPC_BIBLE_VERSION_V79 =
  "snapshot-live-npc-bible-v79" as const;
export const SNAPSHOT_LIVE_NPC_BIBLE_NO_NEW_NPCS_V79 = true as const;
export const SNAPSHOT_LIVE_NPC_BIBLE_EXCLUDES_HARTHMERE_V79 = true as const;

export type SnapshotLiveNpcHomeAreaV79 =
  | "the_grove"
  | "genesis_crossroads"
  | "old_grove_road"
  | "lovely_locks"
  | "mosslawn"
  | "shutter_cove"
  | "muck_edges";

export type SnapshotLiveNpcLoreSourceV79 =
  | "live_snapshot_label_v78"
  | "screenshot_visible_snapshot_label";

export interface SnapshotLiveNpcLoreV79 {
  id: string;
  displayName: string;
  source: SnapshotLiveNpcLoreSourceV79;
  homeArea: SnapshotLiveNpcHomeAreaV79;
  role: string;
  shortDescription: string;
  background: string;
  currentGoal: string;
  motivation: string;
  voice: string;
  line: string;
  extraLines: readonly string[];
  likeabilityTags: readonly string[];
}

export const SNAPSHOT_LIVE_NPC_EXCLUDED_HARTHMERE_NAMES_V79 = [
  "Sergeant Bram Holt",
  "Mara",
  "Osric",
  "Elowen",
  "Father Aldren",
  "Hal",
  "Merl",
  "Ren",
  "Sen",
  "Market Board",
] as const;

export const SNAPSHOT_LIVE_NPC_LORE_V79: readonly SnapshotLiveNpcLoreV79[] = [
  {
    id: "allix",
    displayName: "Allix",
    source: "screenshot_visible_snapshot_label",
    homeArea: "the_grove",
    role: "Canopy spotter and branch-path look-out",
    shortDescription: "A high-perched Grove watcher who notices trouble before road signs do.",
    background:
      "Allix learned the Grove from above: roof edges, tree limbs, hedge tops, and any stone lip wide enough for a boot. They started climbing to avoid muck-soft ground, then became useful because the high view shows which paths are bending wrong before travelers notice. Allix is not an official ranger, but Jackie listens when Allix says the road looks restless.",
    currentGoal:
      "Keep watch over the Grove approach and call out early warnings when muck, lost travelers, or broken markers drift toward the starter road.",
    motivation:
      "I want the Grove to treat look-outs as part of the safety system, not as kids playing on roofs.",
    voice:
      "Quick, bright, a little smug from having seen everything first.",
    line: "Road looks different from up here. Less brave, more honest.",
    extraLines: [
      "Jackie checks footprints. I check where the footprints should have gone and did not.",
      "If I am yelling from a roof, assume the roof is not the problem.",
      "Muck does not climb well. That is the one polite thing I can say for it.",
    ],
    likeabilityTags: ["lookout", "canopy", "grove-safety"],
  },
  {
    id: "helsa",
    displayName: "Helsa",
    source: "screenshot_visible_snapshot_label",
    homeArea: "the_grove",
    role: "Night lamp keeper and late-watch greeter",
    shortDescription: "A calm night worker who keeps the Grove readable after sunset.",
    background:
      "Helsa took over the Grove lamps after too many arrivals reached Jackie at dusk with no idea which way was safe. She knows the color of every lantern chimney and which shadows are normal. People think she is quiet because she likes silence. Really, she is listening for the moment the night stops sounding like the Grove.",
    currentGoal:
      "Keep the night path lit, repair dim lanterns, and make sure new players can still read signs when the sky goes dark.",
    motivation:
      "I want the Grove to be safe at night without becoming fearful of the dark itself.",
    voice:
      "Low, steady, practical, more reassuring than cheerful.",
    line: "A lamp is not there to fight the dark. It is there so your feet do not have to guess.",
    extraLines: [
      "If a lantern goes blue, call me. If it goes quiet, call Jane too.",
      "The Grove is friendliest in daylight. It tells the truth at night.",
      "Do not run from every shadow. Some of them are just trees doing their best.",
    ],
    likeabilityTags: ["night-watch", "lamps", "safe-paths"],
  },
  {
    id: "drona",
    displayName: "Drona",
    source: "screenshot_visible_snapshot_label",
    homeArea: "mosslawn",
    role: "Moss path reader and soft-ground courier",
    shortDescription: "A careful courier who reads the ground by how it gives underfoot.",
    background:
      "Drona carries small messages across Mosslawn because they can tell the difference between soft moss, wet moss, and the wrong kind of soft. They are slow by choice, not by weakness. Drona was the first to notice that some patches stopped springing back after being stepped on, which made Ranger Jane start treating the moss like a warning system instead of decoration.",
    currentGoal:
      "Mark which Mosslawn paths are safe enough for new travelers and which need Jane, Doc, or a Muck Buster.",
    motivation:
      "I want quiet, careful work to matter as much as heroic running.",
    voice:
      "Measured, patient, observant, with dry humor that arrives late but lands cleanly.",
    line: "Fast feet miss soft ground. Soft ground remembers fast feet.",
    extraLines: [
      "If the moss does not rise after you pass, do not pass there twice.",
      "Billy calls it slow. I call it arriving with both boots.",
      "Mosslawn talks softly. That is not the same as having nothing to say.",
    ],
    likeabilityTags: ["mosslawn", "courier", "soft-ground"],
  },
  {
    id: "coretta",
    displayName: "Coretta",
    source: "screenshot_visible_snapshot_label",
    homeArea: "the_grove",
    role: "Seed ledger keeper and garden quarter organizer",
    shortDescription: "A garden record-keeper who tracks what survives the muck pressure.",
    background:
      "Coretta keeps lists no one admits they need: which flowerbeds recovered, which roots blackened, which benches were moved, which seed jars went missing, and who borrowed tools without saying so. The Grove looks effortless because Coretta has a ledger full of small recoveries. She distrusts panic, not because danger is unreal, but because panic ruins good records.",
    currentGoal:
      "Build a reliable Grove recovery ledger so Jackie, Jane, Luis, and Doc stop solving the same problems separately.",
    motivation:
      "I want the Grove to remember its own maintenance history before muck turns every problem into a surprise.",
    voice:
      "Organized, crisp, quietly kind, impossible to distract from a list.",
    line: "If it grew, broke, vanished, or came back sticky, I have a page for it.",
    extraLines: [
      "No, the flowers are not just flowers. They are our first warning that the soil changed its mind.",
      "Luis borrows nails. Billy borrows excuses. Jackie borrows time.",
      "Bring me facts. I will turn them into something less dramatic and more useful.",
    ],
    likeabilityTags: ["garden", "ledger", "maintenance"],
  },
  {
    id: "patsy",
    displayName: "Patsy",
    source: "screenshot_visible_snapshot_label",
    homeArea: "genesis_crossroads",
    role: "Notice-board keeper and lost-label repair hand",
    shortDescription: "A shy Crossroads helper who keeps signs, labels, and small notices from becoming useless.",
    background:
      "Patsy started by fixing crooked labels because Taye's painted signs were too important to leave half-readable. Now Patsy keeps the little notices that make the Crossroads work: bag tags, repair chits, warning scraps, supply labels, and reminders for travelers who pretend they remember instructions. Patsy does not like attention, but every confused newcomer eventually needs one of their labels.",
    currentGoal:
      "Repair the Crossroads notice system so Road Ahead directions, bag recovery hints, and repair tasks do not blur together.",
    motivation:
      "I want small, humble instructions to save people before anyone needs a dramatic rescue.",
    voice:
      "Soft, precise, nervous at first, then surprisingly firm about wording.",
    line: "A label is a promise that someone thought of you before you got confused.",
    extraLines: [
      "Please do not move the tags. The tags are calmer than most of us.",
      "If the sign is too grand, nobody reads it. If it is useful, they blame it for being small.",
      "I can fix the wording. I cannot fix people ignoring it, but I keep trying.",
    ],
    likeabilityTags: ["crossroads", "labels", "signage"],
  },
  {
    id: "gizela",
    displayName: "Gizela",
    source: "screenshot_visible_snapshot_label",
    homeArea: "shutter_cove",
    role: "Waterline scavenger and reflection witness",
    shortDescription: "A cove local who gathers what the water gives back.",
    background:
      "Gizela walks the Shutter Cove waterline after storms and collects the things the tide returns: cracked lenses, fishhooks, buttons, wet notes, and once a road marker that should have been nowhere near the cove. Dimmi calls her evidence useful. Gizela calls it proof that water has a better memory than people.",
    currentGoal:
      "Sort the cove's recovered objects and help Dimmi prove which reflections are real clues, not tricks of light.",
    motivation:
      "I want the Grove to stop throwing away small strange things just because they are inconvenient to explain.",
    voice:
      "Wry, superstitious but practical, always turning an object over in her hands.",
    line: "The water gives things back when it wants someone to feel guilty.",
    extraLines: [
      "Dimmi photographs the impossible. I collect the wet bits it leaves behind.",
      "If you find a dry note on a wet shore, read it before it changes its mind.",
      "Fish are honest. Reflections are not. Hooks sit somewhere in the middle.",
    ],
    likeabilityTags: ["shutter-cove", "waterline", "evidence"],
  },
  {
    id: "grover",
    displayName: "Grover",
    source: "screenshot_visible_snapshot_label",
    homeArea: "the_grove",
    role: "Lower-path helper and Grove mascot neighbor",
    shortDescription: "A small, stubborn helper who notices what taller travelers step over.",
    background:
      "Grover lives close to the ground and has made that everyone's problem in the best way. They spot dropped buttons, loose stones, cracked path blocks, and tiny muck sprouts before adults notice anything is wrong. Some locals treat Grover like a mascot. Jackie treats Grover like an early warning bell with feet.",
    currentGoal:
      "Keep the lower Grove path clear of small hazards and teach new travelers to look down as often as they look ahead.",
    motivation:
      "I want to be useful without being patted on the head for it.",
    voice:
      "Blunt, earnest, tiny but not timid.",
    line: "Big people miss small problems. Then the small problems become rude.",
    extraLines: [
      "I saw that loose stone yesterday. It was pretending to be innocent.",
      "If you drop something shiny, I will find it. If you drop something dangerous, I will complain first.",
      "The Grove is not clean. It is watched carefully.",
    ],
    likeabilityTags: ["lower-path", "small-hazards", "grove"],
  },
  {
    id: "alva",
    displayName: "Alva",
    source: "live_snapshot_label_v78",
    homeArea: "old_grove_road",
    role: "Bench-side route listener and traveler check-in",
    shortDescription: "A quiet road listener who learns where travelers hesitate.",
    background:
      "Alva sits where people slow down without meaning to. That makes them better than most maps. They hear which sign confused someone, which shortcut failed twice, and which part of the Road Ahead makes new arrivals pretend they are not scared. Alva rarely interrupts, but when they do, Jackie usually changes the route marker.",
    currentGoal:
      "Collect traveler hesitation points so the Road Ahead can be made clearer without making it feel like a lecture.",
    motivation:
      "I want the Grove to respect listening as a form of repair.",
    voice:
      "Quiet, generous, observant, asks better questions than most people answer.",
    line: "The road tells on itself when people stop talking.",
    extraLines: [
      "I count pauses. They are more honest than complaints.",
      "A traveler who says 'I'm fine' while staring at a broken sign is giving you a report.",
      "Sit a moment. Roads are easier to read when you stop trying to win them.",
    ],
    likeabilityTags: ["road-ahead", "listening", "wayfinding"],
  },
  {
    id: "davi",
    displayName: "Davi",
    source: "live_snapshot_label_v78",
    homeArea: "genesis_crossroads",
    role: "Spare-parts sorter and Crossroads runner",
    shortDescription: "A practical helper who knows where Luis's missing parts actually went.",
    background:
      "Davi sorts spare parts at Genesis Crossroads and has learned that every missing bolt has either been borrowed by Luis, mislabeled by Patsy, painted by Taye, or kicked under a cart by someone in a hurry. Davi is not glamorous, but the Crossroads stops working fast when nobody knows where the small useful things are.",
    currentGoal:
      "Keep road repair supplies sorted so player repair steps can use real parts instead of vague tutorial magic.",
    motivation:
      "I want the Crossroads to work because it is organized, not because everyone improvises until it survives.",
    voice:
      "Fast, practical, lightly exasperated, fond of exact counts.",
    line: "If you need one bolt, bring three. The road eats small numbers.",
    extraLines: [
      "Luis calls it a pile. I call it a system he has not earned yet.",
      "The third crate is not lost. It is emotionally unavailable behind the cart.",
      "Do not use repair wood as decoration. I know it is tempting. Still no.",
    ],
    likeabilityTags: ["crossroads", "parts", "repair"],
  },
  {
    id: "runna",
    displayName: "Runna",
    source: "live_snapshot_label_v78",
    homeArea: "old_grove_road",
    role: "Sprint-path coach and jump-stretch tester",
    shortDescription: "A Road Ahead runner who turns movement practice into survival training.",
    background:
      "Runna tests the sprint and jump stretch because the Road Ahead does not care whether a traveler learned movement from a sign or a scare. They mark where roots catch boots, where players slow too early, and where a jump needs confidence more than speed. Billy thinks Runna is competition. Runna thinks Billy is a cautionary tale with good shoes.",
    currentGoal:
      "Make the sprint-jump tutorial feel like part of the road, not a disconnected movement drill.",
    motivation:
      "I want every new traveler to learn momentum before the world demands it rudely.",
    voice:
      "Energetic, teasing, athletic, encouraging without being soft.",
    line: "The road will not wait for perfect form. Practice anyway.",
    extraLines: [
      "Jump from the mark, not from panic. Panic has terrible timing.",
      "Billy races the road. I recommend negotiating with it first.",
      "If you stumble here, good. Better here than near muck.",
    ],
    likeabilityTags: ["movement", "road-ahead", "jump-run"],
  },
  {
    id: "richard",
    displayName: "Richard",
    source: "live_snapshot_label_v78",
    homeArea: "genesis_crossroads",
    role: "Old route quartermaster and tool-check neighbor",
    shortDescription: "A careful quartermaster who keeps old tools from becoming forgotten hazards.",
    background:
      "Richard remembers when Genesis Crossroads had fewer jokes and more checklists. He keeps old axes, bent hinges, spare straps, and half-retired tools because someone always needs the thing everyone else threw away. He is suspicious of new systems until they survive rain, mud, and Billy.",
    currentGoal:
      "Make sure starter tools, bags, and repair supplies are safe enough for new travelers to trust.",
    motivation:
      "I want the Grove to modernize without losing the boring habits that kept people alive.",
    voice:
      "Gruff, practical, not unkind, allergic to waste.",
    line: "New is fine. Tested is better. Found in a ditch is a maybe.",
    extraLines: [
      "That axe is busted, not useless. There is a difference if your hands are patient.",
      "I trust a checklist more after it has been rained on.",
      "Do not throw out a strap unless you have already needed it twice.",
    ],
    likeabilityTags: ["tools", "crossroads", "quartermaster"],
  },
  {
    id: "emily",
    displayName: "Emily",
    source: "live_snapshot_label_v78",
    homeArea: "lovely_locks",
    role: "Photo-corner gardener and welcome-wall helper",
    shortDescription: "A friendly Grove local who makes identity, photos, and flowers feel connected.",
    background:
      "Emily tends the flower corners where travelers take their first photos because she believes a safe place should look like someone expected you to arrive. She helps Alexis with clean mirrors and Taye with color choices, but her real work is noticing when someone is too overwhelmed to enjoy the welcome.",
    currentGoal:
      "Keep the Grove's first-photo spots clear, pretty, and emotionally safe for new players finding their identity.",
    motivation:
      "I want the Grove welcome to feel sincere, not like a stage set for people who already know what they are doing.",
    voice:
      "Warm, gentle, socially perceptive, quietly protective.",
    line: "A welcome should have somewhere to stand, somewhere to breathe, and preferably flowers.",
    extraLines: [
      "Alexis fixes outfits. I fix the corner where people decide they like the outfit.",
      "A photo is easier when the world gives you permission to be seen.",
      "If the flowers lean away from the path, something passed there that should not have.",
    ],
    likeabilityTags: ["photos", "lovely-locks", "welcome"],
  },
  {
    id: "andriana",
    displayName: "Andriana",
    source: "screenshot_visible_snapshot_label",
    homeArea: "the_grove",
    role: "Market path greeter and work-board witness",
    shortDescription:
      "A Grove local who watches the path between the fountain crowd and the public work board.",
    background:
      "Andriana spends most days near the market path, where new arrivals slow down because they can see too many choices at once. She is not a formal guide, but she remembers which players read the board, which ones walk past it, and which ones need a smaller first task before the road feels possible.",
    currentGoal:
      "Keep the Grove's first work loop readable: find the Jobs Board, choose one useful task, and ask a real person before wandering into louder trouble.",
    motivation:
      "I want practical kindness to feel like part of the town system, not like a hint that appears only when someone is already lost.",
    voice:
      "Direct, friendly, a little amused by overconfident newcomers.",
    line:
      "If the board looks crowded, good. Crowded work means someone still knows where help is needed.",
    extraLines: [
      "Start with one notice, not the whole wall. The whole wall is how people become decorative panic.",
      "Julienne reads faces. I read whether people are pretending they read the board.",
      "A clean errand can teach you more about a town than a heroic mistake.",
    ],
    likeabilityTags: ["jobs-board", "market-path", "starter-work"],
  },
  {
    id: "julienne",
    displayName: "Julienne",
    source: "screenshot_visible_snapshot_label",
    homeArea: "the_grove",
    role: "Flower-stall helper and crowd mood reader",
    shortDescription:
      "A bright Grove helper who notices when the welcome crowd is getting confused or restless.",
    background:
      "Julienne works around the flower stalls and fountain edge, where the Grove looks peaceful enough that people forget it is also a staging area. She has a talent for spotting the person who is about to walk away with no food, no job, and no idea which sign they meant to follow.",
    currentGoal:
      "Nudge new travelers toward readable next steps: talk to locals, check nearby notices, and take starter work before the road starts making decisions for them.",
    motivation:
      "I want the Grove to stay beautiful without becoming a pretty place where confused people quietly fail.",
    voice:
      "Warm, quick, observant, with gentle pressure under the sweetness.",
    line:
      "Flowers are not directions, but people look calmer when directions have flowers nearby.",
    extraLines: [
      "Andriana handles the board crowd. I handle the faces people make before admitting they need it.",
      "If you are lost, do not make it mysterious. Say so while someone can still help.",
      "A good welcome gives you beauty and an errand. One without the other does not hold.",
    ],
    likeabilityTags: ["flowers", "crowd-care", "starter-work"],
  },
  {
    id: "rosalyn",
    displayName: "Rosalyn",
    source: "live_snapshot_label_v78",
    homeArea: "the_grove",
    role: "Fountain steward and starter helper",
    shortDescription: "A calm Grove fountain helper who keeps new arrivals oriented before they leave the safe lamps.",
    background:
      "Rosalyn works beside the fountain where new players first bunch up, keeping satchels, labels, and road notes visible so Jackie can focus on the changing road.",
    currentGoal:
      "Help new arrivals learn inventory, mail, recovery, map pins, and safe first choices without sending them away from the fountain crowd.",
    motivation:
      "I want the Grove to feel welcoming without letting kindness become vague instructions.",
    voice:
      "Warm, polished, practical, gently firm when a player is about to ignore the obvious sign.",
    line: "Start small. A calm bag, a clear map, and dry socks solve more emergencies than bravery does.",
    extraLines: [
      "Jackie watches the road. I watch what people forget before they reach it.",
      "If the fountain feels busy, good. Busy means someone is close enough to help.",
      "Use the marker, use the satchel, then use your feet. In that order.",
    ],
    likeabilityTags: ["fountain", "inventory", "starter-help"],
  },
] as const;

export const SNAPSHOT_LIVE_NPC_LORE_LABELS_V79 = SNAPSHOT_LIVE_NPC_LORE_V79.map(
  (npc) => npc.displayName,
) as readonly string[];

export function snapshotNormalizeLiveNpcNameV79(value: string | undefined) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function snapshotLiveNpcLoreByNameV79(name: string | undefined) {
  const normalized = snapshotNormalizeLiveNpcNameV79(name);
  if (!normalized) return undefined;
  return SNAPSHOT_LIVE_NPC_LORE_V79.find(
    (npc) => snapshotNormalizeLiveNpcNameV79(npc.displayName) === normalized,
  );
}

export function snapshotLiveNpcLoreFromTextV79(text: string | undefined) {
  const haystack = ` ${snapshotNormalizeLiveNpcNameV79(text)} `;
  if (!haystack.trim()) return undefined;
  return SNAPSHOT_LIVE_NPC_LORE_V79.find((npc) => {
    const needle = ` ${snapshotNormalizeLiveNpcNameV79(npc.displayName)} `;
    return haystack.includes(needle);
  });
}

export function snapshotIsExcludedHarthmereNpcLoreV79(text: string | undefined) {
  const haystack = ` ${snapshotNormalizeLiveNpcNameV79(text)} `;
  if (!haystack.trim()) return false;
  return SNAPSHOT_LIVE_NPC_EXCLUDED_HARTHMERE_NAMES_V79.some((name) => {
    const needle = ` ${snapshotNormalizeLiveNpcNameV79(name)} `;
    return haystack.includes(needle);
  });
}

export function snapshotLiveNpcLoreForDialogV79(input: {
  entityDescriptionText?: string;
  defaultDialog?: string;
  label?: string;
}) {
  const text = [input.label, input.entityDescriptionText, input.defaultDialog]
    .filter(Boolean)
    .join(" ");
  if (snapshotIsExcludedHarthmereNpcLoreV79(text)) return undefined;
  return snapshotLiveNpcLoreFromTextV79(text) ?? snapshotLiveNpcLoreByNameV79(input.label);
}

export function snapshotLiveNpcBibleAuditV79() {
  return {
    version: SNAPSHOT_LIVE_NPC_BIBLE_VERSION_V79,
    noNewNpcs: SNAPSHOT_LIVE_NPC_BIBLE_NO_NEW_NPCS_V79,
    excludesHarthmere: SNAPSHOT_LIVE_NPC_BIBLE_EXCLUDES_HARTHMERE_V79,
    count: SNAPSHOT_LIVE_NPC_LORE_V79.length,
    labels: SNAPSHOT_LIVE_NPC_LORE_LABELS_V79,
  };
}
